# PROGRESS.md: Clockback

**Current stage:** Static Today page at `/` is built with two reusable buttons. No saving, database, or login yet.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js (App Router), React, Tailwind, PostgreSQL, in plain JavaScript.

**Decisions made:**
- (all earlier decisions unchanged)
- The Today page lives at `/`, in `app/page.js`. There is no separate `app/today` route.
- Reusable UI pieces go in `components/` at the project root, not inside `app/`.
- Button styling lives in one place (`ActionButton`) so both buttons always match.

**Done so far:**
- (earlier items unchanged)
- Cleared the template out of `app/page.js` and turned it into the Today page.
- Built `components/ActionButton.js`: takes a `label` prop and renders a styled `<button type="button">`.
- Used `<ActionButton label="..." />` twice in `app/page.js` for "Phone down, going to sleep" and "I'm Awake".
- Parent `div` uses `flex flex-col gap-2` to stack the children with space between them.

**Concepts I can explain:** (add only after I can say them in my own words)
- File-based routing: the folder path becomes the URL, and `page.js` marks a folder as a page. A `page.js` directly in `app/` renders at `/`.
- Why a running program (VS Code) keeps its old environment until it restarts
- Props: `page.js` writes `label="..."`, React collects the attributes into a `props` object, `ActionButton` receives it, and `{props.label}` puts the value inside the button.
- Why a reusable component beats repeating long class strings: one edit changes every button.

**Concepts still to learn:**
- Authentication vs authorization
- Why server-side checks matter
- Layers of duplicate protection
- Why the database stores empty, not the word "missed"
- Padding (inside the box) vs margin (outside the box)
- Flex only arranges direct children of the flex container

**Tests run:** no automated tests. Manual checks reported by me: dev server starts, pages auto-update on save, `/history` shows a hello world page, `/` shows the Today page, both ActionButtons render with the right text and match in style, and the import from `components/` works.

**Open decisions:** how the app talks to Postgres (query library or ORM), login approach, timezone handling.

**Parked notes:**
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- `docs/Clockback_spec.md` may be older than the newer spec upload and may need replacing.
- `app/layout.js` is still the template version. Look at it when something needs to be shared across pages.

**Blockers:** none.

**Next smallest step:** make the two buttons phone-first (large, full-width, readable text size) by editing the classes inside `ActionButton`.