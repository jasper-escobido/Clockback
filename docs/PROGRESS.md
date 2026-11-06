# PROGRESS.md: Clockback

**Current stage:** Today page at `/` has two reusable buttons. Tapping one sends a POST to `/api/sleep` with a JSON body, `{action: "sleep"}` or `{action: "wake"}`. The server validates the action (400 if it is neither) and works out `night_date` with the noon cutoff. "sleep" INSERTs a `sleep_logs` row for temporary user id 1 (bedtime = exact tap moment, source "tapped"). "wake" first tries a guarded UPDATE on that night's row (only if `wake_time IS NULL`). If it matched nothing, it INSERTs a wake-only row. Duplicates for either action return 409 with a message, and any other error is rethrown as a 500. All paths tested by hand. Known gap: "wake" matches by the computed date, not by "the latest night still waiting for a wake time" (see parked notes). No login.

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
- A time's source label is empty exactly when its time is empty. The server saves a time and its label together. The database backstop for this pairing is still to be written (migration `004`).
- "Wake time not before bedtime" is only checked when both times exist. Not yet implemented on the UPDATE path.
- If "I'm awake" is tapped and no night is waiting for a wake time, the server creates a row with only a wake time, dated to the night that just ended.
- Constraint names to map to friendly messages: `users_username_key`, `users_email_key`, `sleep_logs_user_id_night_date_key`, `sleep_logs_user_id_fkey`, `sleep_logs_bedtime_source_check`, `sleep_logs_wake_time_source_check`.
- Visual polish (design skill) waits until more of the skeleton exists.
- `pg` is installed. One shared `Pool` is created in `lib/db.js` and imported by route handlers. `lib/db.js` is server-only and is never imported from a `"use client"` file.
- All connection settings come from `.env` via `process.env`: `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. Port 5432 is still hardcoded and matches the Docker `-p 5432:5432` mapping. Revisit if a hosted database uses a different port or a single connection string.
- Queries use placeholders (`$1` with a values array). User input is never glued into SQL strings.
- The client sends `JSON.stringify({action: props.action})` with header `Content-Type: application/json`. An object, not a bare string, so the field has a name.
- The server reads the body with `await request.json()` and validates `body.action` itself (400 if not "sleep" or "wake").
- `night_date` is built from local date parts (`getFullYear`, `getMonth() + 1`, `getDate()`), not `toISOString()`, which converts to UTC first. The server's local time zone is used for now. Timezone handling stays open.
- Times saved come from a fresh `new Date()` at the moment of the tap (`tapNightTime`, `tapWakeTime`), never from the date that was moved back for the noon cutoff. `night_date` labels the night. The time is when it really happened.
- A duplicate night becomes a 409 by catching `error.constraint === "sleep_logs_user_id_night_date_key"` inside `catch`. Any other error is rethrown with `throw error;` as the last line inside the `catch`, so it still becomes a 500.
- "wake" does the guarded UPDATE first. `result.rowCount === 0` means "nothing matched", which has two causes: no row exists (the INSERT succeeds), or the row already has a wake time (the INSERT is refused by the unique rule and becomes a 409). The guard (`AND wake_time IS NULL`) stops a second tap from overwriting the real wake time.
- `user_id` is hardcoded to `1` (the id of `testuser`) until login exists. When login exists, the server must get the user id from the session and never from the request body.

**Local database setup (how to get back to it):**
- Settings live in `.env` (git-ignored by `.env*`): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`. Format is `NAME=value`, no spaces, no quotes. Never paste the password anywhere.
- Container was created with: `docker run -d --name clockback --env-file .env -p 5432:5432 -v postgres:/var/lib/postgresql postgres:18` (from the project root). Don't run it again. After a reboot or log off, start it with `docker start clockback`. Check with `docker ps` (`docker ps -a` for stopped ones), logs with `docker logs clockback`.
- SQL prompt: `docker exec -it clockback psql -U <user> -d <database>`. Useful there: `\dt`, `\d users`, `\d sleep_logs`, `\q`. If output is long, `q` closes the pager.
- Run a migration at the normal `$` prompt, not inside `psql`: `docker exec -i clockback psql -U <user> -d <database> < db/00X_name.sql`. Add `-v ON_ERROR_STOP=1` to make failures loud.
- Multi-line commands pasted into `psql` can lose characters. Put them in a scratch file (kept out of Git) and run them like a migration, or write the statement on one line.
- Docker permission fix that worked: added my user to the `docker` group, then restarted the laptop.
- `.env` also holds `POSTGRES_HOST` (`localhost` locally). Restart the dev server after any `.env` change.

**Current code state:**
- `lib/db.js`: imports `Pool` from `pg` and creates one pool from `process.env` settings. Exports it as default.
- `components/ActionButton.js`: `handleTap` is a named function that sets `hasTapped`, logs `props.action`, and POSTs the JSON body. The button uses `onClick={handleTap}`.
- `app/api/sleep/route.js`: `POST` is async. It reads the body, validates the action (400), and computes `nightDate`. The "sleep" block INSERTs four columns (`user_id`, `night_date`, `bedtime`, `bedtime_source`) inside `try`/`catch` (409 on a duplicate, rethrow otherwise). The "wake" block runs the guarded UPDATE (`SET wake_time, wake_time_source WHERE user_id AND night_date AND wake_time IS NULL`). If `rowCount` is 0, it INSERTs a wake-only row inside `try`/`catch` (same 409 and rethrow). The messages are "sleep already logged today" and "wake already logged today". It still has temporary `console.log` lines for the body and `nightDate`. `GET` is still the temporary test (hardcoded id 1, no login), so remove or protect it before deploying.

**Done so far:**
- Next.js project set up. Node v24.22.2.
- Today page and reusable `ActionButton` built; phone-width layout checked in Chrome DevTools.
- Fixed the 500 error with `"use client"`; added `useState` and `disabled`.
- First route handler built and reached from a tap (status 200).
- Docker working, Postgres 18 container running with a volume, `.env` ignored by Git.
- Wrote and ran three migrations; verified tables and constraints with `\d`.
- Practiced INSERT, SELECT, UPDATE, and DELETE in `psql`; triggered the unique, pair-unique, foreign key, and CHECK errors on purpose.
- Installed `pg`, created `lib/db.js`, connected a route handler to Postgres, and read `testuser` in the browser at `/api/sleep`.
- Moved the database host into `.env` as `POSTGRES_HOST`; re-tested after a restart and it still works.
- Moved the `onClick` logic into a named `handleTap` function.
- Sent `props.action` in a JSON body, so the two buttons now send different requests.
- Server reads the body and returns 400 for a bad action.
- Built the noon-cutoff `night_date` and tested it with fixed dates.
- The "sleep" tap saves a row for user 1; verified in `psql`.
- Handled the duplicate night with `try`/`catch` (409), and fixed a misplaced `throw error;` (it was outside the `catch`).
- Built the "wake" action: guarded UPDATE, wake-only INSERT as a fallback, and 409 on a duplicate.
- Wrote and explained back the full "wake" tap path.

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
- `ActionButton.js` runs in the browser. `page.js` and `route.js` run in the Next.js server. `page.js` imports `ActionButton` as a component, and the only link to `route.js` is the URL in `fetch`.
- The database sends an error to my server. If the code doesn't catch it, Next.js answers with a 500. `try`/`catch` lets the server reply with a clearer 409.
- In "wake", `rowCount === 0` means the UPDATE matched nothing, and that has two causes: no row exists, or the row already has a wake time.
- Before the `if` blocks, the server reads the body with `request.json()`, validates the action (400), and computes `nightDate`, which both buttons use.

**Concepts still to learn (with a reminder to reread):**
- The `onClick` arrow function shape (practice writing it again).
- Padding (inside the box) vs margin (outside the box) in one line.
- Flex only arranges direct children of the flex container.
- Authentication vs authorization (and why `user_id` must come from the session, not the request).
- Why the database stores empty (NULL), not the word "missed". The screen decides the wording.
- Primary key vs unique constraint, in my own words.
- CRUD, and how INSERT/SELECT/UPDATE/DELETE map to POST/GET/PUT or PATCH/DELETE.
- SQL shapes: INSERT has a column list, then `VALUES`, one `;` at the very end, and the columns, placeholders and values must line up one to one. UPDATE has `SET` (comma between items), then `WHERE`. In CHECK and in `WHERE`, `IS NULL` needs a column in front, and equality is a single `=`.
- `ALTER TABLE ... ADD CONSTRAINT` for changing a table that already exists.
- `DELETE` and `UPDATE` always need a `WHERE`, or they hit every row.
- `UPDATE n` means n rows matched, not that n values changed (running it twice overwrote the wake time until the `IS NULL` guard was added).
- Hashing passwords, and which method to use (a real security decision, handle at login).
- HMR is a dev-only feature, not part of the app.
- Status code families: 400 bad request, 409 conflict, 500 server error.
- Mix-ups to revisit: `getDay()` (day of the week) vs `getDate()` (day of the month); `{nightDate}` (a new object) vs `nightDate` (the value); a demo value left in real code; a closing brace or `throw error;` in the wrong block.
- Test the success path too: the duplicate test alone couldn't reveal a misplaced `throw error;`.

**Explained this session, not yet said back in my own words (practice later):**
- Pool vs client; why one shared pool.
- `result.rows` is always an array (`rows[0]` for one row); `rowCount` matters for INSERT/UPDATE/DELETE.
- `process.env` is built into Node.js, not part of `pg`. Next.js loads `.env` into it at startup.
- The code's port must match the left side of Docker's `-p` mapping.
- Settings that differ per environment or are secret belong in `.env`.
- Placeholders (`$1`) and SQL injection.
- A request is like a letter: URL, method, and an optional body. The server can only know what is in it.
- `JSON.stringify` on the way out, `await request.json()` on the way in.
- A `return` ends the function, so a leftover early `return` made valid taps get a 400.
- `setDate(0)` rolls back to the last day of the previous month.
- Server `console.log` output shows in the `npm run dev` terminal, not the browser console.
- Math must happen on a number before `String(...)`, or `+` glues text.
- The time saved uses a fresh `new Date()` because the moved date stands for the night, not the tap.
- The unique rule (migration `002`) is what stops a duplicate. `try`/`catch` only decides the reply. Postgres checks the new pair against an index and refuses with error code `23505` and the constraint's name.
- `user_id` is `1` because `testuser` has id 1. An id is assigned once when the user row is created, and tapping never changes it.

**Tests run:** no automated tests.
- Manual checks I reported (earlier): dev server starts, pages auto-update, `/history` renders, `/` shows Today, buttons match, a click logs and disables the button, refresh re-enables it (expected), a tap reaches `/api/sleep` with status 200, `/api/sleep` gave 405 until a `GET` was added, Docker container runs and logs "ready to accept connections", all three migrations applied, `\d users` and `\d sleep_logs` match the designs, valid inserts printed `INSERT 0 1`, and these were refused with the expected constraint names: duplicate username, duplicate email, duplicate (user, night), missing user (id 99), and a bad source label ("taped").
- Manual (reported): `/api/sleep` returns `[{"username":"testuser"}]`, and still works after adding `POSTHOST` and restarting. A typo, `result.row`, was caught and fixed to `result.rows`.
- Manual (reported): `Content-Type` was `text/plain;charset=UTF-8` with the `header` typo and `application/json` after the fix. A `banana` action got 400 and `sleep` got 200. `nightDate` printed `2026-11-05` for a 6:39 pm tap, `2026-11-04` for 3:00 am Nov 5, `2026-11-05` for 12:09 pm Nov 5, and `2026-10-31` for 3:00 am Nov 1.
- Manual (reported): "sleep" saved a row (user 1, real bedtime, `tapped`). A second tap gave 409 with no new row (it gave 500 before `try`/`catch`). A misspelled column name gave 500 with a red terminal error (rethrow works). After deleting the old row, a fresh "sleep" tap gave 200 and a new row (success path).
- Manual (reported): "wake" with an existing row for that night updated it (200, no new row). A second "wake" tap gave 409 and left `wake_time` unchanged. A wake tap when no row matched the computed date created a wake-only row (200, bedtime empty, `wake_time_source` `tapped`).
- In `psql`, the unguarded UPDATE printed `UPDATE 1` twice and overwrote the wake time. With `AND wake_time IS NULL`, it printed `UPDATE 0` and the row was unchanged.
- Not yet run: a request with no `action` (`{}`), and a 1 January year-boundary result through the app.

**Open decisions:** login approach, timezone handling, how "awake" finds the night waiting for a wake time (and how old a waiting night may be), whether to write migration `004` now, and how the taps identify the user before login exists (for now a hardcoded user id 1).

**Parked notes:**
- "wake" matches by the computed date, not "the latest night with no wake time". Cases: a wake tap after noon gets today's date and misses the bedtime row (a separate wake-only row was created); a night several days old never gets its wake time; a later "sleep" tap on a night that already has a wake-only row is refused with 409. A possible fix is to find the latest row for the user with an empty wake time (SELECT first, or ORDER BY ... LIMIT 1 in the UPDATE's WHERE).
- The UPDATE path doesn't check that the wake time is later than the bedtime.
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- Nothing in the database yet enforces "a time and its label are both filled or both empty." Planned as migration `004`. Valid cases: both filled, or both empty. A time with no label, or a label with no time, is invalid.
- `docs/Clockback_spec.md` may be older than the newer spec upload.
- `app/layout.js` and `app/history/page.js` are still placeholders.
- The `console.log` lines in `POST` are temporary.
- The 409 messages are written from the server's view and may be reworded when the screen shows them.
- Old practice rows (for example id 4) are still in `sleep_logs`.
- Check `.gitignore` for `!.env.example` before creating `.env.example` (setting names only). Add `POSTGRES_HOST` to it when it's created.
- Never commit `.env`. Commit `db/003_add_source_checks.sql`.
- The temporary `GET` in `/api/sleep` exposes data with no authentication. Remove it once real routes exist.

**Blockers:** none.

**Next smallest step:** fix how "awake" finds its night. Decide the rule first (latest row for the user with an empty wake time, and how old it may be). Then practice the matching SELECT or UPDATE in `psql` before changing `route.js`. Re-run the three wake paths afterward: update, duplicate (409), and no row.