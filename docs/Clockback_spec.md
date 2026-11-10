# Clockback: Project Spec

A phone-first web app that helps a night owl move bedtime earlier in small steps, built so it still works on lazy, tired nights. Status: planned only. Nothing is built, tested, or deployed yet.

## 1. Problem and goal

My sleep drifted to about 5 am. Every tool I tried depends on me acting at the moment I am least likely to: alarms get dismissed, a habit app gets forgotten, notes get ignored, and an app blocker only pushes me to other distractions.

**Core thing it must do well:** help me shift bedtime earlier in small steps and keep me coming back instead of fading away.

**Honest limit:** an app cannot make anyone sleep. It can make patterns visible, make the next small step obvious, and make ignoring it slightly harder.

## 2. Target user and success criteria

**Target user:** me first (a night owl who is mostly on a phone, in bed, during the late-night drift). Other people with the same pattern come later.

**Success criteria I can check:**

- Logged bedtime moves from about 5 am toward 4 am over a few weeks (a gradual shift, not a jump to 2 am).
- I use the app on most days of a week. The app can count this itself from logs and opens.

## 3. MVP features and acceptance criteria

| Feature | Acceptance criteria |
| --- | --- |
| Sign up, log in, log out | A new user can create an account and log in. Passwords are never stored as plain text. |
| "Phone down, going to sleep" button | One tap saves the current time as that night's bedtime, labeled "tapped". The button means the moment I put the phone down, not getting into bed. |
| "I'm awake" button | One tap saves the wake time on my latest night that has no wake time, regardless of the clock. |
| Duplicate protection | A second "phone down" tap for the same night is refused. Refreshing the page does not re-enable the button. |
| Undo | I can remove my most recent tap on tonight's log to fix a mistap. |
| Late entry for yesterday | For yesterday's night only (the night before the current night date, using the noon cutoff), I can type clock times to fill a missing wake time, a missing bedtime, or both times for a night with no row, or to replace a time already saved. I type the times in the 12-hour form (hour, minute, am/pm), and the server works out the dates from them. Every time saved this way is labeled "entered later", including replacements (the original tapped value is not kept). A typed sleep can be at most 12 hours, with no minimum. Older nights cannot be edited. The screen says which time is missing, and shows that nothing needs fixing when nothing does. |
| History view | Each night shows bedtime and wake time. Missing times show as "missed" and are never invented. Entered-later times show a visible label. |
| Weekly trend | Average bedtime this week compared with last week. Entered-later times are included, with their label shown. |
| Target bedtime | I set a goal bedtime and step size (for example, 15 minutes earlier) and the app shows the next small step. |
| Phone-first layout | Both buttons are large, thumb-reachable, and usable on a small screen. |

## 4. Stretch goals (after the MVP works and I actually use it)

- Offline logging that saves taps on the phone and syncs when the connection returns (real technique, large jump in difficulty).
- Push notifications (browsers handle them inconsistently, and I sometimes ignore notifications anyway).
- Home-screen install, streaks, richer charts, and a morning "plan for today" checklist.
- Handling timezone changes when traveling.
- Option to exclude entered-later times from the trend, if the average ever feels misleading.

## 5. Tech stack with reasoning

| Piece | Choice | Why | Alternative considered |
| --- | --- | --- | --- |
| UI | React + Tailwind (Recharts for charts later) | Already used in my Split Sense project, so I reuse known skills. | Plain HTML/JS: simpler, but less growth. |
| Framework | Next.js | React-based, common in job postings, UI and server code in one project, and a smooth fit with Vercel where I already deployed. | Vite + Express: clearer client/server split but more setup and a separate host for the server. |
| Database | PostgreSQL | Data is structured and time-based. Rules like one log per user per night and date queries fit relational tables. SQL is widely expected. | MongoDB: easy to start, but weaker fit for these queries and constraints. SQLite: easier, less typical when deployed. |
| Hosting | Vercel + a free hosted Postgres | Low cost for a project this size. | Check current free-tier limits when deploying, since they change. |

**Learning opportunities:** the server side of Next.js, SQL and schema design, authentication and authorization, and testing rules.

**Learning trap to watch:** Next.js hides some of the client/server split behind conventions, so I need to deliberately learn what runs in the browser and what runs on the server.

Decided: plain JavaScript first, with TypeScript later once the fundamentals feel solid. **Still undecided:** how the app talks to Postgres (query library or ORM), and the login approach (library or built by hand, a decision with real security risk).

## 6. Functional components

| Component | Inputs | Outputs | Depends on |
| --- | --- | --- | --- |
| Auth | Email or username, password | A logged-in session, or a refusal | Database |
| Log tap | Button tap, current time, user | A saved bedtime or wake time, or a refusal | Auth, night-assignment rule, database |
| Corrections | Undo request, or typed clock times for yesterday's night | Updated or new log, labeled correctly | Auth, rules (night resolution, sleep-length limit), database |
| History and trend | User | Nightly list, weekly averages | Auth, database |
| Target | Goal bedtime, step size | Saved target, next suggested step | Auth, database |

## 7. Architecture and key flow

**Communication style:** plain HTTP requests from the browser to Next.js server routes (REST-style), then to PostgreSQL.

**C4 context:** one user on a phone browser uses the app. The app stores data in PostgreSQL. No paid outside services in the MVP.

**C4 containers:**

- Next.js app, browser side: screens, buttons, history, trend.
- Next.js app, server side: login checks, the rules below, database reads and writes.
- PostgreSQL: users, sleep logs, targets.

**Main flow: the night tap**

1. I tap "Phone down, going to sleep".
2. The browser sends an HTTP request with proof I am logged in.
3. The server confirms who I am (authentication).
4. The server decides which night the tap belongs to and checks one-log-per-night.
5. It saves the timestamp, marked "tapped".
6. It responds, and the screen shows the button as done.

**Second flow: the morning tap.** Same path, except the server attaches the wake time to my latest night with no wake time, ignoring the clock.

**Third flow: late entry**

1. The screen asks the server what is missing for yesterday's night (a missing wake time, a missing bedtime, or no row at all). The server decides, and the browser only displays.
2. I type clock times only, in the 12-hour form (hour, minute, am/pm). The server converts them to the 24-hour clock first: 12 am is 0, 12 pm is 12, and any other pm hour adds 12.
3. The server confirms who I am and that the night is yesterday's.
4. The server turns the clock times into real moments with one idea used twice: "the first moment with this clock reading after a starting point". The bedtime is the first moment at or after noon on the night's date with the typed reading (so night D covers noon on D to noon on D+1). The wake time is the first moment after the bedtime with the typed reading, which keeps 1 pm wake-ups working. A wake typed with the same reading as the bedtime lands 24 hours later and is refused by the 12-hour cap.
5. It checks the rules in section 8, then saves the times with the label "entered later" (creating the row if the night has none).
6. It responds, and the screen shows the night as fixed.

"Yesterday" means the night before the current night date, not the calendar day before today. At 3 am the current night still belongs to the previous calendar day.

**Night assignment rule:** a fixed noon cutoff. A "phone down" tap before noon belongs to the previous night, and a tap after noon belongs to tonight. This holds for my usual latest bedtime of about 5:20 am and for 1 pm wake-ups. The assigned night is saved on the log when it is created, so later changes never re-sort past data. Backup: if a night already has no wake time and I tap "phone down" again, the app asks whether I meant a new night instead of guessing.

## 8. Data model, validation, and security

**Entities**

| Entity | Holds | Relationship |
| --- | --- | --- |
| User | Email or username, securely stored password | Has many sleep logs and one current target |
| Sleep log | Night date, bedtime, wake time (either can be empty), and a source label for each time (tapped or entered later) | Belongs to one user |
| Target | Goal bedtime, step size | Belongs to one user |

**Rules the server enforces**

- Only the owner can create, read, or change a log (authorization).
- One log per user per night.
- Times must be real times, and wake time cannot be before bedtime.
- Corrections are allowed only for tonight (undo) and yesterday's night (late entry).
- Typed times: nothing in the future, and the wake time must be after the bedtime (when only one time is changed, it is checked against the one already saved).
- Typed times must be valid: hour 1 to 12, minute 0 to 59, and am or pm. Anything else is refused.
- Typed times: a sleep longer than 12 hours is refused as a probable typo. There is no minimum. The cap applies only to typed times, never to taps, and the 12 is kept in one named place in `lib/`.
- A missing time is stored as empty. The screen decides to show "missed", and the database never stores that word.

**Duplicate protection in three layers:** the button disables itself (convenience only), the server refuses duplicates (trusted), and a database rule refuses a second row for the same user and night (last backstop). Only the last two can be trusted, because anyone can send a request without using my button.

**Authentication vs authorization:** authentication answers "who are you?" and authorization answers "what may you touch?". Both are checked on the server for every request, never just by hiding buttons.

**Privacy and security risks:** sleep patterns are personal. Passwords must be hashed, the real `.env` file stays out of Git, and the main risk is one user reaching another's data. Offline stretches (blackouts, travel) simply show as gaps. Stored history is safe because it lives in the database, not on the phone.

## 9. Testing and verification plan

**Manual checks first**

- Tap each button, then refresh and confirm state is correct.
- Double-tap the night button and confirm only one log exists.
- Leave out the wake tap and confirm the history shows "missed".
- Log in as a second user and confirm the first user's data is not visible.

**Automated tests worth writing** (small, fast tests on the rules in the logic folder, no big end-to-end suite for the MVP):

| Priority | Rule tested | Expected result |
| --- | --- | --- |
| 1 | User A cannot read or change User B's logs | Refused, no data returned |
| 2 | One log per user per night | Duplicate refused at the server and by the database |
| 3 | Noon cutoff | 5:20 am tap goes to the previous night, 1 pm tap goes to tonight |
| 4 | Wake time not before bedtime | Invalid time refused |
| 5 | Corrections limited | Editing a day older than yesterday refused |
| 6 | Typed clock times resolve to the right dates | Night Nov 7 with bedtime 5:20 am and wake 1:00 pm gives Nov 8 5:20 am and Nov 8 1:00 pm. Bedtime 11:00 pm and wake 7:00 am gives Nov 7 11:00 pm and Nov 8 7:00 am |
| 7 | 12-hour cap on typed sleep | A result of 14 hours is refused. A short night (such as 4 hours) is accepted |
| 8 | 12-hour clock conversion | 12 am gives 0, 12 pm gives 12, 5 am gives 5, 5 pm gives 17 |

**Edge cases:** double-tap, missing wake time, 5:20 am bedtime, 1 pm wake-up, a first-ever log with no history, a forgot-both night (no row), replacing a tapped time, a typed wake time that matches the bedtime's clock reading, and a late entry at 3 am (when the current night still belongs to the previous calendar day), and typed times of 12 am and 12 pm.

**Parked for later:** timezones when traveling.

## 10. Suggested folder structure

This is a proposal. Exact names can shift with the Next.js version and tools chosen.

| Folder or file | Purpose |
| --- | --- |
| `app/` | Pages (login, sign up, today, history, settings) and server routes. In Next.js the folder path becomes the URL. |
| `components/` | Reusable UI pieces: the two big buttons, history list, trend display. |
| `lib/` | Logic not tied to a screen: noon cutoff, weekly average, yesterday-only check, 12-hour to 24-hour conversion, clock-time resolution for late entry, sleep-length limit, database connection. Keeping rules here makes them testable. |
| `db/` | Table definitions and migrations (saved, ordered changes to the database), optional sample data. |
| `tests/` | Automated checks for the rules above. |
| `docs/` | This spec, `PROGRESS.md`, decision notes. |
| `public/` | Icons and static files served as they are. |
| Root files | `README.md`, and `.env.example` listing setting names only, with no real values. A middleware file at the root can run login checks before routes (check current Next.js docs for its exact name and rules). |

**Mapping from Vite:** `app/` does the job of `main.jsx` and `App.jsx` plus the server routes, while `components/` and `public/` work as I already know. The new thing to watch is that one project holds both browser code and server code.

**Debugging the one-log-per-night rule:** look first in `lib/` for the rule, then the server route in `app/` that calls it, then `db/` for the last-resort database constraint.

## 11. Resume, portfolio, and README framing

Draft only. Do not use on a resume until the app exists, and fill the brackets only with real results.

**README description (draft)**

> **Clockback** is a phone-first web app that helps people with a drifting sleep schedule move their bedtime earlier in small steps. Existing trackers depend on the user remembering to open them at the exact moment they are least likely to. This app is built around that weakness: one-tap logging, a one-day "second chance" correction rule, and clear labels that separate tapped times from estimates, so the data stays honest.
>
> **Built with:** Next.js, React, Tailwind CSS, PostgreSQL. **Status:** \[what is actually built, tested, and deployed\].

**STAR framing**

- **Situation:** my sleep schedule had drifted to about 5 am, and the tools I tried were ignored or dismissed.
- **Task:** build something I would keep using, with data I can trust.
- **Action:** \[what I built and the design decisions below\].
- **Result:** \[real numbers, such as bedtime trend or days used per week. Leave empty until real\].

**Interview talking points**

1. **Honest data design:** separated tapped from entered-later times, limited corrections to yesterday, and showed missed nights as gaps instead of inventing data.
2. **Authentication vs authorization:** a public app with a shared database lets strangers overwrite data, and ownership must be checked on the server for every request.
3. **Layered duplicate protection:** the button, the server, and the database, and why only the last two can be trusted.
4. **Deliberate trade-offs:** offline sync and notifications deferred so the MVP stays finishable.

**Not to claim until true:** deployment, test results, usage numbers, or any feature not yet built.

## 12. Draft progress note (for PROGRESS.md)

- **Current stage:** planning complete, spec drafted. No code written.
- **Decisions made:** self-reported sleep logging via two buttons, login in the MVP, one row per night, noon cutoff, Next.js + PostgreSQL in plain JavaScript (TypeScript later), include entered-later times in the trend with a label.
- **Concepts to be able to explain:** authentication vs authorization, why server-side checks matter, layers of duplicate protection, why the database stores empty rather than the word "missed".
- **Tests run:** none yet.
- **Open decisions:** database access approach, login approach, timezone handling.
- **Next smallest step:** set up an empty Next.js project and get one page to render, before any database or login work.