# Trusted-device verification — security implementation specification

Status: DESIGN ONLY. Not deployed or enforced. Do not present as an active security feature.

## Requirement
After a password login, require a second factor for a device that has not been trusted. Provide a page listing trusted devices with last-used timestamps and revocation. Never rely on a browser localStorage flag or UI route guard for authorization.

## Platform limitation
Supabase Auth MFA currently supports authenticator-app TOTP and phone, not a native email-based second-factor challenge after password login. An email OTP used as a custom second factor needs a trusted server and independent server-side verification, plus database enforcement; do not confuse email signup confirmation or email sign-in OTP with MFA.

## Secure design options
Preferred supported solution: Supabase MFA TOTP enrollment and challenge/verify, with JWT aal2 enforcement in Postgres RLS. Trusted-device exemptions require a separate server-issued, device-bound session policy and cannot be implemented securely using browser-only trust.

If email OTP on untrusted devices is mandatory:
1. Deploy a server-side verification service (Edge Functions or backend) with an email provider, secrets only server-side, per-user and per-IP rate limits, generic errors, replay prevention, hashed single-use short-lived challenges, and an audit trail.
2. Introduce a server-verified trust record bound to a device credential (prefer WebAuthn/passkey, not fingerprinting or raw browser ID). A signed httpOnly Secure SameSite cookie alone is not sufficient unless server verifies possession and ties trust to the session.
3. Enforce verified-device status at the data-access boundary, not only React. Existing Supabase password sign-in immediately issues a valid aal1 access token; current user_id-based RLS would allow direct REST access before a UI email challenge. Design RLS or a server-only data API that denies unverified sessions, with explicit enrollment/recovery paths.
4. On login, after password, verify trust server-side; if untrusted, email one-time challenge, then issue a verified session claim via a trusted authority. Revalidate on refresh and revocation; prevent stale JWT claims from allowing revoked devices.
5. Device management page: display device label, created/last seen, current marker, revoke one/all, reauthenticate before sensitive operations; revoke active sessions or deny data on revoked trust. Avoid leaking device IP/location by default.
6. Include recovery codes or alternative enrolled factor for lost email/device. Test phishing, token theft, replay, brute force, expiry, multiple tabs, session renewal, two accounts, revocation, and direct PostgREST access.
7. Gate rollout behind integration tests and a staging deployment. Never change production RLS until existing accounts can enroll and recover.

## Acceptance tests
- New browser with valid password cannot read/write expenses through direct REST before second-factor verification.
- Existing trusted device can resume only while device credential and session remain valid.
- Revoked device cannot access data even with a previously issued token (account for JWT TTL).
- OTP expires, is single-use, throttled, and never appears in logs.
- Different accounts cannot share a device trust record.
- Lost-device recovery is possible without support manually disabling security.
- Email delivery, bounce, and rate-limit paths tested end-to-end.

## Next engineering step
Implement a staging-only proof of concept with Supabase MFA TOTP first, or provision a dedicated trusted backend and email service for conditional email OTP. Do not enable an incomplete client-side approximation in production.
