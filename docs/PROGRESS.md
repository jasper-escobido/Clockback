# PROGRESS.md: Clockback

**Current stage:** Today page at `/` has two reusable buttons. Tapping one logs its action, disables it until refresh, and sends a POST to `/api/sleep`, which replies "Connected". A local Postgres 18 database runs in Docker with two tables and three migrations applied and verified by hand in `psql`. Nothing is saved from the app yet. No login, and Next.js is not connected to the database.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js (App Router), React, Tailwind, PostgreSQL, in plain JavaScript.

**Decisions made:**
- (all earlier decisions unchanged)
- Today page lives at `/` in `app/page.js`. Reusable UI goes in `components/` at the project root.
- `page.js` stays a Server Component and passes only plain text props (`label`, `action`). Only `ActionButton.js` is `"use client"`.
- The server and the database are the trusted layers. The page (disabled button, form checks) is only a convenience.
- Write SQL by hand with a query library (planned: `pg`, check current docs before installing). No ORM for now.
- Practice on local Docker Postgres first. Move to a hosted database later by re-running the migration files. Match the host's Postgres version before deploying.
- Table changes live in numbered files in `db/`. After a file has run, changes go in a new file.
- `users` (`db/001_create_users.sql`): `id` bigint identity primary key, `username` text unique not null, `email` text unique not null, `password_hash` text not null, `created_at` timestamptz not null default `CURRENT_TIMESTAMP`. Passwords stored only as hashes.
- `sleep_logs` (`db/002_create_sleep_logs.sql`): `id` bigint identity primary key, `user_id` bigint not null references `users (id)` ON DELETE CASCADE, `night_date` date not null, `bedtime` timestamptz (nullable), `wake_time` timestamptz (nullable), `bedtime_source` text (nullable), `wake_time_source` text (nullable), and `UNIQUE (user_id, night_date)`.
- `db/003_add_source_checks.sql`: CHECK constraints `sleep_logs_bedtime_source_check` and `sleep_logs_wake_time_source_check`. Each label is empty or one of "tapped" / "entered later". Applied and verified: a typo ("taped") was refused by the database.
- ON DELETE CASCADE chosen: deleting a user deletes their logs, because sleep data is personal and orphaned logs can't be managed. Revisit with a new migration if needs change.
- `night_date` is assigned by the server (noon cutoff) and saved once. The database only stores it.
- A time's source label is empty exactly when its time is empty. Server checks this first. The database backstop for this pairing is still to be written (migration `004`).
- "Wake time not before bedtime" is only checked when both times exist.
- If "I'm awake" is tapped and no night is waiting for a wake time, the server creates a row with only a wake time, dated to the night that just ended.
- Constraint names to map to friendly messages later: `users_username_key`, `users_email_key`, `sleep_logs_user_id_night_date_key`, `sleep_logs_user_id_fkey`, `sleep_logs_bedtime_source_check`, `sleep_logs_wake_time_source_check`.
- Visual polish (design skill) waits until more of the skeleton exists.

**Local database setup (how to get back to it):**
- Settings live in `.env` (git-ignored by `.env*`): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`. Format is `NAME=value`, no spaces, no quotes. Never paste the password anywhere.
- Container was created with: `docker run -d --name clockback --env-file .env -p 5432:5432 -v postgres:/var/lib/postgresql postgres:18` (from the project root). Don't run it again. After a reboot or log off, start it with `docker start clockback`. Check with `docker ps` (`docker ps -a` for stopped ones), logs with `docker logs clockback`.
- SQL prompt: `docker exec -it clockback psql -U <user> -d <database>`. Useful there: `\dt`, `\d users`, `\d sleep_logs`, `\q`. If output is long, `q` closes the pager.
- Run a migration at the normal `$` prompt, not inside `psql`: `docker exec -i clockback psql -U <user> -d <database> < db/00X_name.sql`. Add `-v ON_ERROR_STOP=1` to make failures loud.
- Multi-line commands pasted into `psql` can lose characters. Put them in a scratch file (kept out of Git) and run them like a migration.
- Docker permission fix that worked: added my user to the `docker` group, then restarted the laptop.

**Current code state:**
- `app/page.js`: parent `div` (`flex flex-col gap-2 m-6`), `h1` "Today", two `<ActionButton>` tags with `label` + `action` ("sleep", "wake").
- `components/ActionButton.js`: `"use client"`, `useState` for `hasTapped`, `onClick` runs `setHasTapped(true)`, logs `props.action`, and calls `fetch("/api/sleep", { method: "POST" })`. `disabled={hasTapped}` is on the `<button>`. Both buttons send the same request.
- `app/api/sleep/route.js`: `export function POST()` returns `Response.json("Connected")`. A temporary `GET` experiment may still be in the file.
- `db/001`, `db/002`, `db/003`: all applied.
- `.env` exists locally and is not tracked by Git. A `scratch.sql` file may exist; delete it or add it to `.gitignore`.
- The local database holds test data: user `testuser` (id 1) and one `sleep_logs` row (user 1, night 2026-11-02, bedtime, source "tapped"). Safe to delete.

**Done so far:**
- Next.js project set up. Node v24.22.2.
- Today page and reusable `ActionButton` built; phone-width layout checked in Chrome DevTools.
- Fixed the 500 error with `"use client"`; added `useState` and `disabled`.
- First route handler built and reached from a tap (status 200).
- Docker working, Postgres 18 container running with a volume, `.env` ignored by Git.
- Wrote and ran three migrations; verified tables and constraints with `\d`.
- Practiced INSERT, SELECT, and DELETE; triggered the unique, pair-unique, foreign key, and CHECK errors on purpose.

**Concepts I can explain:** (my own words)
- File-based routing; `page.js` in `app/` renders at `/`.
- Why a running program keeps its old environment until restart (VS Code, and the Docker group change).
- Props: `label="..."` becomes `props.label`.
- Why a reusable component beats repeating class strings.
- Margin vs gap (moving spacing to the parent fixed the doubled space).
- Server vs Client Components; what `"use client"` does.
- Layers of duplicate protection; why the button is only a convenience.
- Why the server and database are trusted: the person controls the browser, and every request passes through them.
- Route handlers: `route.js` answers only the methods it exports; `page.js` answers GET by drawing a screen.
- The request path so far: tap, `onClick`, `fetch`, URL, matching method function, response in the Network tab.
- Why the night date is stored: a 5 am tap belongs to the previous night.
- Why a wake-only row gets the night that just ended.
- Why SQL by hand instead of an ORM, and why table definitions live in files.
- `timestamptz` stores one exact moment and displays it in the session's zone.
- A pair-unique rule only refuses when the whole pair repeats.
- A foreign key makes the database refuse a row pointing at a nonexistent user.
- Duplicate errors name the constraint that refused the row, so the server can pick a friendly message.
- `docker start` revives an existing container; `docker run` creates a new one.
- Identity numbers are never reused: failed inserts and deleted rows still use up a number, so gaps are normal.

**Concepts still to learn (with a reminder to reread):**
- The `onClick` arrow function shape (practice writing it again).
- Padding (inside the box) vs margin (outside the box) in one line.
- Flex only arranges direct children of the flex container.
- Authentication vs authorization.
- Why the database stores empty (NULL), not the word "missed". The screen decides the wording.
- Primary key vs unique constraint, in my own words.
- CRUD, and how INSERT/SELECT/UPDATE/DELETE map to POST/GET/PUT or PATCH/DELETE.
- SQL shapes: INSERT has a column list, then `VALUES`, one `;` at the very end. In CHECK, `IS NULL` needs a column in front, and equality is a single `=`.
- `ALTER TABLE ... ADD CONSTRAINT` for changing a table that already exists.
- `DELETE` always needs a `WHERE`, or it deletes every row.
- Hashing passwords, and which method to use (a real security decision, handle at login).
- What `.env` is for, and why code reads `process.env.NAME`.
- HMR is a dev-only feature, not part of the app.

**Tests run:** no automated tests. Manual checks I reported: dev server starts, pages auto-update, `/history` renders, `/` shows Today, buttons match, a click logs and disables the button, refresh re-enables it (expected), a tap reaches `/api/sleep` with status 200, `/api/sleep` gave 405 until a `GET` was added, Docker container runs and logs "ready to accept connections", all three migrations applied, `\d users` and `\d sleep_logs` match the designs, valid inserts printed `INSERT 0 1`, and these were refused with the expected constraint names: duplicate username, duplicate email, duplicate (user, night), missing user (id 99), and a bad source label ("taped").

**Open decisions:** login approach, timezone handling, exact `pg` setup (connection settings and where the connection code lives, probably `lib/`), and whether to write migration `004` (the time-and-label pairing rule) now or after the server saves data.

**Parked notes:**
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- "I'm awake" attaches to the latest night with no wake time. What if that night is several days old? Decide later.
- Nothing in the database yet enforces "a time and its label are both filled or both empty." Planned as migration `004`. Valid cases: both filled, or both empty. A time with no label, or a label with no time, is invalid.
- `docs/Clockback_spec.md` may be older than the newer spec upload.
- `app/layout.js` and `app/history/page.js` are still placeholders.
- Both buttons send the same request; they need to use `props.action` to differ.
- Check `.gitignore` for `!.env.example` before creating `.env.example` (setting names only).
- Never commit `.env`. Commit `db/003_add_source_checks.sql`.

**Blockers:** none.

**Next smallest step:** connect Next.js to the database. Check the current `pg` docs, install it, and put the connection code in `lib/` reading its settings from `.env` through `process.env`. Test it by reading the practice user in a route handler. Migration `004` can come before or after.