-- Apply using an isolated migration account. Runtime must never own these tables.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='rr_user') THEN CREATE ROLE rr_user NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='rr_admin') THEN CREATE ROLE rr_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='rr_auth') THEN CREATE ROLE rr_auth NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='rr_maintenance') THEN CREATE ROLE rr_maintenance NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='rr_runtime') THEN CREATE ROLE rr_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS; END IF;
END $$;
GRANT rr_user,rr_admin,rr_auth,rr_maintenance TO rr_runtime;
CREATE SCHEMA IF NOT EXISTS rr;
REVOKE ALL ON SCHEMA rr FROM PUBLIC;
GRANT USAGE ON SCHEMA rr TO rr_user,rr_admin,rr_auth,rr_maintenance;
CREATE TABLE rr.users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),public_id text UNIQUE,recovery_hash text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','withdrawn')),
 matching_status text NOT NULL DEFAULT 'pending' CHECK(matching_status IN ('pending','reviewed','paused')),
 mock boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL
);
CREATE TABLE rr.user_contacts(user_id uuid PRIMARY KEY REFERENCES rr.users ON DELETE CASCADE,ciphertext text NOT NULL);
CREATE TABLE rr.questionnaires(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,accepting boolean NOT NULL DEFAULT false,current_version_id uuid);
CREATE TABLE rr.questionnaire_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),questionnaire_id uuid NOT NULL REFERENCES rr.questionnaires,version integer NOT NULL,status text NOT NULL CHECK(status IN ('draft','published')),created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,UNIQUE(questionnaire_id,version));
ALTER TABLE rr.questionnaires ADD FOREIGN KEY (current_version_id) REFERENCES rr.questionnaire_versions;
CREATE TABLE rr.questions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version_id uuid NOT NULL REFERENCES rr.questionnaire_versions ON DELETE CASCADE,key text NOT NULL,position integer NOT NULL,definition jsonb NOT NULL,UNIQUE(version_id,key),UNIQUE(version_id,position));
CREATE TABLE rr.responses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL UNIQUE REFERENCES rr.users ON DELETE CASCADE,version_id uuid NOT NULL REFERENCES rr.questionnaire_versions,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted')),revision integer NOT NULL DEFAULT 0,submitted_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE rr.response_answers(response_id uuid NOT NULL REFERENCES rr.responses ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES rr.users ON DELETE CASCADE,question_key text NOT NULL,ciphertext text NOT NULL,PRIMARY KEY(response_id,question_key));
-- Reserved for a later invitation-only mode. No API or gate uses this table in the open beta.
CREATE TABLE rr.invitation_codes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code_hash text UNIQUE NOT NULL,used_by uuid REFERENCES rr.users ON DELETE SET NULL,expires_at timestamptz NOT NULL,revoked boolean NOT NULL DEFAULT false);
CREATE TABLE rr.matching_results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_a uuid NOT NULL REFERENCES rr.users ON DELETE CASCADE,user_b uuid NOT NULL REFERENCES rr.users ON DELETE CASCADE,report_ciphertext text NOT NULL,score integer CHECK(score BETWEEN 0 AND 100),eligible boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK(user_a<user_b));
CREATE TABLE rr.matching_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),result_id uuid NOT NULL REFERENCES rr.matching_results ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES rr.users ON DELETE CASCADE,decision text NOT NULL CHECK(decision IN ('pending','yes','no')),recorded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(result_id,user_id));
CREATE TABLE rr.admin_users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),username text UNIQUE NOT NULL,password_hash text NOT NULL,totp_ciphertext text NOT NULL,last_totp_counter bigint NOT NULL DEFAULT -1,active boolean NOT NULL DEFAULT true);
CREATE TABLE rr.sessions(token_hash text PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('user','admin')),user_id uuid REFERENCES rr.users ON DELETE CASCADE,admin_id uuid REFERENCES rr.admin_users ON DELETE CASCADE,csrf_hash text NOT NULL,csrf_ciphertext text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,mfa_at timestamptz,CHECK((kind='user' AND user_id IS NOT NULL AND admin_id IS NULL) OR (kind='admin' AND admin_id IS NOT NULL AND user_id IS NULL)));
CREATE TABLE rr.consent_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES rr.users ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('grant','withdraw')),privacy_version text NOT NULL,sensitive_version text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE rr.audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),admin_id uuid REFERENCES rr.admin_users ON DELETE SET NULL,action text NOT NULL,target_hash text,request_id text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE rr.rate_limits(key text PRIMARY KEY,hits integer NOT NULL,window_end timestamptz NOT NULL);
CREATE TABLE rr.app_settings(key text PRIMARY KEY,value jsonb NOT NULL);
CREATE INDEX ON rr.users(expires_at);CREATE INDEX ON rr.sessions(expires_at);CREATE INDEX ON rr.audit_logs(created_at);CREATE INDEX ON rr.matching_results(user_a,user_b);
CREATE FUNCTION rr.freeze_published_questions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM rr.questionnaire_versions WHERE id=COALESCE(OLD.version_id,NEW.version_id) AND status='published') THEN RAISE EXCEPTION 'published questions are immutable'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER freeze_questions BEFORE INSERT OR UPDATE OR DELETE ON rr.questions FOR EACH ROW EXECUTE FUNCTION rr.freeze_published_questions();
CREATE FUNCTION rr.freeze_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.status='published' THEN RAISE EXCEPTION 'published version is immutable';END IF;RETURN NEW;END $$;
CREATE TRIGGER freeze_version BEFORE UPDATE OR DELETE ON rr.questionnaire_versions FOR EACH ROW EXECUTE FUNCTION rr.freeze_version();
-- FORCE RLS also covers table owners; superusers are explicitly forbidden at runtime.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['users','user_contacts','questionnaires','questionnaire_versions','questions','responses','response_answers','invitation_codes','matching_results','matching_feedback','admin_users','sessions','consent_events','audit_logs','rate_limits','app_settings'] LOOP
 EXECUTE format('ALTER TABLE rr.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE rr.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;END $$;
CREATE POLICY own_users ON rr.users TO rr_user USING(id=nullif(current_setting('rr.user_id',true),'')::uuid) WITH CHECK(id=nullif(current_setting('rr.user_id',true),'')::uuid);
CREATE POLICY own_contacts ON rr.user_contacts TO rr_user USING(user_id=nullif(current_setting('rr.user_id',true),'')::uuid) WITH CHECK(user_id=nullif(current_setting('rr.user_id',true),'')::uuid);
CREATE POLICY own_responses ON rr.responses TO rr_user USING(user_id=nullif(current_setting('rr.user_id',true),'')::uuid) WITH CHECK(user_id=nullif(current_setting('rr.user_id',true),'')::uuid);
CREATE POLICY own_answers ON rr.response_answers TO rr_user USING(user_id=nullif(current_setting('rr.user_id',true),'')::uuid) WITH CHECK(user_id=nullif(current_setting('rr.user_id',true),'')::uuid AND EXISTS(SELECT 1 FROM rr.responses WHERE id=response_id AND user_id=nullif(current_setting('rr.user_id',true),'')::uuid));
CREATE POLICY own_consent ON rr.consent_events TO rr_user USING(user_id=nullif(current_setting('rr.user_id',true),'')::uuid) WITH CHECK(user_id=nullif(current_setting('rr.user_id',true),'')::uuid);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['users','user_contacts','questionnaires','questionnaire_versions','questions','responses','response_answers','matching_results','matching_feedback','consent_events','app_settings'] LOOP
 EXECUTE format('CREATE POLICY admin_access ON rr.%I TO rr_admin USING(true) WITH CHECK(true)',t);END LOOP;END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['questionnaires','questionnaire_versions','questions','app_settings'] LOOP
 EXECUTE format('CREATE POLICY user_read ON rr.%I FOR SELECT TO rr_user,rr_auth USING(true)',t);END LOOP;END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['users','sessions','admin_users','rate_limits'] LOOP EXECUTE format('CREATE POLICY auth_access ON rr.%I TO rr_auth USING(true) WITH CHECK(true)',t);END LOOP;END $$;
CREATE POLICY audit_admin ON rr.audit_logs TO rr_admin USING(true) WITH CHECK(true);
CREATE POLICY audit_auth_insert ON rr.audit_logs FOR INSERT TO rr_auth WITH CHECK(true);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['users','sessions','rate_limits','audit_logs'] LOOP EXECUTE format('CREATE POLICY maintenance_access ON rr.%I TO rr_maintenance USING(true) WITH CHECK(true)',t);END LOOP;END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA rr FROM PUBLIC;
GRANT SELECT(id,public_id,status,matching_status,mock,created_at,expires_at),UPDATE(public_id,status,matching_status,expires_at),DELETE ON rr.users TO rr_user;
GRANT SELECT,INSERT,UPDATE,DELETE ON rr.user_contacts,rr.responses,rr.response_answers TO rr_user;
GRANT SELECT,INSERT ON rr.consent_events TO rr_user;
GRANT SELECT ON rr.questionnaires,rr.questionnaire_versions,rr.questions,rr.app_settings TO rr_user,rr_auth;
GRANT SELECT(id,status,recovery_hash,expires_at,mock),INSERT,UPDATE(recovery_hash) ON rr.users TO rr_auth;
GRANT SELECT,INSERT,UPDATE,DELETE ON rr.sessions,rr.rate_limits TO rr_auth;
GRANT SELECT,UPDATE(last_totp_counter) ON rr.admin_users TO rr_auth;
GRANT SELECT(id,public_id,status,matching_status,mock,created_at,expires_at),UPDATE(matching_status),DELETE ON rr.users TO rr_admin;
GRANT SELECT,DELETE ON rr.user_contacts,rr.responses,rr.response_answers,rr.consent_events TO rr_admin;
GRANT SELECT,INSERT,UPDATE,DELETE ON rr.questionnaires,rr.questionnaire_versions,rr.questions,rr.matching_results,rr.matching_feedback,rr.app_settings TO rr_admin;
GRANT SELECT,INSERT ON rr.audit_logs TO rr_admin;
GRANT INSERT ON rr.audit_logs TO rr_auth;
GRANT SELECT(id,expires_at),DELETE ON rr.users TO rr_maintenance;
GRANT SELECT(expires_at),DELETE ON rr.sessions TO rr_maintenance;
GRANT SELECT(window_end),DELETE ON rr.rate_limits TO rr_maintenance;
GRANT SELECT(created_at),DELETE ON rr.audit_logs TO rr_maintenance;
-- No grants to anon/authenticated/service_role, and rr is never exposed through PostgREST.
GRANT INSERT ON rr.audit_logs TO rr_maintenance;
-- Atomic, portable recovery can insert related rows in one transaction.
DO $$ DECLARE fk record; BEGIN FOR fk IN SELECT conname,conrelid::regclass tbl FROM pg_constraint WHERE contype='f' AND connamespace='rr'::regnamespace LOOP
 EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE',fk.tbl,fk.conname);END LOOP;END $$;
