# PROGRESS.md: Clockback

**Current stage:** Today page at `/` has two reusable buttons. Tapping one sends a POST to `/api/sleep` with a JSON body, `{action: "sleep"}` or `{action: "wake"}`. The server validates the action (400 if it is neither) and works out `night_date` with the noon cutoff. "sleep" INSERTs a `sleep_logs` row for temporary user id 1 (bedtime = exact tap moment, source "tapped"). "wake" looks up the user's newest row, then UPDATEs it by `id` only if its `wake_time IS NULL` and its bedtime is within 48 hours. If nothing was updated (no row found, or a guard refused it), it INSERTs a wake-only row. Duplicates for either action return 409 with a message, and any other error is rethrown as a 500. All paths tested by hand. Known limits are in the parked notes. No login.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js (App Router), React, Tailwind, PostgreSQL, in plain JavaScript.

**How I'm learning:** Guided Learning level. I'm still building my understanding of how requests travel and of backend work, so explain concepts first, give small generic examples on made-up tables (not my exact answer), and let me write my own code. Don't give full ready-to-paste functions unless I ask. One focused question at a time. Corrections welcome.

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
- If "I'm awake" is tapped and no night is waiting for a wake time, the server creates a row with only a wake time, using the computed `nightDate`.
- Constraint names to map to friendly messages: `users_username_key`, `users_email_key`, `sleep_logs_user_id_night_date_key`, `sleep_logs_user_id_fkey`, `sleep_logs_bedtime_source_check`, `sleep_logs_wake_time_source_check`.
- Visual polish (design skill) waits until more of the skeleton exists.
- `pg` is installed. One shared `Pool` is created in `lib/db.js` and imported by route handlers. `lib/db.js` is server-only and is never imported from a `"use client"` file.
- All connection settings come from `.env` via `process.env`: `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. Port 5432 is still hardcoded and matches the Docker `-p 5432:5432` mapping. Revisit if a hosted database uses a different port or a single connection string.
- Queries use placeholders (`$1` with a values array). User input is never glued into SQL strings. Fixed rules of mine (like `interval '48 hours'`) may stay written in the SQL text.
- The client sends `JSON.stringify({action: props.action})` with header `Content-Type: application/json`. An object, not a bare string, so the field has a name.
- The server reads the body with `await request.json()` and validates `body.action` itself (400 if not "sleep" or "wake").
- `night_date` is built from local date parts (`getFullYear`, `getMonth() + 1`, `getDate()`), not `toISOString()`, which converts to UTC first. The server's local time zone is used for now. Timezone handling stays open.
- Times saved come from a fresh `new Date()` at the moment of the tap (`tapNightTime`, `tapWakeTime`), never from the date that was moved back for the noon cutoff. `night_date` labels the night. The time is when it really happened.
- A duplicate night becomes a 409 by catching `error.constraint === "sleep_logs_user_id_night_date_key"` inside `catch`. Any other error is rethrown with `throw error;` as the last line inside the `catch`, so it still becomes a 500.
- "wake" flow: (1) SELECT the newest row's `id` for the user (`ORDER BY night_date DESC LIMIT 1`). (2) If one was found, UPDATE it by `id` with guards `wake_time IS NULL` and `bedtime > now() - interval '48 hours'`, and copy `result.rowCount` into a counter (`updatedCount`, declared with `let` outside the `if`). (3) If `updatedCount === 0`, INSERT a wake-only row inside `try`/`catch`. The INSERT is refused by the unique rule (becomes a 409) if a row for that night already exists.
- The buttons are for "now" only: they work on the newest night. Older nights are not rescued by the buttons.
- A night whose `wake_time` stays empty is left empty (NULL) in the database forever. The screen decides to show it as "Missed". Nothing is stored as "missed".
- The 48-hour window is a safety limit on the UPDATE (the newest row must have a recent bedtime). `ORDER BY ... LIMIT 1` can't go inside an UPDATE's WHERE in Postgres, so the SELECT comes first.
- Planned feature, "late entry" (a second-chance screen): list nights with an empty `wake_time` and let the user enter an assumed wake time. It will use a new route, probably PATCH (separate from `/api/sleep`), and the label `"entered later"`. The server must re-check everything: the row belongs to the user, `wake_time` is still empty, the time is after that row's bedtime, not in the future, and not an absurd sleep length. Leaning toward "fill empty only, never overwrite". It could also fill a missing bedtime on a wake-only row. A cap on how far back it reaches is undecided.
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
- `app/api/sleep/route.js`: `POST` is async. It reads the body, validates the action (400), and computes `nightDate`. The "sleep" block INSERTs four columns (`user_id`, `night_date`, `bedtime`, `bedtime_source`) inside `try`/`catch` ("sleep already logged today", 409). The "wake" block declares `let updatedCount = 0`, runs the SELECT for the newest row (`getInfo`), and if `getInfo.rows.length > 0` runs the guarded UPDATE by id and sets `updatedCount = result.rowCount`. If `updatedCount === 0`, it INSERTs a wake-only row inside `try`/`catch` ("wake already logged today", 409). `throw error;` is the last line inside each `catch`. It still has temporary `console.log` lines for the body, `nightDate`, and `getInfo.rows`. `GET` is still the temporary test (hardcoded id 1, no login), so remove or protect it before deploying.

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
- Built the "wake" action, first matching by the computed date.
- Restructured "wake": SELECT newest row, UPDATE by id with two guards, counter, and the wake-only INSERT fallback.
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
- Before the `if` blocks, the server reads the body with `request.json()`, validates the action (400), and computes `nightDate`, which both buttons use.
- A later "sleep" tap collides with a wake-only row of the same `night_date` and gets a 409, because the pair is already taken.

**Concepts still to learn (with a reminder to reread):**
- The `onClick` arrow function shape (practice writing it again).
- Padding (inside the box) vs margin (outside the box) in one line.
- Flex only arranges direct children of the flex container.
- Authentication vs authorization (and why `user_id` must come from the session, not the request).
- Why the database stores empty (NULL), not the word "missed". The screen decides the wording. (Used in the "Missed" decision, but not yet restated in my own words.)
- Primary key vs unique constraint, in my own words.
- CRUD, and how INSERT/SELECT/UPDATE/DELETE map to POST/GET/PUT or PATCH/DELETE.
- SQL shapes: INSERT has a column list, then `VALUES`, one `;` at the very end, and the columns, placeholders and values must line up one to one. UPDATE has `SET` (comma between items), then `WHERE`. In CHECK and in `WHERE`, `IS NULL` needs a column in front, and equality is a single `=`. `ORDER BY ... DESC LIMIT 1` gives the newest row.
- `ALTER TABLE ... ADD CONSTRAINT` for changing a table that already exists.
- `DELETE` and `UPDATE` always need a `WHERE`, or they hit every row.
- `UPDATE n` means n rows matched, not that n values changed (running it twice overwrote the wake time until the `IS NULL` guard was added). `UPDATE 0` doesn't say which guard refused: reason from the row's data.
- Hashing passwords, and which method to use (a real security decision, handle at login).
- HMR is a dev-only feature, not part of the app.
- Status code families: 400 bad request, 409 conflict, 500 server error.
- Variable scope: `const`/`let` inside curly braces only exists inside them. Declare the container (the counter) outside with `let`, and assign inside with no `let`. I spotted the scope problem myself, but my first fix stored a number instead of the result.
- Mix-ups to revisit: `getDay()` (day of the week) vs `getDate()` (day of the month); `{nightDate}` (a new object) vs `nightDate` (the value); a demo value left in real code (`returned_at`, `id = 1`); a closing brace or `throw error;` in the wrong block; `updatedCount.rowCount` vs `updatedCount`; a line that copies the result into the counter being forgotten.
- Test the success path too: a duplicate test alone couldn't reveal a misplaced `throw error;` or a counter that was never filled.

**Explained this session, not yet said back in my own words (practice later):**
- Pool vs client; why one shared pool.
- `result.rows` is always an array (`rows[0]` for one row, and `[]` when nothing matches, so check `rows.length` before reading `rows[0]`); `rowCount` matters for INSERT/UPDATE/DELETE.
- `bigint` values come back from `pg` as text (`'15'`, not `15`). Fine to pass back into a placeholder, but don't do math on them.
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
- The `[99]` test: without the `rows.length` check it would crash (500). With it, the fallback INSERT hits today's row for user 1 (the INSERT still uses user 1), so the result is a 409. The terminal shows `[]`.
- Why the restructure works: a wake tap now finds the newest row instead of guessing a date, and old forgotten nights stay untouched ("Missed") instead of being filled by a wake tap days later.

**Tests run:** no automated tests.
- Manual checks I reported (earlier): dev server starts, pages auto-update, `/history` renders, `/` shows Today, buttons match, a click logs and disables the button, refresh re-enables it (expected), a tap reaches `/api/sleep` with status 200, `/api/sleep` gave 405 until a `GET` was added, Docker container runs and logs "ready to accept connections", all three migrations applied, `\d users` and `\d sleep_logs` match the designs, valid inserts printed `INSERT 0 1`, and these were refused with the expected constraint names: duplicate username, duplicate email, duplicate (user, night), missing user (id 99), and a bad source label ("taped").
- Manual (reported): `/api/sleep` returns `[{"username":"testuser"}]`, and still works after adding `POSTGRES_HOST` and restarting. A typo, `result.row`, was caught and fixed to `result.rows`.
- Manual (reported): `Content-Type` was `text/plain;charset=UTF-8` with the `header` typo and `application/json` after the fix. A `banana` action got 400 and `sleep` got 200. `nightDate` printed `2026-11-05` for a 6:39 pm tap, `2026-11-04` for 3:00 am Nov 5, `2026-11-05` for 12:09 pm Nov 5, and `2026-10-31` for 3:00 am Nov 1.
- Manual (reported): "sleep" saved a row (user 1, real bedtime, `tapped`). A second tap gave 409 with no new row (it gave 500 before `try`/`catch`). A misspelled column name gave 500 with a red terminal error (rethrow works). After deleting the old row, a fresh "sleep" tap gave 200 and a new row (success path).
- Manual (reported, earlier "wake" version): "wake" with an existing row for that night updated it (200, no new row). A second "wake" tap gave 409 and left `wake_time` unchanged. A wake tap after noon missed the bedtime row (computed date was the next day) and created a wake-only row.
- In `psql`: the unguarded UPDATE printed `UPDATE 1` twice and overwrote the wake time. With `AND wake_time IS NULL`, it printed `UPDATE 0` and the row was unchanged. The "find the newest row" SELECT returned the expected ids. An UPDATE by id on row 12 printed `UPDATE 0` (wake time already filled), and on row 10 with `interval '1 hour'` printed `UPDATE 0` (bedtime too old).
- Manual (reported, restructured "wake" before the counter was added): sleep then wake gave 200 on the same row (id 18), and a second wake gave 409.
- Manual (reported, final code with the counter): "wake" with the newest row already filled and a recent bedtime created a wake-only row (the `wake_time IS NULL` guard refused the UPDATE, not the bedtime guard). A "sleep" tap after that wake-only row gave 409 (same `night_date`, expected for now). With the lookup changed to `[99]`, the terminal printed `[]` and the result was a 409. The lookup was changed back to `[1]`.
- Not yet re-checked on the final code: sleep then wake (expect 200, same row, no new row), then wake again (expect 409), and the bedtime guard on an older empty-wake row (a night more than 48 hours old should be left alone). Also not yet run: a request with no `action` (`{}`), and a 1 January year-boundary result through the app.

**Open decisions:** login approach, timezone handling, whether to write migration `004` now, how the taps identify the user before login exists (for now a hardcoded user id 1), and the late-entry details (overwrite or fill-empty only, how far back it may reach, where the screen lives, and whether it can fill a missing bedtime).

**Parked notes:**
- A "sleep" tap after a wake-only row for the same `night_date` is refused with 409. This happens when "awake" is tapped after noon without a bedtime (the wake-only row gets today's date). Late entry (with the `"entered later"` label) could fix it. Alternatively "sleep" could also try an UPDATE first.
- The wake-only fallback uses the computed `nightDate`, so a wake tap after noon creates a row dated today, not "the night that just ended".
- The UPDATE path doesn't check that the wake time is later than the bedtime.
- A wake-only row has no bedtime, so the bedtime guard (`bedtime > ...`) skips it (a NULL bedtime never satisfies it). That's fine today because such a row already has a wake time.
- Rows 4 and 10 are old practice rows with empty wake times and are now beyond the 48-hour window. They stay as they are and would show as "Missed".
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- Nothing in the database yet enforces "a time and its label are both filled or both empty." Planned as migration `004`. Valid cases: both filled, or both empty. A time with no label, or a label with no time, is invalid.
- `docs/Clockback_spec.md` may be older than the newer spec upload.
- `app/layout.js` and `app/history/page.js` are still placeholders (`history` is a likely home for the late-entry screen).
- The `console.log` lines in `POST` are temporary.
- The 409 messages are written from the server's view and may be reworded when the screen shows them.
- Check `.gitignore` for `!.env.example` before creating `.env.example` (setting names only). Add `POSTGRES_HOST` to it when it's created.
- Never commit `.env`. Commit `db/003_add_source_checks.sql`.
- The temporary `GET` in `/api/sleep` exposes data with no authentication. Remove it once real routes exist.

**Blockers:** none.

**Next smallest step:** (1) Re-check the final "wake" code quickly: tap "sleep", then "awake" (expect 200 and the same row filled), then "awake" again (expect 409). Report the statuses and a `SELECT * FROM sleep_logs;`. (2) Then plan the late-entry feature using the `project-planning` approach (planning only, no code): what the screen shows, what the new route receives, the server checks, and the open decisions above. Smaller options if I'd rather wait on that: remove the temporary `console.log` lines, add the "wake not before bedtime" check on the UPDATE path, or decide whether to write migration `004`.