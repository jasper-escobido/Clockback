# PROGRESS.md: Clockback

**Current stage:** Today page at `/` has two reusable, interactive buttons. Tapping one logs its action to the Console and disables it until refresh. Nothing is saved yet. No server route, database, or login.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js (App Router), React, Tailwind, PostgreSQL, in plain JavaScript.

**Decisions made:**
- (all earlier decisions unchanged)
- The Today page lives at `/`, in `app/page.js`. There is no separate `app/today` route.
- Reusable UI pieces go in `components/` at the project root, not inside `app/`.
- Button styling lives in one place (`ActionButton`) so both buttons always match.
- Page-edge spacing lives on the page's parent `div` (`m-6`), not on `ActionButton`, so the button stays reusable.
- `page.js` stays a Server Component. Only `ActionButton.js` is marked `"use client"`.
- `page.js` passes plain text props (`label`, `action`) to each button. It does not pass functions, because functions can't travel from server to browser.
- Visual polish (design skill) waits until more of the skeleton exists.

**Current code state:**
- `app/page.js`: parent `div` with `flex flex-col gap-2 m-6`, an `h1` "Today", and two `<ActionButton>` tags with `label` + `action` props (`"sleep"` and `"wake"`).
- `components/ActionButton.js`: `"use client"`, imports `useState`, holds `const [hasTapped, setHasTapped] = useState(false)`. The `onClick` calls `setHasTapped(true)` and logs `props.action`. The `<button>` should have `disabled={hasTapped}` as its own attribute. Check that the stray `disabled` word is removed from inside the `onClick` block.
- Padding on `ActionButton`: confirm it is `p-6` (it was briefly `p-2`).

**Done so far:**
- Next.js project set up, committed locally (not pushed yet). Node updated to v24.22.2.
- Today page built at `/`, template cleared out.
- `ActionButton` built, imported, and used twice.
- Phone-width layout checked in Chrome DevTools (iPhone 16 size).
- Added `onClick`, fixed the 500 error with `"use client"`, added `useState` and `disabled`.

**Concepts I can explain:** (add only in my own words)
- File-based routing: the folder path becomes the URL, and a `page.js` directly in `app/` renders at `/`.
- Why a running program (VS Code) keeps its old environment until it restarts.
- Props: `page.js` writes `label="..."`, React collects the attributes into a `props` object, `ActionButton` receives it, and `{props.label}` puts the value inside the button.
- Why a reusable component beats repeating long class strings: one edit changes every button.
- Margin vs gap: margin on each button added to `gap-2`, so the space doubled. Moving the spacing to the parent fixed it.
- Server vs Client Components: `page.js` runs on the server and can't hand a function to browser code, which caused the 500. `"use client"` is a label saying the file runs in the browser.
- Why the disabled button isn't trustworthy: `useState` resets on refresh, so the button layer is only a convenience.

**Concepts still to learn:**
- The `onClick` arrow function shape (I forgot it once; practice writing it again)
- Padding (inside the box) vs margin (outside the box): one-line summary in my own words
- Flex only arranges direct children of the flex container
- Authentication vs authorization
- Why server-side checks matter (the server and database layers of duplicate protection)
- Why the database stores empty, not the word "missed"
- Route handlers in Next.js

**Tests run:** no automated tests. Manual checks I reported: dev server starts, pages auto-update on save, `/history` renders, `/` shows the Today page, both buttons match in style, clicking each logs "sleep" or "wake" in the Console, a click disables that button, and a refresh re-enables it (expected, since `useState` is temporary).

**Open decisions:** how the app talks to Postgres (query library or ORM), login approach, timezone handling.

**Parked notes:**
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- `docs/Clockback_spec.md` may be older than the newer spec upload and may need replacing.
- `app/layout.js` is still the template version. Look at it when something needs to be shared across pages.
- Both buttons currently run the same code except for `action`. Later, "sleep" and "wake" will need different behavior.
- `app/history/page.js` is still a hello world placeholder.
- Commit the new work to Git (nothing since the first commit).

**Blockers:** none.

**Next smallest step:** create a tiny route handler so the server can receive a tap. Under `app/`, make the folders for the URL `/api/sleep`, and inside them a file named `route.js` (not `page.js`). It only needs to reply with a short message for now, with no saving and no database. Before writing it, tell me which folders you'd create and what the file's first line might look like.