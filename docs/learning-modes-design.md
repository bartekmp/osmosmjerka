# Learning Modes & Spaced Repetition — Design (RFC)

Status: **Draft / for discussion** · Author: initial draft · Related: `README.md` roadmap,
scoring cleanup (PR #205), private lists ("Learn This Later").

## 1. Motivation

Osmosmjerka today trains **visual scanning**, not vocabulary acquisition. In word search
you match letter shapes; you never need a word's meaning, and the translation only appears
*after* you've found it. Crossword (already implemented) is closer to real learning — a
clue (translation) → you produce the word — but it isn't tied to any per-word memory model,
so nothing resurfaces a word you got wrong last week.

**Goal:** turn the app from "a puzzle with translations" into a learning tool by adding a
**per-word mastery model** and **spaced-repetition (SRS) review modes**, while keeping word
search / crossword as the fun surface. This is the foundation the whole learning roadmap
(and the future Anki integration) hangs off.

### Design principles
- **Per-word, not per-game.** Progress is tracked for each vocabulary item, not just
  "games completed".
- **Low friction (ADHD-friendly).** Short, finishable "5-word sprints"; one-tap continue;
  auto-graded (no manual self-rating); forgiving streaks.
- **Reward recall, not speed.** Stop rewarding fast letter-scanning; reward producing a
  word from its meaning.
- **Backend-authoritative.** Mastery + scheduling live on the backend (same stance we just
  took for scoring).
- **Anki-compatible on purpose.** Use SM-2-style fields so a future Anki import/export/sync
  maps cleanly (see §9).

## 2. Scope

**In scope (this initiative, phased):** per-word mastery table; SRS scheduler; three review
modes (multiple-choice, typed recall, crossword-as-review); a bounded "sprint" session flow;
mastery-oriented scoring + forgiving streak; APIs for all of the above.

**Out of scope (tracked separately):** audio/TTS mode (later phase), full Anki sync
(aspirational — §9), teacher-side SRS analytics.

## 3. Data model

### 3.1 The item-identity problem

A "vocabulary item" can be either a **public phrase** (`phrases.id`) or a **user-defined
phrase** in a private list (`user_private_list_phrases` with `phrase_id IS NULL` and
`custom_phrase` set). Mastery must reference both. We mirror the existing polymorphic
pattern used by `user_private_list_phrases` (two nullable refs + a CHECK).

### 3.2 New table: `user_word_mastery`

```
user_word_mastery
  id                    PK
  user_id               FK accounts(id) ON DELETE CASCADE   -- indexed
  phrase_id             FK phrases(id) ON DELETE CASCADE, NULL  -- public phrase
  list_phrase_id        FK user_private_list_phrases(id) ON DELETE CASCADE, NULL  -- custom phrase
  language_set_id       FK language_sets(id)                -- denormalized for filtering
  direction             text NOT NULL DEFAULT 'production'  -- 'production' | 'recognition'

  -- SM-2 style scheduling state (Anki-compatible naming)
  ease                  real NOT NULL DEFAULT 2.5           -- ease factor
  interval_days         real NOT NULL DEFAULT 0             -- current interval
  due_at                timestamptz NOT NULL                -- next review time
  reps                  int  NOT NULL DEFAULT 0             -- successful reviews in a row
  lapses                int  NOT NULL DEFAULT 0             -- times forgotten

  -- derived mastery / telemetry
  mastery_level         int  NOT NULL DEFAULT 0             -- 0..5 bucket for UI
  total_reviews         int  NOT NULL DEFAULT 0
  correct_reviews       int  NOT NULL DEFAULT 0
  last_reviewed_at      timestamptz NULL
  created_at            timestamptz NOT NULL DEFAULT now()

  CHECK ((phrase_id IS NOT NULL) <> (list_phrase_id IS NOT NULL))  -- exactly one
  UNIQUE (user_id, phrase_id, list_phrase_id, direction)
  INDEX (user_id, language_set_id, due_at)   -- the "what's due" query
  INDEX (user_id, due_at)
```

**Direction.** We record `direction` from day one (recognition = see word → recall meaning;
production = see meaning → produce word — what crossword and typed recall are). v1 modes can
populate only `production` to keep things simple; tracking the column now avoids a painful
backfill later. *(Open question §10.)*

### 3.3 Optional: `word_review_log` (append-only)

For analytics / debuggability / future Anki export, log each review:
```
word_review_log(id, mastery_id FK, user_id, grade, response_ms, hints_used,
                mode text, reviewed_at)
```
Not required for v1 mechanics; recommended for Phase 1+ so we can tune the scheduler with
real data. Cheap to add, easy to prune.

### 3.4 Reuse, don't rebuild

- The **review queue source** is existing private lists — especially the built-in
  **"Learn This Later"** list. No new "deck" concept needed for v1.
- `user_statistics` / `user_category_plays` stay as-is (per-game aggregates); mastery is a
  new, orthogonal axis.

## 4. Scheduling algorithm (SRS)

**Choice: simplified SM-2** (over Leitner boxes) because it stores an ease factor and maps
directly onto Anki's model, which de-risks §9.

**Grade derivation (auto-graded, 4 levels).** We do *not* ask the user to self-rate (Anki's
biggest friction point). We derive the grade from the answer:

| Grade  | Condition (typed / MC / crossword)                                  |
|--------|---------------------------------------------------------------------|
| Again  | wrong answer                                                        |
| Hard   | correct but slow, or correct only after a hint / partial reveal    |
| Good   | correct, normal                                                    |
| Easy   | correct, fast, first try, no hint                                  |

Update rules (SM-2-lite):
- **Again:** `reps=0`, `lapses+=1`, `interval=0` (relearn today, e.g. +10 min), `ease-=0.20` (floor 1.3).
- **Hard:** `interval*=1.2`, `ease-=0.15`.
- **Good:** `reps==0 → interval=1d`, `reps==1 → 6d`, else `interval*=ease`; `reps+=1`.
- **Easy:** like Good but `interval*=1.3` and `ease+=0.15`.
- `due_at = now + interval_days` (with fuzz to avoid pile-ups); `mastery_level` = bucket of
  `interval_days` (0=new … 5=mature, e.g. ≥21d).

Tunables (global settings / scoring_rules-style row): new-cards-per-day cap, sprint size,
relearn step, "slow" threshold. Keep them server-side and configurable.

## 5. Learning modes

All modes pull their items from the SRS queue (§4) and report a graded result back.

1. **Multiple-choice recall (recognition)** — show the word (or meaning), pick the correct
   translation from 4 options (distractors sampled from same language set/category). Lowest
   friction; good for new items and mobile. *New lightweight UI.*
2. **Typed recall (production)** — show the meaning, type the word. Reuses the
   translation-input infrastructure teacher mode already has
   (`require_translation_input`). Accent/case-insensitive matching, "almost" tolerance.
3. **Crossword-as-review (production)** — the existing crossword mode, but the phrase set is
   drawn from due items and completion feeds grades back into mastery. Highest reuse: the
   generator, grid, and hint→reveal already exist.
4. **(Later) Listen / TTS** — "type what you hear". No audio infra today; separate phase.

Word search stays as the **warm-up / fun mode** and can still *feed* mastery weakly (a
found word = a light "recognition" exposure) but never drives scheduling on its own.

## 6. Session flow — "5-word sprints"

- Entry: **one-tap "Continue"** resumes the last set/mode (kills the
  set→category→difficulty decision paralysis).
- A sprint = **N due items** (default 5, configurable), mixing overdue reviews + a capped
  number of new items.
- Immediate per-item feedback; a short finish screen (X learned, streak state, next-due
  hint). Bounded and finishable by design.
- If nothing is due: offer a short "get ahead" sprint of new items or a free-play puzzle.

## 7. Scoring integration

This folds in the deferred **slice B** (`streak_bonus` → `completion_bonus` rename) since
we're reworking scoring here anyway.

- **Primary progression = mastery + streak**, not arcade points. Surface "words mastered"
  and "words due" prominently; keep the arcade score as a secondary, fun number.
- **Forgiving daily streak** with **streak-freeze** (habit driver without guilt). A day
  "counts" if the user completes ≥1 sprint. Streak is backend-authoritative (a real
  cross-session streak — today's `streak_bonus` is only a per-puzzle completion bonus).
- **Stop rewarding speed-scanning**: the mastery gain comes from recall correctness, not
  from finding letters fast. The word-search time bonus stays only as arcade flavor.
- Hints remain un-penalized (we already defaulted the penalty to 0); in review modes a hint
  instead *caps* the grade at "Hard" (affects scheduling, not a point tax).

## 8. API surface (sketch)

```
GET  /api/learn/queue?language_set_id=&list_id=&limit=   -> due + new items for a sprint
POST /api/learn/review                                    -> { mastery_id|item ref, mode,
                                                              correct, response_ms, hints_used }
                                                              -> updated mastery + next due
GET  /api/learn/stats?language_set_id=                    -> mastered / learning / due counts
POST /api/learn/session/start | /complete                -> sprint bookkeeping + streak
GET  /api/learn/streak                                    -> current streak, freezes left
```
All authoritative logic (grade → SM-2 update, streak) is backend-side; the frontend renders
and posts results, matching the scoring stance.

## 9. Anki interoperability (future hook, not built here)

Choosing SM-2 fields now (`ease`, `interval_days`, `reps`, `lapses`, `due_at`) keeps a
future Anki bridge cheap. Realistic path when we get there:
- **`.apkg` import/export** (SQLite + media zip) is the most robust — user uploads an Anki
  export; we map notes → private-list phrases (+ optionally seed mastery from Anki's
  scheduling). We can also generate `.apkg` for them.
- AnkiConnect (local, requires desktop Anki open) and AnkiWeb scraping are both fragile — not
  a server-to-server sync. Start with one-shot import/export; "sync" later.
- Field mapping (which note fields → phrase/translation/category, note types, cloze, media)
  is the real design work and gets its own RFC. Ties into DB assessment #2 (normalize
  `categories`), which import will want.

## 10. Open questions (need decisions before Phase 1)

1. **Direction in v1:** track per-direction mastery (recognition + production separately)
   from the start, or one aggregate mastery per item until modes need the split?
   *(Recommendation: keep the `direction` column but only populate `production` in v1.)*
2. **Mastery scope:** is a public phrase mastered **once per account** (learned everywhere),
   or per language set? *(Recommendation: per account + language_set — the column is there
   for filtering, uniqueness spans the phrase.)*
3. **Auto-grade vs self-grade:** confirm we auto-derive grades (§4) rather than showing
   Anki-style Again/Hard/Good/Easy buttons. *(Recommendation: auto-grade for friction.)*
4. **Defaults:** sprint size (5?), new-cards/day cap (10?), "slow" threshold for Hard.
5. **Streak rules:** what counts as a day (≥1 sprint?), how many freezes, timezone handling.

## 11. Phased rollout

| Phase | Deliverable | Notes |
|-------|-------------|-------|
| **0** | `user_word_mastery` table + migration; start **capturing** exposures from existing word-search/crossword completions | No new UI; begins accumulating data. Low risk. |
| **1** | SRS scheduler + **multiple-choice** mode over "Learn This Later"; sprint flow; `/api/learn/*` | First real learning loop. |
| **2** | **Typed recall** + **crossword-as-review** wired to mastery | Reuses translation-input + crossword. |
| **3** | Mastery/streak **scoring revamp** (+ slice B rename); forgiving streak + freeze | Replaces speed-based progression. |
| **4** | Audio / **TTS** mode | New infra. |
| **5** | **Anki** import/export (own RFC) | Builds on SM-2 fields. |

Each phase is independently shippable and reviewable.

---

*This is a draft for discussion — §10 needs decisions before Phase 1 starts. Nothing here is
implemented yet.*
