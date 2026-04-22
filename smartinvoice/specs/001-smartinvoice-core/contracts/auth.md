# Contract: Authentication

Four endpoints governing first-run setup (FR-000c), login with throttling (FR-000, FR-000a,
FR-000d), session idle/absolute expiry (FR-000b), and logout. The password hash layer is
`argon2id` throughout; plaintext never hits disk or logs (SC-008).

All endpoints accept/return JSON. Session cookie name: `sid`. Cookie attributes:
`HttpOnly; SameSite=Strict; Secure` (Secure omitted in dev only if `NODE_ENV=development`).

---

## `POST /api/setup`

First-run owner provisioning (FR-000c).

### Gate

Only permitted when `users.countDocuments() === 0`. Once an owner exists, this endpoint MUST
return `409 Conflict` for every subsequent request.

### Request Body

```json
{ "username": "owner", "password": "hunter2025" }
```

### Validation

| Rule | Error on fail |
|------|----------------|
| `username` 1–40 chars | `400` |
| `password` ≥ 8 chars, contains ≥ 1 letter AND ≥ 1 digit (FR-000a) | `400` |
| No owner exists yet | `409` |

### Effects

1. Hash password with `argon2id`.
2. Insert `users` document with `failedAttempts: [], lockedUntil: null`.
3. Create a session (same rules as `/login`).
4. Set `sid` cookie.

### Response `201 Created`

```json
{ "username": "owner" }
```

### Contract Tests

| Test | Expected |
|------|----------|
| First-run, valid body | `201`, `sid` cookie set, `users.countDocuments === 1` |
| Second call after owner exists | `409` |
| Password 7 chars | `400` |
| Password "abcdefgh" (no digit) | `400` |
| Password "12345678" (no letter) | `400` |

---

## `POST /api/login`

Authenticate existing owner with throttle + lockout per FR-000d.

### Request Body

```json
{ "username": "owner", "password": "hunter2025" }
```

### Throttle / Lockout Algorithm (FR-000d)

1. `user = users.findOne({ username })`.
2. If `user == null` → `401` (no info leak about usernames).
3. If `user.lockedUntil && now < user.lockedUntil` → `429 Too Many Requests`
   with `Retry-After` header and body `{ "error": "Locked", "retryAfterSeconds": N }`.
4. Prune `user.failedAttempts` to only entries within last 10 minutes.
5. Verify password via `argon2.verify`.
6. **On failure**:
   - Push `now` to `failedAttempts`.
   - If length ≥ 5 → set `lockedUntil = now + 15 min`, clear `failedAttempts` array.
   - Persist. Return `401`.
7. **On success**:
   - Set `failedAttempts: [], lockedUntil: null`.
   - Insert new session; `expiresAt = now + 24h` (FR-000b).
   - Set `sid` cookie. Return `200`.

### Response `200 OK`

```json
{ "username": "owner" }
```

### Response `401 Unauthorized`

```json
{ "error": "Invalid credentials" }
```

### Response `429 Too Many Requests`

```json
{ "error": "Locked", "retryAfterSeconds": 900 }
```

### Contract Tests

| Test | Expected |
|------|----------|
| Correct credentials | `200`, `sid` cookie, session row created |
| Wrong password once | `401`, one failed attempt recorded |
| 5 wrong attempts within 10 min | 5th/6th gets `429`; `lockedUntil` set |
| Wait 15+ min after lockout | Login works, failed counter cleared |
| Successful login resets counter | After 3 failures + 1 success → `failedAttempts: []` |
| Unknown username | `401` (identical body to wrong password — no user enumeration) |

---

## `POST /api/logout`

Invalidate the current session.

### Request

Cookie `sid` required.

### Effects

- `sessions.deleteOne({ _id: sid })`
- Clear `sid` cookie in response (`Set-Cookie: sid=; Max-Age=0`).

### Response `204 No Content`

### Contract Tests

| Test | Expected |
|------|----------|
| Valid session | `204`, session doc gone |
| No `sid` cookie | `204` (idempotent) |
| Subsequent authenticated request | `401` |

---

## `GET /api/session`

Return current session status. Used by the frontend on app load to decide between rendering
the Setup wizard, the Login screen, or the main app.

### Response `200 OK` (authenticated)

```json
{ "authenticated": true, "username": "owner", "ownerExists": true }
```

### Response `200 OK` (not authenticated, owner exists)

```json
{ "authenticated": false, "ownerExists": true }
```

### Response `200 OK` (first run — no owner exists)

```json
{ "authenticated": false, "ownerExists": false }
```

This shape tells the frontend to render the Setup wizard instead of the Login screen.

### Contract Tests

| Test | Expected |
|------|----------|
| Fresh DB (no owner) | `{ ownerExists: false }` |
| Owner exists, no cookie | `{ authenticated: false, ownerExists: true }` |
| Owner exists, valid session | `{ authenticated: true, username: "owner" }` |
| Owner exists, session past idle timeout | `{ authenticated: false, ownerExists: true }` |

---

## Cross-Cutting Middleware

### `requireAuth`

Applied to every non-auth route. Logic:

1. Read `sid` cookie. If missing → `401`.
2. `session = sessions.findOne({ _id: sid })`. If missing / expired → `401` + clear cookie.
3. If `now - session.lastSeenAt > 30 min` (idle timeout, FR-000b) → `401` + delete session.
4. Otherwise: update `session.lastSeenAt = now`, attach `req.user`.

### Contract Tests for Middleware

| Test | Expected |
|------|----------|
| No cookie → protected endpoint | `401` |
| Expired session → protected endpoint | `401`, session row deleted |
| Session idle for 31 min → protected endpoint | `401` |
| Session active 20 min ago → protected endpoint | `200`, `lastSeenAt` refreshed |
