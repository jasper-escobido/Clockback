# LEARNING_NOTES.md: Clockback

Reusable technical knowledge only. Project state, decisions, and test results live in `PROGRESS.md`. Examples below use made-up tables on purpose, so rebuilding them for my own project is my practice.

Ability scale: recognition, understanding, recall, reconstruction, adaptation.

---

## 1. The three outcomes of a database query

**Purpose:** know what my code receives, so I know which lines run next.

**Mental model:** I ask the database a question. It can answer with rows, answer "nothing matches", or refuse.

| Outcome | What `pg` gives back | Reaches `catch`? | Made-up example (`books` table) |
|---|---|---|---|
| Rows found | `rows: [ {...} ]` | No | `WHERE author_id = 3` matches two books |
| Nothing found | `rows: []`, no error | No | `WHERE author_id = 99`, no such author |
| Database refuses | an error is thrown | Yes | typo in a column name, duplicate on a unique rule |

**Reusable structure:** check `rows.length` before reading `rows[0]`, because an empty result is normal and `rows[0]` would be `undefined`.

**Common mistakes:**
- Thinking "nothing found" throws an error.
- Reading `rows[0]` without checking the length first.

**Current ability:** understanding. I got the "refuses" case right (a column typo is an error, so the user sees a 500). The "nothing found" case was wrong at first.

**Next practice (optional):** given three short snippets, say which outcome each query produces and which line runs next.

---

## 2. Silent refusal vs thrown error (guarded UPDATE with a fallback)

**Purpose:** one action ("save a wake time") has several ways to be refused, and each needs the right reply.

**Mental model:** an UPDATE with guards in its `WHERE` is a bouncer who quietly says "no match" and throws nothing. Only the database's own rules (unique, foreign key, CHECK) throw.

**Reusable structure (made-up `loans` table):**

```js
const result = await pool.query(
  "UPDATE loans SET returned_at = $1 WHERE id = $2 AND returned_at IS NULL AND borrowed_at < $1;",
  [now, loanId]
);
if (result.rowCount === 0) {
  // nothing matched: a guard said no (the SQL doesn't say which one)
}
```

- `rowCount` is how many rows matched, not how many values changed.
- All guards in the `WHERE` must be true at once.
- `$1` can appear twice if the values array has one value for it.
- A refusal that throws (like a duplicate on a unique rule) goes in a `try`/`catch`, where `error.constraint` names the rule and the code picks the reply (for example 409).

**The chain to be able to trace:** UPDATE matches nothing (silent) → counter stays `0` → `if (counter === 0)` runs the fallback INSERT → the database refuses a repeated pair and throws → `catch` checks the constraint name → `return` sends the 409. The `if` only decides whether the fallback runs. The `catch` receives the error. The database makes the decision, and the `return` is the messenger.

**Common mistakes:**
- Saying "the `if` catches the error".
- Describing a unique rule as "the row already has a date and a user". It refuses when the whole pair repeats, and other users or other dates pass.
- Editing the wrong column when setting up a test (the guard reads `bedtime`, not `night_date`).

**Current ability:** understanding, with the chain mostly right and the three details above still being tightened.

**Next practice (optional):** explain the chain back in my own words without looking, then predict what happens if the pair did not already exist.

---

## 3. The request path: browser side and server side

**Purpose:** know which code runs where, so errors and logs make sense.

**Mental model (made-up "like" button):**
1. The browser runs `LikeButton.js` (`"use client"`). A tap calls `fetch("/api/like", { method: "POST", body: ... })`, which sends a letter (URL, method, body).
2. The server matches the URL to `app/api/like/route.js` and runs its `POST` function. That code never reaches the browser.
3. The server asks the database and gets rows, nothing, or an error.
4. The server builds a `Response` (200, 409, 500...) and sends it back.
5. The browser receives the response and may update the screen.

The two sides share no variables. Only the request out and the response back cross over.

**Where to look:** the browser console and Network tab show what the browser sent and received. The `npm run dev` terminal shows server `console.log` output and the status line for each request.

**Current ability:** understanding of the separation and the path. Still to rebuild from memory.

---

## 4. Race conditions (overlapping requests)

**Purpose:** explain why two quick actions can fail even though each works alone.

**Mental model:** two requests are being handled at the same time. One reads the database before the other has finished writing, so the reader works with old data.

**Made-up example:** a user taps "check out book" and "return book" within a fraction of a second. The "return" lookup runs before the "check out" INSERT finishes, finds an older loan, and fails.

**What protects the data:** the database's unique rule refused the duplicate, so the data stayed clean. The cost was a confusing 409, not corrupted rows.

**Signs in the terminal:** the status line prints when a request finishes, so lines can appear out of order. The labels on the request logs and the order of the statuses can hint at which request got which status. The Network tab labels each one.

**Common mistakes:**
- Blaming "same timestamps". The cause is timing: one request read before the other wrote.

**Current ability:** recognition, plus a first explanation. Needs restating.

---

## 5. Reading what `console.log` and status lines actually show

- `console.log(body)` prints the body that arrived, not the response status.
- A function's early `return` means later `console.log` lines never print for that request. A refused request can still print lines that ran before the refusal.
- The button's label (what the user reads) and its action value (what the server sees) are different things.

**Current ability:** understanding.

---

## 6. Testing a guard on purpose

**Purpose:** a guard that never fails in normal use still needs a test, or I don't know it works.

**Pattern:** set up the one situation where only that guard can refuse, then confirm the refusal and that nothing changed.

**Made-up example:** to test a "borrowed within 48 hours" guard, give a loan an empty `returned_at` and an old `borrowed_at`. If the loan was already returned, the `IS NULL` guard would refuse it and I'd learn nothing about the 48-hour guard.

**Common mistakes:**
- Setting up the test on the wrong column.
- A test where a different guard refuses first.
- Forgetting `WHERE` on an UPDATE or DELETE, which hits every row.

**Current ability:** understanding. I wrote the corrected setup statement myself after the first version was caught.

**Open item:** the guard `bedtime < $1` can't be failed by a tap, so it needs a late-entry request to be seen refusing something.