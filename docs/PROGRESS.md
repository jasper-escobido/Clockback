# PROGRESS.md: Clockback

**Current stage:** Today page at `/` has two reusable buttons. Tapping one logs its action, disables it until refresh, and sends a POST to `/api/sleep`, which replies "Connected". A local Postgres 18 database runs in Docker, and the `users` table exists and matches the design. Nothing is saved from the app yet. No login, no sleep log table, no database connection from Next.js.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js (App Router), React, Tailwind, PostgreSQL, in plain JavaScript.

**Decisions made:**
- (all earlier decisions unchanged)
- Today page lives at `/` in `app/page.js`. Reusable UI goes in `components/` at the project root.
- `page.js` stays a Server Component and passes only plain text props (`label`, `action`). Only `ActionButton.js` is `"use client"`.
- The server and the database are the trusted layers. The page (disabled button, form checks) is only a convenience.
- Write SQL by hand with a query library (planned: `pg`, check current docs before installing), to learn how the app and database communicate. No ORM for now.
- Practice against a local Docker Postgres first. Move to a hosted database later by re-running the migration files, not by copying data. Match the host's Postgres version before deploying.
- Table changes live in numbered files in `db/` (`001_...sql`, `002_...sql`). After a file has run, changes go in a new file.
- Users table (built): `id` bigint identity primary key, `username` text unique not null, `email` text unique not null, `password_hash` text not null, `created_at` timestamptz not null default `CURRENT_TIMESTAMP`. Passwords stored only as hashes.
- Planned sleep log table: owner user id (foreign key to `users.id`, never empty, same type as `id`), night date (never empty, assigned by the server and saved once), bedtime (can be empty), wake time (can be empty), and a source label for each time ("tapped" or "entered later").
- A time's label is empty exactly when its time is empty. Server checks the pairing first; a database constraint is the backstop.
- "Wake time not before bedtime" is only checked when both times exist.
- If "I'm awake" is tapped and no night is waiting for a wake time, the server creates a row with only a wake time (bedtime empty, shown as "missed"). It gets the night that just ended, so "Fill in yesterday" can add the bedtime.
- Visual polish (design skill) waits until more of the skeleton exists.

**Local database setup (how to get back to it):**
- Settings live in `.env` (git-ignored by `.env*`): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`. Format is `NAME=value`, no spaces, no quotes. Never paste the password anywhere.
- Container was started with: `docker run -d --name clockback --env-file .env -p 5432:5432 -v postgres:/var/lib/postgresql postgres:18` (run from the project root). The volume keeps tables when the container is deleted.
- Check it is running: `docker ps`. Logs: `docker logs clockback`. After a reboot, start it again with `docker start clockback`.
- Open a SQL prompt: `docker exec -it clockback psql -U <user> -d <database>`. Useful there: `\dt` (list tables), `\d users` (columns), `\q` (leave).
- Run a migration file: `docker exec -i clockback psql -U <user> -d <database> < db/001_create_users.sql`
- Docker permission fix that worked: added my user to the `docker` group, then restarted the laptop.

**Current code state:**
- `app/page.js`: parent `div` (`flex flex-col gap-2 m-6`), `h1` "Today", two `<ActionButton>` tags with `label` + `action` ("sleep", "wake").
- `components/ActionButton.js`: `"use client"`, `useState` for `hasTapped`, `onClick` runs `setHasTapped(true)`, logs `props.action`, and calls `fetch("/api/sleep", { method: "POST" })`. `disabled={hasTapped}` is on the `<button>`. Both buttons send the same request.
- `app/api/sleep/route.js`: `export function POST()` returns `Response.json("Connected")`. A temporary `GET` experiment may still be in the file.
- `db/001_create_users.sql`: the users table definition, already applied.
- `.env` exists locally and is not tracked by Git.

**Done so far:**
- Next.js project set up, first commit local only. Node v24.22.2.
- Today page and reusable `ActionButton` built; phone-width layout checked in Chrome DevTools.
- Fixed the 500 error with `"use client"`; added `useState` and `disabled`.
- First route handler built and reached from a tap (status 200, body "Connected").
- Designed the users and sleep log tables in plain words, and decided the wake-without-bedtime behavior.
- Docker working, Postgres 18 container running with a volume, `.env` created and ignored by Git.
- Wrote and ran the first migration; verified the `users` table with `\d users`.

**Concepts I can explain:** (my own words)
- File-based routing; `page.js` in `app/` renders at `/`.
- Why VS Code keeps its old environment until restart (and why a group change needed a full restart).
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
- Why SQL by hand instead of an ORM: to understand the pattern, not memorize.
- Why save table definitions in files: record, repeat, rebuild.

**Concepts still to learn (with a reminder to reread):**
- The `onClick` arrow function shape (I forgot it once; practice writing it again).
- Padding (inside the box) vs margin (outside the box) in one line.
- Flex only arranges direct children of the flex container.
- Authentication vs authorization.
- Why the database stores empty (NULL), not the word "missed". The screen decides the wording.
- Foreign key: a column holding another table's id (for example the sleep log's owner).
- Unique constraint vs primary key: primary key identifies each row (one per table, implies unique and not empty); unique just forbids repeats.
- `timestamptz`: stores one exact moment, shown in the session's time zone. It does not keep the zone name.
- Hashing passwords, and which method to use (a real security decision, handle at login).
- HTTP methods: GET reads, POST saves; the function name must match exactly.
- Docker basics: image vs container vs volume; `--env-file`, `-p`, `-v`.
- What `.env` is for, and why code reads `process.env.NAME` instead of copying values.
- HMR (hot module replacement) is a dev-only feature, not part of the app.

**Tests run:** no automated tests. Manual checks I reported: dev server starts, pages auto-update, `/history` renders, `/` shows Today, both buttons match, a click logs and disables the button, refresh re-enables it (expected), a tap reaches `/api/sleep` with status 200, visiting `/api/sleep` gave 405 until a `GET` was added, Docker container is up and logs "ready to accept connections", the migration printed `CREATE TABLE`, and `\d users` matches the design.

**Open decisions:** login approach, timezone handling, exact `pg` setup (connection settings and where the connection code lives, probably `lib/`).

**Parked notes:**
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- "I'm awake" attaches to the latest night with no wake time. What if that night is several days old? Decide later.
- The spec says either time can be empty (an earlier hint saying bedtime is always filled was corrected).
- `docs/Clockback_spec.md` may be older than the newer spec upload.
- `app/layout.js` and `app/history/page.js` are still placeholders.
- Both buttons send the same request; they need to use `props.action` to differ.
- Check `.gitignore` for `!.env.example` before creating `.env.example` (setting names only, no values).
- Commit the new work to Git. Nothing since the first commit, and `db/001_create_users.sql` is new. Never commit `.env`.

**Blockers:** none.

**Next smallest step:** learn the shape of a row-adding SQL command by adding one test user in `psql` (fake values, throwaway hash text), then check it with a read command. After that, design the sleep log table the same way.