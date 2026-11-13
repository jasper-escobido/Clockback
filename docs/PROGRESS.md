# PROGRESS.md: Clockback

**Current stage:** Today page at `/` has two reusable buttons. Tapping one sends a POST to `/api/sleep` with a JSON body, `{action: "sleep"}` or `{action: "wake"}`. The server validates the action (400 if it is neither) and works out `night_date` with the noon cutoff. "sleep" INSERTs a `sleep_logs` row for temporary user id 1 (bedtime = exact tap moment, source "tapped"). "wake" looks up the user's newest row, then UPDATEs it by `id` only if its `wake_time IS NULL`, its bedtime is within 48 hours, and its bedtime is before the new wake time. If nothing was updated (no row found, or a guard refused it), it INSERTs a wake-only row. Duplicates for either action return 409 with a message, and any other error is rethrown as a 500. All paths tested by hand. Known limits are in the parked notes. No login.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js (App Router), React, Tailwind, PostgreSQL, in plain JavaScript.

**How I'm learning:** Guided Learning level. I'm still building my understanding of how requests travel and of backend work, so explain concepts first, give small generic examples on made-up tables (not my exact answer), and let me write my own code. Don't give full ready-to-paste functions unless I ask. One focused question at a time. Corrections welcome. The general mentor instructions are now adaptive, so this section is what sets my preferred level here. Change it in this section if my needs change.

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
- "Wake time not before bedtime" is only checked when both times exist. Implemented on the wake UPDATE path as the guard `bedtime < $1` (`$1` is the wake time being saved, reused from the `SET`). A tap can never fail it because the wake time is "now", so it matters most for late entry. A database CHECK for it is still optional (could go in migration `004`).
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
- "wake" flow: (1) SELECT the newest row's `id` for the user (`ORDER BY night_date DESC LIMIT 1`). (2) If one was found, UPDATE it by `id` with three guards (`wake_time IS NULL`, `bedtime > now() - interval '48 hours'`, `bedtime < $1`), and copy `result.rowCount` into a counter (`updatedCount`, declared with `let` outside the `if`). (3) If `updatedCount === 0`, INSERT a wake-only row inside `try`/`catch`. The INSERT is refused by the unique rule (becomes a 409) if a row for that night already exists.
- The buttons are for "now" only: they work on the newest night. Older nights are not rescued by the buttons.
- A night whose `wake_time` stays empty is left empty (NULL) in the database forever. The screen decides to show it as "Missed". Nothing is stored as "missed".
- The 48-hour window is a safety limit on the UPDATE (the newest row must have a recent bedtime). `ORDER BY ... LIMIT 1` can't go inside an UPDATE's WHERE in Postgres, so the SELECT comes first.
- Late entry (decided in planning on 2026-11-10, not built; spec updated to match): a second-chance screen for **yesterday's night only**, meaning the night before the current `night_date` (noon cutoff), not the calendar day before today. It covers four situations: a missing wake time, a missing bedtime, no row at all (forgot both), and replacing a time already saved. The user types **clock times only**, in the 12-hour form (hour, minute, am/pm). The server resolves the dates with the noon window (night D runs from noon on D to noon on D+1): a bedtime from 12:00 to 23:59 is on D, a bedtime from 00:00 to 11:59 is on D+1, and a wake time is the first time that clock reading happens after the bedtime (so 1 pm wake-ups still work). The same rule as a method, used in the code: find the bedtime as the first moment at or after noon on `night_date` with the typed reading, then find the wake as the first moment strictly after the bedtime with the typed reading. A wake typed with the same reading as the bedtime lands 24 hours later and is refused by the cap. Every time saved this way is labeled `"entered later"`, including replacements (the original tapped value is not kept). Server checks: the row belongs to the user, the night is yesterday's, the times are real, nothing is in the future, the wake is after the bedtime (checked against the saved time when only one is changed), and a typed sleep is at most 12 hours with no minimum. The cap applies to typed times only, never to taps, and the number lives in one named place in `lib/`. It needs a new route separate from `/api/sleep` (method undecided, since forgot-both creates a row and the others change one). The replace path does not use the `wake_time IS NULL` guard. Its guards are ownership and "yesterday's night".
- The user types times on a 12-hour clock (hour, minute, am/pm). The server converts them to the 24-hour clock before resolving, so the resolver never deals with am/pm. 12 am becomes 0, 12 pm stays 12, any other am hour stays the same, and any other pm hour adds 12.
- The clock-time resolver is built in four pieces, in order: (1) 12-hour to 24-hour conversion (done), (2) `firstMomentAfter`, the first moment after a starting point with a given 24-hour clock reading (done), (3) `hoursBetween`, the length in hours between two moments (done), (4) `resolveNight(windowStart, bedHour, bedMinute, wakeHour, wakeMinute)`, which combines them, refuses a sleep over the 12-hour cap, and returns an object: `{ ok: false, reason: "too_long" }` or `{ ok: true, bedtime, wake, hours }` (not written yet). The caller converts am/pm with `to24Hour` first, so the resolver only sees hours 0 to 23. Written as plain functions in `lib/nightTimes.js`, tried with `node` before any route uses them.
- The conversion function assumes the hour is 1 to 12. Checking that the hour is 1 to 12, the minute is 0 to 59, and the period is "am" or "pm" is the caller's job (the route, later).
- `LEARNING_NOTES.md` (drafted by AI, saved by me) holds reusable technical knowledge. `PROGRESS.md` stays for project state only.
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
- `app/api/sleep/route.js`: `POST` is async. It reads the body, validates the action (400), and computes `nightDate`. The "sleep" block INSERTs four columns (`user_id`, `night_date`, `bedtime`, `bedtime_source`) inside `try`/`catch` ("sleep already logged today", 409). The "wake" block declares `let updatedCount = 0`, runs the SELECT for the newest row (`getInfo`), and if `getInfo.rows.length > 0` runs the guarded UPDATE by id (three guards: `wake_time IS NULL`, bedtime within 48 hours, bedtime before the new wake time `$1`) and sets `updatedCount = result.rowCount`. If `updatedCount === 0`, it INSERTs a wake-only row inside `try`/`catch` ("wake already logged today", 409). `throw error;` is the last line inside each `catch`. The temporary `console.log` lines were removed (reported). `GET` is still the temporary test (hardcoded id 1, no login), so remove or protect it before deploying.
- `lib/nightTimes.js` (not used by any route yet): `to24Hour(hour, period)` (12 pm returns 12, 12 am returns 0, any other pm returns `hour + 12`, anything else returns `hour`); `firstMomentAfter(start, hour, minute)` (copies `start`, sets hour and minute with seconds and milliseconds zeroed via `setHours(hour, minute, 0, 0)`, and moves the copy to the next day when it is not strictly after `start`, using `<=`); `hoursBetween(bedtime, waketime)` using `MS_PER_HOUR`; and a constant `MAX_TIME_LIMIT = 12` (could be renamed `MAX_SLEEP_HOURS`). Temporary `console.log` test calls at the bottom, run with `node lib/nightTimes.js`. `resolveNight` is not written yet.

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
- Re-checked the final "wake" code by hand: sleep then awake gave 200 on the same row, and a second awake gave 409 (2026-11-08).
- Found and explained an overlap case: tapping sleep and awake almost at once gives a 409 on awake because the lookup runs before the sleep INSERT finishes (2026-11-08).
- Tested a request with no `action` (`{}`): 400, no new row (2026-11-08).
- Tested the 48-hour guard on a row with an empty wake time and a bedtime moved back 3 days: refused silently, then 409 from the fallback INSERT, `wake_time` stayed empty (2026-11-08).
- Removed the three temporary `console.log` lines from `POST` (2026-11-08).
- Added the `bedtime < $1` guard to the wake UPDATE and re-ran sleep then awake: 200 and 200, registered in the table (2026-11-08).
- Planned the late-entry feature step by step (2026-11-10): scope, clock-time-only entry, the noon-window rule, replace-allowed, `"entered later"` on every typed time, 12-hour cap. Updated the spec to match.
- Decided the 12-hour clock for typing, with conversion to 24-hour inside (2026-11-10). Worked six resolver examples by hand and learned the walk-forward method (start from noon for the bedtime, then from the bedtime for the wake).
- Wrote piece 1 of the resolver in `lib/nightTimes.js`: a function with two inputs, an `if` for the pm rule, and the two 12 exceptions checked before the general rule (2026-11-10).
- Ran the file with `node`: all four calls (5 am, 12 am, 12 pm, 5 pm) printed 5, 0, 12, 17 (reported 2026-11-10). Piece 1 of the resolver is done.
- Wrote piece 2, `firstMomentAfter` (2026-11-13). My own test with a 1:59:50 start exposed a seconds bug (output `02:00:50`), fixed by `setHours(hour, minute, 0, 0)`. Checked the `<=` rule by running it with `<` too: the equal case then fails to move forward (reverted to `<=`).
- Wrote piece 3, `hoursBetween`, with `MS_PER_HOUR` (2026-11-13). Three tests matched the expected values.

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
- What the first two wake UPDATE guards do: `IS NULL` stops a second tap from overwriting the wake time, and the bedtime guard refuses a row whose bedtime is older than 48 hours.
- A misspelled column name makes the database refuse the query, so it is a thrown error and the user sees a 500.
- Why the specific checks (12 am, 12 pm) go before the general pm rule: `return` ends the function, so a general rule placed first would catch the 12 before the exception ran.
- Why `hour === 12` is safer than `hour > 11`: a bad hour like 13 falls through to an obviously wrong answer instead of being quietly treated as 12.
- Why `firstMomentAfter` needs `<=` and not `<`: when the start is exactly the reading, the copy equals the start, `<` would skip the move and return the start itself, and `<=` moves it to the next day (I traced this and confirmed it by running both versions).
- Piece 3 in my own words: subtract the two dates to get milliseconds, then divide by the milliseconds in an hour (`MS_PER_HOUR`).

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
- More mix-ups to revisit: a lookup that finds nothing is not an error (I guessed `[99]` would throw a 500 that the 409 overrides); the bedtime guard reads `bedtime`, not `night_date`; the button label ("awake") vs the action value the server sees ("wake"); `if` decides, `catch` receives the thrown error.
- Resolver mix-ups to revisit: the date on a timestamp vs the night's label (a 3:00 am bedtime for night Nov 7 is Nov 8 3:00 am, because Nov 7 3:00 am is before the night starts at noon); counting sleep length (12:30 am to 9:00 am is 8 h 30 min, not 9 h 30 min); assuming 12 am is "normal" (it is 0 on the 24-hour clock); `return` followed by a line break returns nothing; a single `=` assigns while `===` compares (`return hour = 12` works by accident); a call with too few arguments leaves the missing one `undefined`; file names are case-sensitive on Linux and in deployment.
- More resolver mix-ups to revisit: a "reading" is the target clock time being searched for (it does not come from the start), and it is on the 24-hour clock; a `Date` has no am/pm, so passing `2` means 2 am and 2 pm must arrive as `14` (that is `to24Hour`'s job, and only the exact text `"pm"` counts as pm); I predicted "2 pm" for the reading `2, 0`; I typed `3,600,00` (missing a zero, and commas are not allowed in numbers in code); inputs (supplied by the caller) vs values made inside a function by its body lines (return values of other calls); a function can be an input in JavaScript (a callback), but we are not doing that here.

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
- A query has three outcomes: rows found, an empty `rows: []` with no error (a lookup like `[99]` matches nothing), or a thrown error. Only the third reaches a `catch`.
- A 409 on awake needs two things: the UPDATE matched no row (silent, `updatedCount` stays `0`), and the fallback INSERT then repeats an existing (user, night) pair, so Postgres throws and the `catch` returns the 409. `if (updatedCount === 0)` only decides whether the fallback runs. The `catch` receives the INSERT's error, and the database's unique rule makes the decision.
- Race condition: two requests that overlap can read before the other has written. The sleep/awake overlap gave a 409 because the lookup found an older row, not because the timestamps matched.
- A request's status line prints when it finishes, so lines can appear out of order. `console.log(body)` prints the body that arrived, not the response status.
- `$1` can be used more than once in one query as long as the values array holds one value for it.
- Noon window for typed times: night D covers noon on D to noon on D+1, so a bedtime on either side of midnight lands on the right date. A wake time is tied to the bedtime (the first matching clock time after it), not to the window, because wake-ups can fall after noon. "Yesterday" means the night before the current `night_date`, not the calendar day before today.
- `night_date` labels the night and the timestamp is when it really happened, so one night can hold times on two calendar dates. (A normal sleep then awake does not create a new row: awake fills in the existing row. A wake-only row appears only when no row is waiting.)
- The walk-forward method: both times use one idea, "the first time this clock reading happens after a starting point". The bedtime starts at noon on the night's date, and the wake starts at the bedtime. The user types 12-hour times and the conversion to the 24-hour clock happens before this.
- Basics of running a function by hand: `function`, parameters, `return`, a call is the name plus `()`, `console.log` prints to the terminal, `node file.js` runs one file from the project root. `export` is only needed when another file imports the function.
- `&&` means both conditions must be true, and `if` blocks are checked top to bottom.
- A `Date` holds a time of day on four dials (hours, minutes, seconds, milliseconds). A `set...` call changes only the dials it names, so `setHours(h, m, 0, 0)` sets all four. `new Date(start)` makes a copy so `start` is not changed. Months count from 0 (November is 10). Dates compare with `<`, `<=`, `>`, but not with `===`. Subtracting two dates gives milliseconds.
- Calling functions from inside another function: the return value of one call can be kept in a named variable and passed to the next call. The five parameters of `resolveNight` are inputs from the caller. `bedtime`, `wake`, and `hours` are made inside.
- A function can return an object like `{ ok: false, reason: "too_long" }`, and the caller checks `ok` first. Named constants (`MS_PER_HOUR`) beat magic numbers.

**Tests run:** no automated tests.
- Manual checks I reported (earlier): dev server starts, pages auto-update, `/history` renders, `/` shows Today, buttons match, a click logs and disables the button, refresh re-enables it (expected), a tap reaches `/api/sleep` with status 200, `/api/sleep` gave 405 until a `GET` was added, Docker container runs and logs "ready to accept connections", all three migrations applied, `\d users` and `\d sleep_logs` match the designs, valid inserts printed `INSERT 0 1`, and these were refused with the expected constraint names: duplicate username, duplicate email, duplicate (user, night), missing user (id 99), and a bad source label ("taped").
- Manual (reported): `/api/sleep` returns `[{"username":"testuser"}]`, and still works after adding `POSTGRES_HOST` and restarting. A typo, `result.row`, was caught and fixed to `result.rows`.
- Manual (reported): `Content-Type` was `text/plain;charset=UTF-8` with the `header` typo and `application/json` after the fix. A `banana` action got 400 and `sleep` got 200. `nightDate` printed `2026-11-05` for a 6:39 pm tap, `2026-11-04` for 3:00 am Nov 5, `2026-11-05` for 12:09 pm Nov 5, and `2026-10-31` for 3:00 am Nov 1.
- Manual (reported): "sleep" saved a row (user 1, real bedtime, `tapped`). A second tap gave 409 with no new row (it gave 500 before `try`/`catch`). A misspelled column name gave 500 with a red terminal error (rethrow works). After deleting the old row, a fresh "sleep" tap gave 200 and a new row (success path).
- Manual (reported, earlier "wake" version): "wake" with an existing row for that night updated it (200, no new row). A second "wake" tap gave 409 and left `wake_time` unchanged. A wake tap after noon missed the bedtime row (computed date was the next day) and created a wake-only row.
- In `psql`: the unguarded UPDATE printed `UPDATE 1` twice and overwrote the wake time. With `AND wake_time IS NULL`, it printed `UPDATE 0` and the row was unchanged. The "find the newest row" SELECT returned the expected ids. An UPDATE by id on row 12 printed `UPDATE 0` (wake time already filled), and on row 10 with `interval '1 hour'` printed `UPDATE 0` (bedtime too old).
- Manual (reported, restructured "wake" before the counter was added): sleep then wake gave 200 on the same row (id 18), and a second wake gave 409.
- Manual (reported, final code with the counter): "wake" with the newest row already filled and a recent bedtime created a wake-only row (the `wake_time IS NULL` guard refused the UPDATE, not the bedtime guard). A "sleep" tap after that wake-only row gave 409 (same `night_date`, expected for now). With the lookup changed to `[99]`, the terminal printed `[]` and the result was a 409. The lookup was changed back to `[1]`.
- Manual (reported, final code, 2026-11-08): sleep then awake gave 200 on the same row, and a second awake gave 409. Tapping sleep and awake almost at once gave a 409 on awake (overlap case, see parked notes). With a few seconds between taps it gave 200.
- Manual (reported): a `{}` request from the browser console returned 400. The terminal printed `{}` and the 400 status line, no `nightDate` line printed, and no row was added.
- Manual (reported): after `UPDATE sleep_logs SET wake_time = NULL, wake_time_source = NULL, bedtime = now() - interval '3 days' WHERE id = 28;`, an awake tap gave 409 and `wake_time` stayed empty (the bedtime guard refused the UPDATE, then the fallback INSERT hit the unique rule). My first version of that statement changed `night_date` instead of `bedtime`, which would have tested something else.
- Manual (reported): after removing the `console.log` lines, sleep then awake gave 200 and 200. After adding `bedtime < $1`, sleep then awake gave 200 and 200 and the table showed the row filled.
- Worked by hand (no code, reported answers): night Nov 7 with bedtime 3:00 and wake 11:00 (first answer had the bedtime on the wrong date, corrected to Nov 8 3:00 am to Nov 8 11:00 am, 8 hours); 10 pm to 11 am (13 hours, refused by the cap); 12:30 am to 9:00 am (Nov 8, 8 h 30 min); 5:20 am to 1:00 pm (Nov 8, 7 h 40 min, matches the spec).
- Manual (reported, 2026-11-10): `node lib/nightTimes.js` with four calls printed 5, 0, 12, 17 (5 am, 12 am, 12 pm, 5 pm), matching the expected table. All four paths of the conversion function are checked. Pieces 2 and 3 were written and tested afterwards (see below).
- Manual (reported, 2026-11-13), piece 2 `firstMomentAfter`: start Nov 7 1:59:50 am with reading 2:00 gives Nov 7 2:00:00 am (before the fix it gave 2:00:50); start Nov 7 6:00 pm with 2:00 gives Nov 8 2:00 am; start Nov 7 3:00 pm with 7:00 gives Nov 8 7:00 am (my first expected answer said 7 pm, which was my mistake: the reading is on the 24-hour clock, so 7 pm is 19); start Nov 30 11:00 pm with 2:00 gives Dec 1 2:00 am; start Nov 7 3:00 pm with 19:00 gives Nov 7 7:00 pm; start Nov 7 exactly 2:00:00 am with 2:00 gives Nov 8 2:00 am with `<=` and Nov 7 2:00 am with `<`.
- Manual (reported), piece 3 `hoursBetween`: Nov 8 5:20 am to 1:00 pm gave 7.666666666666667; Nov 7 10:00 pm to Nov 8 11:00 am gave 13; Nov 8 12:30 am to 9:00 am gave 8.5.
- Not yet seen: the `bedtime < $1` guard actually refusing a request (a tap can't trigger it, so it needs late entry). Not yet run: a 1 January year-boundary result through the app.

**Open decisions:** login approach, timezone handling (see parked notes), whether to write migration `004` now, how the taps identify the user before login exists (for now a hardcoded user id 1), the noon boundary for a bedtime typed 12:00 pm (see parked notes), and the remaining late-entry details: the route's name and method, where the screen lives (`history` is a likely home), how the screen asks the server what is missing, how the screen collects 12-hour times (hour, minute, am/pm) and checks them before sending, and what to do about an after-noon wake-only row (see parked notes).

**Parked notes:**
- A "sleep" tap after a wake-only row for the same `night_date` is refused with 409. This happens when "awake" is tapped after noon without a bedtime (the wake-only row gets today's date). Late entry (with the `"entered later"` label) could fix it. Alternatively "sleep" could also try an UPDATE first.
- The wake-only fallback uses the computed `nightDate`, so a wake tap after noon creates a row dated today, not "the night that just ended".
- The wake UPDATE now has `bedtime < $1`, but a tap can't fail it, so it hasn't been seen refusing anything. Test it with late entry. The database has no CHECK for it yet.
- A wake-only row has no bedtime, so the bedtime guard (`bedtime > ...`) skips it (a NULL bedtime never satisfies it). That's fine today because such a row already has a wake time.
- Rows 4 and 10 are old practice rows with empty wake times and are now beyond the 48-hour window. They stay as they are and would show as "Missed".
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- Nothing in the database yet enforces "a time and its label are both filled or both empty." Planned as migration `004`. Valid cases: both filled, or both empty. A time with no label, or a label with no time, is invalid.
- `docs/Clockback_spec.md` should be replaced with the updated spec (late-entry decisions added). Its status line still says "planned only, nothing is built". Reword it when convenient.
- `app/layout.js` and `app/history/page.js` are still placeholders (`history` is a likely home for the late-entry screen).
- The 409 messages are written from the server's view and may be reworded when the screen shows them.
- Check `.gitignore` for `!.env.example` before creating `.env.example` (setting names only). Add `POSTGRES_HOST` to it when it's created.
- Never commit `.env`. Commit `db/003_add_source_checks.sql`.
- The temporary `GET` in `/api/sleep` exposes data with no authentication. Remove it once real routes exist.
- Two taps sent almost at once (sleep then awake within ~250 ms) can overlap: the awake lookup runs before the sleep INSERT finishes, finds the older row, and gets a 409. Only happens on rapid testing. The unique rule kept the data clean. Revisit only if it happens in real use.
- Row 28 was deleted. The latest row is 32 and is complete (from earlier tests).
- Interaction to decide: an awake tap after noon with no bedtime creates a wake-only row dated **today**, but the night it belongs to is yesterday's. Late entry for yesterday would then see "no row", and the stray row dated today would stay. Options for later: let late entry notice and fold such a row in, or change how the awake tap picks its night. Not decided.
- Timezone reminder: the date functions use the computer's local time (mine is Philippine Standard Time, GMT+8). A deployed server often runs in UTC, so `new Date(y, m, d, h)` and `getHours()` can behave differently there. `.toString()` shows local time and a plain `console.log(date)` shows UTC. Needs a decision before deploying.
- Boundary to settle in `resolveNight`: the spec says the bedtime is the first moment at or after noon on the night's date, but `firstMomentAfter` is strictly after. A bedtime typed 12:00 pm equals the window start, so `firstMomentAfter(windowStart, 12, 0)` returns the next day's noon. I asked this and have not answered it yet.
- Optional tidy-ups in `lib/nightTimes.js`: `1 * 3600000` could be `60 * 60 * 1000`, and `MAX_TIME_LIMIT` could be `MAX_SLEEP_HOURS`.

**Blockers:** none.

**Next smallest step:** Piece 4, `resolveNight(windowStart, bedHour, bedMinute, wakeHour, wakeMinute)` in `lib/nightTimes.js`, one step at a time. Step 1: `bedtime` = `firstMomentAfter` called with the window start and the bedtime reading (check the parameter order), plus a temporary `console.log(bedtime.toString())`. Then: step 2 the wake, walking forward from `bedtime`; step 3 `hoursBetween`; step 4 if the hours are over the cap (`>`, so exactly 12 is allowed) return `{ ok: false, reason: "too_long" }`; step 5 otherwise return `{ ok: true, bedtime, wake, hours }`. Window start for night Nov 7 is `new Date(2026, 10, 7, 12, 0, 0, 0)`. Expected tests: 5:20 am to 1:00 pm gives ok, Nov 8 5:20 am to Nov 8 1:00 pm, 7.67 h (`5, 20` and `13, 0`); 10:00 pm to 11:00 am is refused, too_long, 13 h (`22, 0` and `11, 0`); 12:30 am to 9:00 am gives ok, 8.5 h (`0, 30` and `9, 0`); 11:00 pm to 7:00 am gives ok, Nov 7 11 pm to Nov 8 7 am, 8 h (`23, 0` and `7, 0`). Also settle the 12:00 pm bedtime boundary. After that: the read side, the write route, and the screen.

**Where the last session stopped (handoff):** I was mid-way through understanding inputs vs values made inside a function. The last open question was: of `windowStart`, `bedtime`, `wake`, and `hours`, which does the caller supply and which are created by lines inside `resolveNight`? (Answer to confirm: only `windowStart` is supplied, together with the four hour/minute inputs. `bedtime`, `wake`, and `hours` are made inside.) Step 1 of `resolveNight` has not been written yet.