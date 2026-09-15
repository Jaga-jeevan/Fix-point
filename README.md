# FixPoint — Electronic Repair Management System (MVP)

A full-stack application for managing electronic device repair requests, with
three roles: **Customer**, **Technician**, and **Admin**.

```
React (Vite + Tailwind)  →  Flask REST API  →  PostgreSQL
```

## Workflow

```
CUSTOMER creates request       → REQUESTED
ADMIN approves                 → APPROVED
ADMIN assigns technician       → ASSIGNED
TECHNICIAN accepts              → ACCEPTED
TECHNICIAN starts travel        → ON_THE_WAY
TECHNICIAN receives device      → DEVICE_RECEIVED
TECHNICIAN starts repair        → REPAIRING
TECHNICIAN completes repair     → COMPLETED
```

(Alternative: `REQUESTED → REJECTED` if the admin rejects the request.)

A technician never sees a request until it has been approved **and**
assigned to them by an admin. All status transitions and role permissions
are enforced on the Flask backend, not just in the React UI.

---

## 1. Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ (running locally or accessible remotely)

---

## 2. Backend setup

### 2.1 Create the PostgreSQL database

```bash
# from a terminal with access to psql
createdb electronic_repair

# or, inside psql:
psql -U postgres
CREATE DATABASE electronic_repair;
```

### 2.2 Install dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2.3 Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set your real database credentials and a strong
`JWT_SECRET_KEY`:

```
DATABASE_URL=postgresql://username:password@localhost:5432/electronic_repair
JWT_SECRET_KEY=your_secure_jwt_secret_key_must_be_at_least_32_bytes_long
```

### 2.4 Run migrations / create tables

```bash
flask --app run.py db init        # only the first time
flask --app run.py db migrate -m "Initial tables"
flask --app run.py db upgrade
```

If you'd rather skip Alembic for a quick local run, `python seed.py`
(next step) also calls `db.create_all()`, which is enough to create every
table for the MVP.

### 2.5 Seed test accounts

```bash
python seed.py
```

This creates:

| Role       | Email                  | Password       |
|------------|-------------------------|----------------|
| Admin      | admin@example.com       | Admin@123      |
| Technician | tech1@example.com       | Tech@123       |
| Technician | tech2@example.com       | Tech@123       |
| Customer   | customer@example.com    | Customer@123   |

**These are development credentials only — change or remove them before
any production deployment.**

### 2.6 Start the Flask server

```bash
python run.py
```

The API will be available at `http://localhost:5000/api`.

---

## 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
```

`.env` should point at your running backend:

```
VITE_API_URL=http://localhost:5000/api
```

### Start the React dev server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## 4. Test login credentials

| Role       | Email                 | Password     |
|------------|------------------------|---------------|
| Admin      | admin@example.com      | Admin@123     |
| Technician | tech1@example.com      | Tech@123      |
| Customer   | customer@example.com   | Customer@123  |

You can also register new Customer/Technician accounts from `/register`.
Admin accounts are seed-only and cannot be self-registered.

---

## 5. API testing instructions

You can exercise the full workflow with `curl` or Postman.

```bash
# 1. Log in as a customer
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","password":"Customer@123"}'

# 2. Create a repair request (multipart form, photo optional)
curl -X POST http://localhost:5000/api/customer/repairs \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "device_type=Laptop" -F "brand=Dell" -F "model=Inspiron 15" \
  -F "problem_description=Not powering on" \
  -F "preferred_date=2026-09-02" -F "preferred_time=10:00" \
  -F "address=Chennai" -F "photo=@laptop.jpg"

# 3. Log in as admin, approve, then assign a technician
curl -X POST http://localhost:5000/api/admin/repairs/1/approve \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

curl -X GET "http://localhost:5000/api/admin/technicians?available=true" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"

curl -X POST http://localhost:5000/api/admin/repairs/1/assign \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"technician_id": 1}'

# 4. Log in as the assigned technician and walk the job through
curl -X POST http://localhost:5000/api/technician/jobs/1/accept -H "Authorization: Bearer <TECH_TOKEN>"
curl -X POST http://localhost:5000/api/technician/jobs/1/start-travel -H "Authorization: Bearer <TECH_TOKEN>"
curl -X POST http://localhost:5000/api/technician/jobs/1/receive-device -H "Authorization: Bearer <TECH_TOKEN>" -F "notes=Looks fine"
curl -X POST http://localhost:5000/api/technician/jobs/1/start-repair -H "Authorization: Bearer <TECH_TOKEN>"
curl -X POST http://localhost:5000/api/technician/jobs/1/complete -H "Authorization: Bearer <TECH_TOKEN>"
```

Or simply do the same steps through the React UI at `http://localhost:5173`.

---

## 6. Project structure

```
electronic-repair-system/
├── backend/
│   ├── app/
│   │   ├── models/        # SQLAlchemy models (User, Technician, Device, ...)
│   │   ├── routes/        # Flask blueprints (auth, customer, technician, admin)
│   │   ├── services/      # repair_service (status machine), assignment_service
│   │   └── utils/         # role_required decorator, file upload helper
│   ├── uploads/            # saved repair photos
│   ├── config.py
│   ├── run.py
│   ├── seed.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # Navbar, Sidebar, ProtectedRoute, StatusBadge, RepairTimeline
│   │   ├── pages/           # auth/, customer/, technician/, admin/
│   │   ├── services/        # axios API clients
│   │   └── context/         # AuthContext (JWT + current user)
│   └── package.json
└── README.md
```

---

## 7. Security notes for the MVP

- Passwords are hashed with Werkzeug (`generate_password_hash` /
  `check_password_hash`) — never stored in plain text.
- JWT access tokens carry the user's role as a claim; every protected route
  is wrapped in `@role_required(...)`, returning `401` for missing/invalid
  tokens and `403` for the wrong role.
- Ownership is checked on every record fetch — a customer can only see their
  own repairs, and a technician can only see jobs they are assigned to.
- Status transitions are validated server-side against a fixed state
  machine (`app/models/repair_request.py` → `VALID_TRANSITIONS`); illegal
  jumps like `REQUESTED → COMPLETED` are rejected with `400`.
- Uploaded images are restricted to `.jpg`/`.jpeg`/`.png`, renamed to a
  random filename on save, and size-limited via `MAX_CONTENT_LENGTH`.

## 8. What's intentionally left out of this MVP

Per the brief, this build does **not** include: payment gateways, GPS/live
tracking, SMS/WhatsApp/email notifications, AI diagnosis, chat, or a
microservices split. The priority was a fully working
Customer → Admin → Technician workflow end to end.

---

## 9. v2 upgrade: automatic assignment, chat, quotations, notifications, parts

This system was later extended with six features on top of the original
MVP, **without changing** existing auth, RBAC, or the core repair state
machine (`REQUESTED → APPROVED → ASSIGNED → ACCEPTED → ON_THE_WAY →
DEVICE_RECEIVED → REPAIRING → COMPLETED`).

### What changed vs. the original MVP

- **Automatic technician assignment.** Admin still approves/rejects
  requests (unchanged). What changed: approving a request no longer lets
  the admin hand-pick a technician. Instead, every currently-`AVAILABLE`
  technician is notified, and any one of them can claim it via
  `POST /technician/available-requests/<id>/accept`. The admin's old
  manual-assign endpoint (`POST /admin/repairs/<id>/assign`) still exists
  but now returns a 400 explaining assignment is automatic, rather than
  disappearing outright.
- **`Technician.is_available` (boolean) → `Technician.availability_status`**
  (`AVAILABLE` / `BUSY` / `OFFLINE`). A read-only `is_available` property
  was kept on the model for compatibility.
- **Concurrency safety**, required by the brief: claiming a request and
  decrementing part stock are both implemented as a single conditional SQL
  `UPDATE ... WHERE <still-valid-condition>`, not a read-then-write. If two
  technicians (or two part-usage requests) race, the loser's `UPDATE`
  simply matches zero rows and the app returns a clean error — no separate
  application-level lock needed, and PostgreSQL's row-level locking during
  the `UPDATE` statement itself prevents the race.
- **New tables**: `messages`, `quotations`, `quotation_items`,
  `notifications`, `parts`, `parts_used`, `repair_actions`. None of the
  original tables were dropped or renamed.

### New API endpoints

```text
# Automatic assignment
GET  /api/technician/available-requests
POST /api/technician/available-requests/<id>/accept
PATCH /api/technician/availability              (AVAILABLE <-> OFFLINE)

# Chat (customer <-> assigned technician only)
GET  /api/repairs/<id>/messages
POST /api/repairs/<id>/messages

# Quotation
GET  /api/repairs/<id>/quotation
POST /api/repairs/<id>/quotation                 (technician: create/edit while DRAFT)
POST /api/repairs/<id>/quotation/send             (technician: DRAFT -> SENT)
POST /api/repairs/<id>/quotation/approve           (customer: SENT -> APPROVED)
POST /api/repairs/<id>/quotation/reject            (customer: SENT -> REJECTED)

# Notifications
GET   /api/notifications
PATCH /api/notifications/<id>/read
PATCH /api/notifications/read-all

# Repair actions (technician writes, customer reads)
GET  /api/repairs/<id>/actions
POST /api/repairs/<id>/actions

# Parts
GET  /api/parts                                   (inventory catalog)
GET  /api/repairs/<id>/parts                       (parts used on this repair)
POST /api/repairs/<id>/parts                       (technician logs a part used; stock decremented atomically)
```

All of the above enforce the same rule: only the owning customer or the
technician currently assigned to that specific repair can read/write it.
Admin is intentionally **not** a participant in chat, per the brief.

### Database migration

The original project's `migrations/` folder was never initialized against a
real database (the MVP used `db.create_all()` via `seed.py` for local
testing). Because of that, there's no existing Alembic history to safely
autogenerate a diff migration against from this sandbox. Before running the
v2 backend against your database:

```bash
cd backend
flask --app run.py db init       # only if migrations/ has no env.py yet
flask --app run.py db migrate -m "Add auto-assignment, chat, quotations, notifications, parts"
flask --app run.py db upgrade
```

If you don't already have data you care about, `python seed.py` (which
calls `db.create_all()`) is enough to create every table, old and new, in
one step for local development — just re-run it after pulling this update.

### Updated test credentials / data

Same as before, plus a small parts inventory is now seeded (`Power IC`,
`Capacitor`, `SSD 256GB`, `Laptop Battery`, `Mobile Display`,
`Charging Port`) so you have something to attach to a quotation or parts-used
entry right away.

### Suggested end-to-end test for v2 (superseded by v3 below)

```text
1. Customer creates a repair request (unchanged)
2. Admin approves it -> all AVAILABLE technicians get a notification
3. Technician A opens "Available Requests" and clicks Accept
4. (Optional) Open a second technician session and confirm the same
   request now returns "already accepted by another technician"
5. Customer + Technician A chat on the repair
6. Technician A fills in diagnosis + parts + labour, saves draft, sends
7. Customer sees the quotation and approves it
8. Technician A logs repair actions and parts used (stock decreases)
9. Technician A proceeds through the existing ACCEPTED -> ... -> COMPLETED
   workflow as before
10. Technician's availability_status returns to AVAILABLE on completion
```

---

## 10. v3 update: requests skip admin approval, availability toggle hardened

Two follow-up changes on top of the v2 upgrade above, again without
touching auth, RBAC, database connection config, or any other existing
feature:

- **Repair requests now reach every available technician immediately on
  creation**, not after an admin approves them. `POST /customer/repairs`
  calls the same technician-notification helper that used to run on
  admin approval; `GET /technician/available-requests` now lists both
  `REQUESTED` and `APPROVED` repairs (either just means "not yet assigned").
  Admin approve/reject still work exactly as before as an optional review
  step, but no longer gate technician visibility, and approving no longer
  sends a second, duplicate notification.
- **The AVAILABLE/OFFLINE toggle (`PATCH /technician/availability`) was
  rewritten as a single conditional `UPDATE ... WHERE availability_status
  IN ('AVAILABLE','OFFLINE')`**, replacing the previous read-then-write
  version. The old version could silently overwrite a `BUSY` status if a
  job got claimed in another tab between the check and the write; the new
  version can't, by construction, and cleanly rejects with "You cannot
  change availability while you have an active job." if that race happens.
  The frontend toggle also now applies the server-confirmed status to the
  UI immediately instead of waiting on a full dashboard reload, so it
  reflects reliably in real time.

### Updated end-to-end test for v3

```text
1. Customer creates a repair request
   -> every AVAILABLE technician is notified immediately (no admin step needed)
2. Technician A opens "Available Requests" and clicks Accept
3. (Optional) Confirm a second technician session can no longer claim the
   same request ("already accepted by another technician")
4. (Optional) Admin can still approve/reject from the admin dashboard, but
   this is now just a record - it doesn't change what technicians can see
5. Technician B (a different technician) clicks "Go Offline" -> "Go Available"
   on their dashboard and confirms the badge updates immediately, and that
   toggling is blocked with a clear message while they have an active job
6. Continue the existing chat / quotation / repair actions / parts /
   ACCEPTED -> ... -> COMPLETED workflow as in the v2 test above
```
