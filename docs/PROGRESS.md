# PROGRESS.md: Clockback

**Current stage:** Next.js project set up and committed locally. One placeholder page (`/history`) renders. No features, database, or login yet.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js (App Router), React, Tailwind, PostgreSQL, in plain JavaScript.

**Decisions made:**
- Self-reported logging with two buttons: "Phone down, going to sleep" and "I'm awake"
- Login included in the MVP
- One row per night, with a fixed noon cutoff for assigning a night
- Corrections: undo tonight, fill in yesterday only, labeled "entered later"
- Entered-later times count in the weekly trend, shown with a label
- Project name: Clockback
- JavaScript first, TypeScript later once the fundamentals feel solid
- Next.js setup choices: JavaScript, ESLint, Tailwind yes, App Router yes, no `src/`, default `@/*` import alias, React Compiler no, Cache Components no (can enable later), AGENTS.md no

**Done so far:**
- Updated Node to v24.22.2 via nvm after the October 2026 security releases. VS Code needed a full restart to pick up the new version.
- Created the Next.js project in the repo root. Spec and notes live in `docs/`.
- Replaced the template README with a Clockback README.
- Made the first commit with the project set up (local only, not pushed yet).

**Concepts I can explain:** (add only after I can say them in my own words)
- File-based routing: the folder path becomes the URL, and `page.js` marks a folder as a page
- Why a running program (VS Code) keeps its old environment until it restarts

**Concepts still to learn:**
- Authentication vs authorization
- Why server-side checks matter
- Layers of duplicate protection
- Why the database stores empty, not the word "missed"

**Tests run:** no automated tests. Manual checks reported by me: dev server starts, the page auto-updates on save, and `/history` shows a hello world page I wrote.

**Open decisions:** how the app talks to Postgres (query library or ORM), login approach, timezone handling.

**Parked notes:**
- Success criteria say usage is counted from "logs and opens", but the data model doesn't record opens.
- The night assignment backup rule's wording ("a night already has no wake time") is ambiguous and should be reworded.
- `docs/Clockback_spec.md` may be older than the newer spec upload and may need replacing.

**Blockers:** none.

**Next smallest step:** build a static "Today" page at `/` with the two big buttons ("Phone down, going to sleep" and "I'm awake"), no saving and no database yet, so I can practice layout and phone-first sizing with Tailwind.