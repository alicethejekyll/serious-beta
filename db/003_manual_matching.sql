-- Existing records need a new explicit human decision. No automatic authorization is migrated.
ALTER TABLE rr.matching_results
 ADD COLUMN authorization_status text NOT NULL DEFAULT 'pending'
  CHECK(authorization_status IN ('pending','authorized','rejected')),
 ADD COLUMN authorized_by uuid REFERENCES rr.admin_users(id) DEFERRABLE INITIALLY IMMEDIATE,
 ADD COLUMN authorized_at timestamptz,
 ADD CONSTRAINT matching_authorization_actor CHECK(
  (authorization_status='authorized' AND authorized_by IS NOT NULL AND authorized_at IS NOT NULL)
  OR (authorization_status<>'authorized' AND authorized_by IS NULL AND authorized_at IS NULL)
 );
UPDATE rr.matching_results SET score=NULL;
