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

---

## 7. Functions: inputs, `return`, calling, and running one file

**Purpose:** package one small job so I can reuse it and test it alone.

**Mental model:** a function is a small machine. Values go in (parameters), one value comes out (`return`). Nothing happens until it is called.

**Reusable structure (made-up `lib/cups.js`):**

```js
function cupsToMillilitres(cups) {
  return cups * 240;
}

console.log(cupsToMillilitres(1));
console.log(cupsToMillilitres(2));
```

- The parameter (`cups`) is a name for whatever value is passed in.
- A call is the function's name plus `()` with the values inside.
- `return` sends the answer back and **ends the function right there**.
- `console.log` only prints to the terminal. It has nothing to do with `export`. `export` is needed only when another file imports the function.
- `node lib/cups.js`, run from the project root, runs that one file and prints its output. It is a quick test and not the dev server.
- Names that say what they mean (`hour`, `period`) beat `a` and `b` as soon as the function has real logic.

**Common mistakes:**
- `return` followed by a line break returns nothing (`undefined`). Keep the value on the same line.
- Calling with too few values (`f(1)` for two parameters) leaves the missing one `undefined`.
- After renaming a parameter, an old name left inside the function stops working.
- File names are case-sensitive on Linux and in deployment (`nightTimes.js` and `nightTImes.js` are different files).

**Current ability:** understanding. I wrote a working two-input function and ran it with `node` myself.

**Next practice (optional):** write a small function from scratch (inputs on paper first), then call it three times with different values.

---

## 8. Conditionals: `if`, `===`, `&&`, and order

**Purpose:** make code choose between cases, and make the choice correct.

**Reusable structure (made-up parcel fee):**

```js
function parcelFee(weight, speed) {
  if (speed === "express" && weight > 10) {
    return 50;
  }
  if (speed === "express") {
    return 30;
  }
  return 10;
}
```

- Checks run top to bottom. Because `return` ends the function, **the most specific rule goes first and the general rule after it**.
- `&&` means both sides must be true.
- `===` compares. A single `=` assigns, so `if (x = 12)` would store 12 and still count as true, a bug that throws no error.
- Text values go in quotes (`"pm"`).
- The last line is the fall-through: everything no `if` caught.
- Prefer the exact check (`hour === 12`) over a loose one (`hour > 11`). A loose check treats bad input as valid, and an exact check lets bad input fall through to an obviously wrong answer.

**Common mistakes:**
- An empty `if` block does nothing, and the code falls through to the next rule.
- Putting the general rule before the exception, so the exception never runs.
- `return hour = 12`: it works by accident. Write `return 12`.

**Current ability:** understanding, with recall in progress. I wrote the two 12 checks myself and gave the right reason for putting them before the general rule.

**Next practice (optional):** write a three-way rule (for example, a ticket price for children, adults, and seniors) with the most specific check first.

---

## 9. Edge cases and testing every path

**Purpose:** most bugs live at the odd values, not the ordinary ones.

**Pattern:**
1. Write the expected answers in a small table **before** running.
2. Include at least one call for every path through the function, including the special cases.
3. Predict the output, run it, and compare.

**Made-up example:** a function that turns a score into a letter grade. The ordinary rows (85, 70) are easy. The rows that catch bugs are the boundaries (90, 89, 0, 100), because that is where `>` vs `>=` mistakes show up.

**Real example from this project:** converting 12-hour time to 24-hour time looks like "add 12 for pm", but 12 am (0) and 12 pm (12) break the simple rule. A test with only 5 am and 5 pm would have passed and hidden both bugs. Testing all four calls (5 am, 12 am, 12 pm, 5 pm) printed 5, 0, 12, 17, matching the table.

**Second real example:** the resolver's bedtime lookup treated "equal to the window start" like "too early", so a 12:00 pm bedtime landed a day late. The result still said `ok: true`, because the length check only looks at the gap. Only a test at the exact boundary exposed it. The first fix (`<` for both callers) then let a same-time bedtime and wake through as 0 hours, so the second boundary needed its own test.

**Common mistakes:**
- Testing only the cases that already work.
- Assuming a special case is "normal" (I assumed 12 am stayed 12).
- Removing an earlier test call so a path is no longer covered.

**Current ability:** understanding. I spotted the 12 pm problem myself but missed 12 am until I wrote out the table.

**Next practice (optional):** for any new function, write the table of expected results first, including the boundary rows, then run it.

---

## 10. Pure functions, and where validation lives

**Purpose:** keep rules separate from the database and the screen so they can be tested alone.

**Mental model:** a pure function takes values and returns a value. It touches no database, no screen, and no clock unless the clock is passed in. That is why the resolver pieces go in `lib/` and are tried with `node`, with no server or database running.

**Where validation lives:**
- A small function can assume its input is valid (the 12-hour converter assumes the hour is 1 to 12).
- The code that **receives the user's input** (the route) checks it before calling. This matches the trusted-layer idea in the project: the server checks everything, and the page only helps.
- If the function never checks, a bad value gives a wrong answer silently, so the caller's check is not optional.

**Common mistakes:**
- Assuming the function will check input it was never written to check.
- Mixing database calls into a rule that could be a pure function, which makes it harder to test.

**Current ability:** recognition. This will matter once the route calls the resolver.

---

## 11. Time: labels vs moments, and the 12-hour vs 24-hour clock

**Purpose:** avoid off-by-a-day bugs, which are among the most common in apps that handle time.

**Key ideas:**
- A label (a date that names a period, like a night) and a timestamp (the exact moment) are different things. One labeled period can hold timestamps on two calendar dates.
- The user sees the 12-hour clock. The code works internally with the 24-hour clock (0 to 23). The conversion happens once, at the edge. The 12 hour is special in both halves: 12 am is 0 and 12 pm is 12.
- **Walk-forward method:** "the first moment with this clock reading after a starting point". Used twice, with different starting points, it finds both times.

**Made-up example:** a bakery's business day D runs from 4 pm on D to 4 pm on D+1. A worker types a shift of 9:00 pm to 5:30 am for day D.
1. The start is the first 9:00 pm at or after 4 pm on D, which is 9:00 pm on D.
2. The end is the first 5:30 am after that start, which is 5:30 am on D+1.
3. The length is 8 hours 30 minutes.

**Common mistakes:**
- Putting a timestamp on the label's date when it belongs to the next day (a 3:00 am bedtime for a night labeled Nov 7 is Nov 8, because Nov 7 at 3:00 am is before that night starts).
- Counting a duration wrong. Count up to the next whole hour first (12:30 to 1:00 is 30 minutes, then 1:00 to 9:00 is 8 hours, so 8 h 30 min).

**Current ability:** understanding. I worked four examples by hand, including the 5:20 am to 1:00 pm case correctly. Timezones are still to learn.

**Next practice (optional):** make up a new window (for example, a day that starts at 6 am) and resolve two typed times by hand.


---

## 12. Dates in JavaScript: dials, copies, and comparing

**Purpose:** handle moments in time without silent off-by-seconds or off-by-a-day bugs.

**Mental model:** a `Date` is one exact moment. Its time of day sits on four dials: hours, minutes, seconds, milliseconds. A `set...` call turns only the dials it names and leaves the others as they were.

**Reusable structure (made-up job, a day at a given time):**

```js
function sameDayAt(day, h, m) {
  const c = new Date(day);       // a copy, so day is not changed
  c.setHours(h, m, 0, 0);        // all four dials: hours, minutes, seconds, milliseconds
  return c;
}
```

- `setHours(h, m, 0, 0)` sets the whole time of day. Setting only hours and minutes keeps the old seconds, which can leak into the result.
- `new Date(otherDate)` copies. Changing the copy does not change the original.
- Months count from 0 (November is 10), so `new Date(2026, 10, 7)` is Nov 7.
- Compare moments with `<`, `<=`, `>`. Do not use `===` on dates, because two dates for the same moment are different objects.
- `later - earlier` gives milliseconds. Divide by a named constant to convert (`60 * 60 * 1000` per hour).
- `.toString()` shows local time. A plain `console.log(date)` shows UTC.
- The date methods use the computer's local timezone, and a deployed server may differ. This is a decision to make before deploying.

**Common mistakes:**
- Forgetting the dials you did not set (the seconds from the start leaking into the result).
- Using `<` where the equal case must also count (`<=`), so an exact match does not move forward.
- Writing the expected answer on the wrong clock (a reading of 7 on the 24-hour clock is 7 am, not 7 pm).
- Typing a number with commas in code (`3,600,00`).

**Current ability:** understanding. My own test found the seconds bug, and I explained the `<=` vs `<` difference by running both.

**Next practice (optional):** write a function that returns the first moment after a start with a given hour and minute, from memory, then break it on purpose with a start that has seconds.

---

## 13. Composing functions: inputs, values made inside, and returning an object

**Purpose:** build a bigger rule out of small tested pieces.

**Mental model:** a function's **inputs** come from the caller, in the names on its top line. Everything else is **made inside** by lines in its body, often as the return value of another function. The same value can be made inside one function and be an input to the next.

**Reusable structure (made-up bill):**

```js
function addTax(price) { return price * 1.1; }
function addTip(amount, percent) { return amount * (1 + percent / 100); }

function finalBill(price, tipPercent) {   // inputs: price, tipPercent
  const taxed = addTax(price);            // made inside
  const total = addTip(taxed, tipPercent); // taxed feeds the next call
  return total;
}
```

- Calling another function by name is not the same as passing it in. The earlier functions are tools that already exist in the file.
- Keep each step's answer in a named variable so every line does one thing, and check the parameter **order** of each call (mixing it up gives wrong results with no error).
- A function returns one value, but that value can be an **object** bundling several named values:

```js
function checkParcel(weight) {
  if (weight > 20) {
    return { ok: false, reason: "too_heavy" };
  }
  return { ok: true, fee: weight * 2 };
}
```

- The caller checks `ok` first, then decides what to do (for example, a route replying 400 with the reason).
- A refusal rule should say exactly what it refuses (`>` refuses only values over the limit, so the limit itself is allowed).
- A limit used in several places lives in one named constant, so changing it is a one-line edit.

**Common mistakes:**
- Thinking earlier functions must be passed in as inputs.
- Confusing a function's inputs with the values its body creates.
- Mixing up the order of arguments in a call.
- Shorthand: `{ ok: true, fee }` is the same as `{ ok: true, fee: fee }`. It works only when the variable is named like the key.

**Current ability:** understanding. I wrote all five steps of `resolveNight` myself, predicted the dates, and kept inputs and values made inside apart.

**Next practice (optional):** from a three-step description of a job, list the inputs and the values made inside before writing any code.

---

## 14. `return` stops only its own function, and `console.log` gives back nothing

**Purpose:** make sure the caller really receives the value, not just a printed copy.

**Mental model:** `return` hands a value to whoever called that function, and ends that function. `console.log` only writes a message to the terminal and hands back nothing.

**Reusable structure (made-up):**

```js
function outer() {
  function inner() {
    return "inner done";      // ends inner only
  }
  inner();
  return "outer done";        // outer keeps running until its own return
}

function double(n) {
  return console.log(n * 2);  // prints, but returns undefined
}
const answer = double(5);     // prints 10, answer is undefined
```

- To see a returned value while testing, wrap the call: `console.log(double(5))`, or store it: `const answer = double(5)`.
- A temporary print inside an `if`, placed **before** its `return`, shows which branch ran. A line after the `return` in the same block never runs.
- Reading a key from `undefined` (`answer.ok`) throws a TypeError. It usually means a function returned nothing.

**Common mistakes:**
- `return console.log(...)`: the output looks right, but the caller gets `undefined`.
- Putting the `if` and its `return` inside an inner helper, so the outer function never stops.

**Current ability:** understanding. Both bugs were pointed out to me, and I fixed them and explained the change.

**Next practice (optional):** write a function with an early `return` inside an `if`, call it twice, and say which later lines ran each time.

---

## 15. A true/false input, and testing the exact boundary

**Purpose:** let one helper serve two callers that differ only in whether an exact match counts.

**Mental model:** a boolean parameter chooses between two comparisons. The two comparisons (`<` vs `<=`, `>` vs `>=`) give different answers only when the two values are exactly equal.

**Reusable structure (made-up checkout deadline):**

```js
function isLate(deadline, arrival, deadlineCounts) {
  let late;
  if (deadlineCounts) {
    late = arrival > deadline;    // arriving exactly at the deadline is fine
  } else {
    late = arrival >= deadline;   // arriving exactly at the deadline is late
  }
  return late;
}
```

- Write a boolean alone in the condition: `if (deadlineCounts)`, not `=== true`.
- The name must say what `true` does. Trace the branches to check, don't trust the name.
- A call that leaves the argument out gets `undefined`, which acts as `false`, so update every caller.
- Test the exact-equal input with both flag values. Ordinary inputs can't tell the two comparisons apart.
- Changing a shared helper for one caller can break the other. Decide per caller what the equal case means.

**Common mistakes:**
- A flag name that says the opposite of its behavior (mine was swapped at first).
- Adding the input and forgetting to pass it at the calls.
- Fixing one caller's boundary by changing the shared comparison for both.

**Current ability:** understanding. I ran `<` for both callers myself and saw the 0-hour result, then wrote the flag version.

**Next practice (optional):** write a small function with a boolean input from scratch, then predict four calls, including the exact-equal one, with both flag values.