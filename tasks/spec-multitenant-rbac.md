# Spec: Multi-tenant Accounts and RBAC

## Status

Accepted — approved by the maintainer on 2026-08-14.

## Objective

Add local multi-tenant authentication so every transcription belongs to exactly one user. Users can create, read, update, and delete only their own work. Administrators can create, list, update, disable, reset credentials for, and delete user accounts, but cannot read or mutate another user's transcripts through an administrative bypass.

## Assumptions requiring approval

1. The initial administrator is created on first authenticated release from `TRANSKRIP_ADMIN_USERNAME` and `TRANSKRIP_ADMIN_PASSWORD`; startup fails closed when the database has no users and these values are absent.
2. All existing pre-RBAC transcriptions migrate to the initial administrator so no local work is lost or orphaned.
3. Roles are `admin` and `user`. Account management is admin-only; transcript access is always owner-only.
4. Authentication uses opaque, random server-side sessions in an HttpOnly, SameSite=Strict cookie—not JWT or browser local storage.
5. Passwords use Node's built-in `scrypt` with a per-user random salt. Plaintext passwords and session tokens are never stored or logged.
6. An administrator cannot disable/delete the last enabled administrator or delete their own active account.
7. Deleting a user deletes that user's transcripts and staged audio in one explicit, confirmed operation. Account disablement is the non-destructive default.
8. This release remains loopback-only. Exposing it to a LAN requires HTTPS and a revised deployment threat model.

## API contract

- `POST /api/auth/login` — username/password login; rotates session.
- `POST /api/auth/logout` — revokes the current session.
- `GET /api/auth/session` — returns the authenticated user's safe profile and permissions.
- `GET /api/admin/users` — paginated admin-only account list.
- `POST /api/admin/users` — create a user with a temporary administrator-supplied password.
- `PATCH /api/admin/users/:id` — update display name, role, enabled state, or replace password.
- `DELETE /api/admin/users/:id` — delete an account and its owned work after explicit confirmation.
- Existing `/api/transcriptions*` endpoints require authentication and derive ownership exclusively from the session.
- `DELETE /api/transcriptions/:id` — owner-only task deletion, including staged audio cleanup.

Errors retain the existing JSON envelope and use `401` for missing/invalid sessions, `403` for denied roles, `404` for resources not owned by the caller, and `409` for protected account-state conflicts. Owner checks intentionally return `404` to avoid disclosing another tenant's record IDs.

## Data model

- `users(id, username, display_name, role, password_hash, password_salt, enabled, created_at, updated_at)`
- `sessions(id_hash, user_id, expires_at, created_at, last_seen_at)`
- `transcriptions.owner_user_id NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- Unique case-normalized username index and owner-scoped transcription indexes.

## Security controls

- Constant-cost credential verification, generic login failure text, bounded body sizes, and in-memory loopback login throttling.
- Session token entropy of at least 256 bits; only its SHA-256 digest is persisted.
- HttpOnly, SameSite=Strict cookie with Secure when TLS is present; session expiry and revocation enforced server-side.
- Same-origin validation on unsafe authenticated requests as defense in depth against CSRF.
- Prepared statements and owner predicates on every transcript read/write query.
- No transcript contents, passwords, cookies, or tokens in logs.

## Interface

- Unauthenticated visitors see a login screen before any product route or API-backed content.
- The command bar shows the active account and logout action.
- Admins receive a `#users` account-management page with create, edit, disable, credential-reset, and guarded delete controls.
- Users receive owner-scoped task history and a delete action for their own transcription.
- Admin controls are hidden for non-admins, but server authorization remains authoritative.

## Testing strategy

- Unit tests: password hashing/verification, session token hashing/expiry, account invariants.
- Database tests: migration ownership, tenant filtering, cross-tenant denial, cascading deletion.
- API integration tests: login/logout, session cookies, CSRF/origin enforcement, admin RBAC, owner-only CRUD.
- Frontend tests: route guards, safe session parsing, admin navigation visibility.
- Real-browser smoke: two users cannot observe each other's work; admin account CRUD; logout invalidation.

## Commands

- Focused: `node --test server/auth.test.ts server/database.test.ts server/app.test.ts`
- Full gate: `npm run check`
- Production: `npm run build && npm start`

## Boundaries

- Always: preserve local privacy, migrate existing data, fail closed, validate at API boundaries, use server-side authorization.
- Ask first: change bootstrap/migration ownership, allow admins transcript access, add email delivery, expose beyond loopback, or add external identity providers.
- Never: store plaintext credentials/tokens, authorize from client state, log secrets/content, or silently delete user work.

## Success criteria

- Every transcript query and mutation is owner-scoped and cross-tenant access returns `404`.
- Only admins can manage accounts; last-admin protections are enforced transactionally.
- Users can CRUD their own transcripts and cannot access another user's IDs.
- Existing transcripts are preserved under the approved migration owner.
- Authentication survives refresh, logout revokes the session, disabled users lose active sessions.
- Full automated gate and two-user real-browser isolation smoke test pass.

## Approved decisions

- Bootstrap the first administrator from the two documented environment variables and fail closed if neither an account nor valid bootstrap credentials exist.
- Assign all legacy, pre-account transcripts to that first administrator during migration.
