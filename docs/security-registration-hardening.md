# Registration security hardening — staged, not deployed

## Confirmed production findings (2026-10-18)
- Deployed `approve-user` v13 has `verify_jwt=false` and does not authorize its caller.
- `registration_requests` contains a plaintext `password` column and has RLS disabled.
- `anon` has SELECT, INSERT and UPDATE grants on `registration_requests` and `user_profiles`.
- Checking `user_profiles.role_code` alone is **not** a secure admin check.

## What this branch changes
- Adds a candidate `approve-user` Edge Function requiring a valid caller JWT and trusted `auth.users.raw_app_meta_data.app_role = 'admin'`.
- Client sends only a `request_id` to the approval function. The server reads request details and changes status.
- Does **not** deploy the function or change database policies.

## REQUIRED before deploying or merging
1. Back up current function and database policy definitions; identify and provision real admin accounts' `app_metadata.app_role` through an authorized admin mechanism. Do not derive admin status from mutable profile data.
2. Replace plaintext password collection and storage with a server-mediated invitation/reset-password flow. Pending applications must not expose passwords to other applicants or anonymous clients.
3. Design and test RLS and grants for `registration_requests`, `user_profiles`, and `employees` for anon, employee, manager, admin. Do not revoke all access blindly: public application submission and admin UI need working routes.
4. Address existing plaintext passwords and rotate affected credentials where warranted.
5. Ensure the approval workflow is idempotent/recoverable: this candidate may leave a created auth user if later profile or status writes fail. Avoid deploying before reconciliation handling is implemented and tested.
6. Test browser CORS preflight, unauthenticated 401, employee 403, admin success, repeated approval, invalid request, and database/API failures on a nonproduction environment.
7. Only then deploy and verify in production. The current live registration flow remains unchanged.

**Warning:** This is a review candidate, not a complete security fix. Merging this branch without deploying the matching Edge Function will break approval. Deploying the Edge Function before provisioning trusted admin claims will deny all approvals.
