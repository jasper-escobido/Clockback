# PROGRESS.md: Clockback

**Current stage:** planning complete, spec drafted. No code written.

**What it is:** a phone-first web app that helps move a drifting bedtime earlier in small steps. Stack: Next.js, React, Tailwind, PostgreSQL (all in plain JavaScript).

**Decisions made:**
- Self-reported logging with two buttons: "Phone down, going to sleep" and "I'm awake"
- Login included in the MVP
- One row per night, with a fixed noon cutoff for assigning a night
- Corrections: undo tonight, fill in yesterday only, labeled "entered later"
- Entered-later times count in the weekly trend, shown with a label
- Project name: Clockback
- JavaScript first, TypeScript later once the fundamentals feel solid

**Concepts I can explain:** (add these only after I can say them in my own words)
- Authentication vs authorization
- Why server-side checks matter
- Layers of duplicate protection
- Why the database stores empty, not the word "missed"

**Tests run:** none yet.

**Open decisions:** how the app talks to Postgres (query library or ORM), login approach, timezone handling.

**Blockers:** none.

**Next smallest step:** confirm Node.js is installed, create an empty Next.js project, and get one page to render.