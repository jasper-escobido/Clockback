# PROGRESS.md: Clockback

**Current stage:** Today page at `/` has two reusable buttons. Tapping one sends a POST to `/api/sleep` with a JSON body, `{action: "sleep"}` or `{action: "wake"}`. The server validates the action (400 if it is neither), works out `night_date` with the noon cutoff, and for "sleep" INSERTs a `sleep_logs` row for temporary user id 1 (bedtime = exact tap moment, source "tapped"). Verified in `psql`. A second "sleep" tap on the same night is refused by the database, but the server does not handle that error yet, so it returns 500. "wake" is validated but saves nothing yet. No login.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js (App Router), React, Tailwind, PostgreSQL, in plain JavaScript.

**Decisions made:**
- (all earlier decisions unchanged)
- Today page lives at `/` in `app/page.js`. Reusable UI goes in `components/` at the project root.
- `page.js` stays a Server Component and passes only plain text props (`label`, `action`). Only `ActionButton.js` is `"use client"`.
- The server and the database are the trusted layers. The page (disabled button, form checks) is only a convenience.
- Write SQL by hand with a query library (`pg`). No ORM for now.
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
- Constraint names to map to friendly messages: `users_username_key`, `users_email_key`, `sleep_logs_user_id_night_date_key`, `sleep_logs_user_id_fkey`, `sleep_logs_bedtime_source_check`, `sleep_logs_wake_time_source_check`.
- Visual polish (design skill) waits until more of the skeleton exists.
- `pg` is installed. One shared `Pool` is created in `lib/db.js` and imported by route handlers. `lib/db.js` is server-only and is never imported from a `"use client"` file.
- All connection settings come from `.env` via `process.env`: `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. Port 5432 is still hardcoded and matches the Docker `-p 5432:5432` mapping. Revisit if a hosted database uses a different port or a single connection string.
- Queries use placeholders (`$1` with a values array). User input is never glued into SQL strings.
- The client sends `JSON.stringify({action: props.action})` with header `Content-Type: application/json`. An object, not a bare string, so the field has a name.
- The server reads the body with `await request.json()` and validates `body.action` itself (400 if not "sleep" or "wake").
- `night_date` is built from local date parts (`getFullYear`, `getMonth() + 1`, `getDate()`), not `toISOString()`, which converts to UTC first. The server's local time zone is used for now. Timezone handling stays open.
- Bedtime comes from a fresh `new Date()` (`tapTime`), never from the date that was moved back for the noon cutoff. `night_date` labels the night. `bedtime` is when it really happened.
- Planned: the duplicate-night error becomes a 409 (conflict) instead of a 500, by catching `error.constraint === "sleep_logs_user_id_night_date_key"` and rethrowing any other error.

**Local database setup (how to get back to it):**
- Settings live in `.env` (git-ignored by `.env*`): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`. Format is `NAME=value`, no spaces, no quotes. Never paste the password anywhere.
- Container was created with: `docker run -d --name clockback --env-file .env -p 5432:5432 -v postgres:/var/lib/postgresql postgres:18` (from the project root). Don't run it again. After a reboot or log off, start it with `docker start clockback`. Check with `docker ps` (`docker ps -a` for stopped ones), logs with `docker logs clockback`.
- SQL prompt: `docker exec -it clockback psql -U <user> -d <database>`. Useful there: `\dt`, `\d users`, `\d sleep_logs`, `\q`. If output is long, `q` closes the pager.
- Run a migration at the normal `$` prompt, not inside `psql`: `docker exec -i clockback psql -U <user> -d <database> < db/00X_name.sql`. Add `-v ON_ERROR_STOP=1` to make failures loud.
- Multi-line commands pasted into `psql` can lose characters. Put them in a scratch file (kept out of Git) and run them like a migration.
- Docker permission fix that worked: added my user to the `docker` group, then restarted the laptop.
- `.env` also holds `POSTGRES_HOST` (`localhost` locally). Restart the dev server after any `.env` change.

**Current code state:**
- `lib/db.js`: imports `Pool` from `pg` and creates one pool from `process.env` settings. Exports it as default.
- `components/ActionButton.js`: `handleTap` is a named function that sets `hasTapped`, logs `props.action`, and POSTs the JSON body. The button uses `onClick={handleTap}`.
- `app/api/sleep/route.js`: `POST` is async. It reads the body, validates the action, computes `nightDate`, and for "sleep" INSERTs four columns (`user_id`, `night_date`, `bedtime`, `bedtime_source`) with placeholders. It still has temporary `console.log` lines for the body and `nightDate`. There is no `try`/`catch` yet. `GET` is still the temporary test (hardcoded id 1, no login), so remove or protect it before deploying.

**Done so far:**
- Next.js project set up. Node v24.22.2.
- Today page and reusable `ActionButton` built; phone-width layout checked in Chrome DevTools.
- Fixed the 500 error with `"use client"`; added `useState` and `disabled`.
- First route handler built and reached from a tap (status 200).
- Docker working, Postgres 18 container running with a volume, `.env` ignored by Git.
- Wrote and ran three migrations; verified tables and constraints with `\d`.
- Practiced INSERT, SELECT, and DELETE; triggered the unique, pair-unique, foreign key, and CHECK errors on purpose.
- Installed `pg`, created `lib/db.js`, connected a route handler to Postgres, and read `testuser` in the browser at `/api/sleep`.
- Moved the database host into `.env` as `POSTGRES_HOST`; re-tested after a restart and it still works.
- Moved the `onClick` logic into a named `handleTap` function.
- Sent `props.action` in a JSON body, so the two buttons now send different requests.
- Server reads the body and returns 400 for a bad action.
- Built the noon-cutoff `night_date` and tested it with fixed dates.
- The "sleep" tap saves a row for user 1; verified in `psql`.
- Triggered the unique constraint through the app (500, no second row).

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
- A misspelled `fetch` option (`header`) is silently ignored, so the browser falls back to `text/plain`.
- JavaScript counts months from 0 (November is raw 10), so add 1 before building the date text.

**Concepts still to learn (with a reminder to reread):**
- The `onClick` arrow function shape (practice writing it again).
- Padding (inside the box) vs margin (outside the box) in one line.
- Flex only arranges direct children of the flex container.
- Authentication vs authorization.
- Why the database stores empty (NULL), not the word "missed". The screen decides the wording.
- Primary key vs unique constraint, in my own words.
- CRUD, and how INSERT/SELECT/UPDATE/DELETE map to POST/GET/PUT or PATCH/DELETE.
- SQL shapes: INSERT has a column list, then `VALUES`, one `;` at the very end, and the columns, placeholders and values must line up one to one. In CHECK, `IS NULL` needs a column in front, and equality is a single `=`.
- `ALTER TABLE ... ADD CONSTRAINT` for changing a table that already exists.
- `DELETE` always needs a `WHERE`, or it deletes every row.
- Hashing passwords, and which method to use (a real security decision, handle at login).
- HMR is a dev-only feature, not part of the app.
- `try`/`catch`, `error.constraint`, and why a duplicate should be a 409 and not a 500.
- Status code families: 400 bad request, 409 conflict, 500 server error.
- Mix-ups to revisit: `getDay()` (day of the week) vs `getDate()` (day of the month); `{nightDate}` (a new object) vs `nightDate` (the value); a demo value left in real code.

**Explained this session, not yet said back in my own words (practice later):**
- Pool vs client; why one shared pool.
- `result.rows` is always an array (`rows[0]` for one row); `rowCount` matters for INSERT/UPDATE/DELETE.
- `process.env` is built into Node.js, not part of `pg`. Next.js loads `.env` into it at startup.
- The code's port must match the left side of Docker's `-p` mapping.
- Settings that differ per environment or are secret belong in `.env`.
- Placeholders (`$1`) and SQL injection.
- The full tap-to-row trip: tap, `handleTap`, `fetch` with a JSON body, `request.json()`, validation, `nightDate`, INSERT, response.
- A request is like a letter: URL, method, and an optional body. The server can only know what is in it.
- `JSON.stringify` on the way out, `await request.json()` on the way in.
- A `return` ends the function, so a leftover early `return` made valid taps get a 400.
- `setDate(0)` rolls back to the last day of the previous month.
- Server `console.log` output shows in the `npm run dev` terminal, not the browser console.
- Math must happen on a number before `String(...)`, or `+` glues text.
- `bedtime` uses a fresh `new Date()` because the moved date stands for the night, not the tap.

**Tests run:** no automated tests.
- Manual checks I reported (earlier): dev server starts, pages auto-update, `/history` renders, `/` shows Today, buttons match, a click logs and disables the button, refresh re-enables it (expected), a tap reaches `/api/sleep` with status 200, `/api/sleep` gave 405 until a `GET` was added, Docker container runs and logs "ready to accept connections", all three migrations applied, `\d users` and `\d sleep_logs` match the designs, valid inserts printed `INSERT 0 1`, and these were refused with the expected constraint names: duplicate username, duplicate email, duplicate (user, night), missing user (id 99), and a bad source label ("taped").
- Manual (reported): `/api/sleep` returns `[{"username":"testuser"}]`, and still works after adding `POSTGRES_HOST` and restarting. A typo, `result.row`, was caught and fixed to `result.rows`.
- Manual (reported, this session): Payload tab shows the object. `Content-Type` was `text/plain;charset=UTF-8` with the typo and `application/json` after the fix. Terminal printed `{ action: 'sleep' }` and `{ action: 'wake' }`. A `banana` action got 400 and `sleep` got 200. `nightDate` printed `2026-11-05` for today, `2026-11-04` for 3:00 am Nov 5, `2026-11-05` for 12:09 pm Nov 5, and `2026-10-31` for 3:00 am Nov 1. Tapping "sleep" saved row 6 (user 1, `2026-11-05`, real bedtime, `tapped`). A second tap gave 500 with no new row, and the terminal error named `sleep_logs_user_id_night_date_key`.
- Not yet run: a request with no `action` (`{}`), and the 1 January year-boundary result through the app.

**Open decisions:** login approach, timezone handling, whether to write migration `004` now or after the server saves data, and how the tap identifies the user before login exists (for now a hardcoded user id 1).

**Parked notes:**
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- "I'm awake" attaches to the latest night with no wake time. What if that night is several days old? Decide later.
- Nothing in the database yet enforces "a time and its label are both filled or both empty." Planned as migration `004`. Valid cases: both filled, or both empty. A time with no label, or a label with no time, is invalid.
- `docs/Clockback_spec.md` may be older than the newer spec upload.
- `app/layout.js` and `app/history/page.js` are still placeholders.
- The `console.log` lines in `POST` are temporary.
- The "wake" action is validated but not saved.
- Old practice rows (for example id 4) are still in `sleep_logs`.
- Check `.gitignore` for `!.env.example` before creating `.env.example` (setting names only). Add `POSTGRES_HOST` to it when it's created.
- Never commit `.env`. Commit `db/003_add_source_checks.sql`.
- The temporary `GET` in `/api/sleep` exposes data with no authentication. Remove it once real routes exist.

**Blockers:** none.

**Next smallest step:** wrap the INSERT in `try`/`catch`. On `error.constraint === "sleep_logs_user_id_night_date_key"`, return a 409 with a friendly message, and rethrow anything else. Repeat the second-tap test and confirm 409 in the Network tab and still one row for that night. After that, the "wake" action.