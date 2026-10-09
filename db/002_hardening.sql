-- Safe upgrade for checkouts created during local development. No data reset.
REVOKE SELECT ON rr.users,rr.sessions,rr.rate_limits,rr.audit_logs FROM rr_maintenance;
GRANT SELECT(id,expires_at),DELETE ON rr.users TO rr_maintenance;
GRANT SELECT(expires_at),DELETE ON rr.sessions TO rr_maintenance;
GRANT SELECT(window_end),DELETE ON rr.rate_limits TO rr_maintenance;
GRANT SELECT(created_at),DELETE,INSERT ON rr.audit_logs TO rr_maintenance;
DO $$ DECLARE fk record; BEGIN FOR fk IN SELECT conname,conrelid::regclass tbl FROM pg_constraint WHERE contype='f' AND connamespace='rr'::regnamespace LOOP
 EXECUTE format('ALTER TABLE %s ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE',fk.tbl,fk.conname);END LOOP;END $$;

GRANT SELECT(mock) ON rr.users TO rr_auth;
