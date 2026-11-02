# PROGRESS.md: Clockback

**Current stage:** Today page at `/` has two reusable buttons. Tapping one logs its action, disables it until refresh, and sends a POST to `/api/sleep`, which replies "Connected". Nothing is saved yet. No database or login. The users and sleep log tables and the wake-tap rules are planned in plain words only.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js (App Router), React, Tailwind, PostgreSQL, in plain JavaScript.

**Decisions made:**
- (all earlier decisions unchanged)
- Today page lives at `/` in `app/page.js`. Reusable UI goes in `components/` at the project root.
- `page.js` stays a Server Component and passes only plain text props (`label`, `action`). Only `ActionButton.js` is `"use client"`.
- The server and the database are the trusted layers. The page (disabled button, form checks) is only a convenience.
- Planned users table: id (automatic, unique), username (unique), email (unique), password hash. None can be empty. Passwords stored only as hashes.
- Planned sleep log table: owner user id (foreign key, never empty), night date (never empty, assigned by the server and saved once), bedtime (can be empty), wake time (can be empty), and a source label for each time ("tapped" or "entered later").
- A time's label is empty exactly when its time is empty. Server checks the pairing first; a database constraint is the backstop.
- "Wake time not before bedtime" is only checked when both times exist.
- If "I'm awake" is tapped and no night is waiting for a wake time, the server creates a row with only a wake time (bedtime empty, shown as "missed"). It gets the night that just ended, so "Fill in yesterday" can add the bedtime.
- Visual polish (design skill) waits until more of the skeleton exists.

**Current code state:**
- `app/page.js`: parent `div` (`flex flex-col gap-2 m-6`), `h1` "Today", two `<ActionButton>` tags with `label` + `action` ("sleep", "wake").
- `components/ActionButton.js`: `"use client"`, `useState` for `hasTapped`, `onClick` runs `setHasTapped(true)`, logs `props.action`, and calls `fetch("/api/sleep", { method: "POST" })`. `disabled={hasTapped}` is on the `<button>`. Both buttons send the same request.
- `app/api/sleep/route.js`: `export function POST()` returns `Response.json("Connected")`. A temporary `GET` experiment may still be in the file.

**Done so far:**
- Next.js project set up, first commit local only. Node v24.22.2.
- Today page and reusable `ActionButton` built; phone-width layout checked in Chrome DevTools.
- Fixed the 500 error with `"use client"`; added `useState` and `disabled`.
- First route handler built and reached from a tap (status 200, body "Connected").
- Planned users and sleep log tables, and decided the wake-without-bedtime behavior.

**Concepts I can explain:** (my own words)
- File-based routing; `page.js` in `app/` renders at `/`.
- Why VS Code keeps its old environment until restart.
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

**Concepts still to learn:**
- The `onClick` arrow function shape (practice writing it again)
- Padding (inside the box) vs margin (outside the box) in one line
- Flex only arranges direct children of the flex container
- Authentication vs authorization
- Why the database stores empty, not the word "missed"
- Foreign key and unique constraint in my own words
- Hashing passwords, and which method to use

**Tests run:** no automated tests. Manual checks I reported: dev server starts, pages auto-update, `/history` renders, `/` shows Today, both buttons match, a click logs and disables the button, refresh re-enables it (expected), a tap reaches `/api/sleep` with status 200, and visiting `/api/sleep` gave 405 until a `GET` was added.

**Open decisions:** how the app talks to Postgres (query library or ORM), login approach, timezone handling.

**Parked notes:**
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- "I'm awake" attaches to the latest night with no wake time. What if that night is several days old? Decide later.
- The spec says either time can be empty (an earlier hint saying bedtime is always filled was corrected).
- `docs/Clockback_spec.md` may be older than the newer spec upload.
- `app/layout.js` and `app/history/page.js` are still placeholders.
- Both buttons send the same request; they need to use `props.action` to differ.
- Commit the new work to Git (nothing since the first commit).

**Blockers:** none.

**Next smallest step:** choose how the app talks to Postgres (query library or ORM), starting with understanding what each one does.