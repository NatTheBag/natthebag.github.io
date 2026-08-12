# Ways to grow the question bank

The bank is currently 3,691 rows in `questions.csv`, OCR'd out of Science Bowl
round PDFs. After the grading fixes, 3,362 of those are actually answerable —
the rest are dropped at load time because the OCR ate the answer key or the
choices. Options below are roughly ordered by value per unit of effort.

---

## 1. Fix the extraction before adding anything new

~330 questions are unusable and several hundred more are lightly mangled
(`iro n`, `protein s`, `CHOLESTER OL`, `ACC EPT`). The grader now works around
this, but the questions still *read* badly.

The official round PDFs have a real text layer — they don't need OCR at all.
Re-extracting with `pdftotext -layout` or PyMuPDF (`page.get_text("text")`)
instead of an OCR pass removes the whole class of split-word errors.

The rounds are also rigidly structured, so extraction can be a parser rather
than a heuristic:

```
TOSS-UP
1) BIOLOGY  Short Answer  <question text>
ANSWER: <answer>

BONUS
1) BIOLOGY  Multiple Choice  <question text>
W) ... X) ... Y) ... Z) ...
ANSWER: W) ...
```

Splitting on `TOSS-UP` / `BONUS` / `ANSWER:` and the `W) X) Y) Z)` markers gets
you clean rows, correct `question_type`, and no answer bleeding into the next
question's text. **Recovers a few hundred questions and improves several
thousand — cheapest win available.**

## 2. Ingest the rest of the official archive

DOE publishes Science Bowl round packets going back roughly 30 years, high
school and middle school, free. The bank appears to cover a few dozen rounds.
Running the same (fixed) pipeline over the full archive is a ~10x increase in
authentic, difficulty-calibrated questions with zero authoring risk.

Secondary sources, in rough order of fit:

- **NSB sample sets / regional practice packets** — same format, drop straight in.
- **Quizbowl archives (QBReader, QuizDB)** filtered to science categories —
  large and free, but pyramidal tossups are a different genre (long, clue-stacked)
  and need rewriting to be Science Bowl-shaped.

## 3. Auto-convert short answer into multiple choice

Half the bank is short answer. Any short-answer question can become a multiple
choice question by generating three distractors — and the concept clusters
already in the CSV are exactly the right source. Pull three other answers from
the same `predicted_concept` cluster, preferring ones whose embeddings are close
to the real answer but not identical: semantically adjacent terms make plausible
distractors, random ones make the question trivially guessable.

Free doubling of the bank, and it makes the MC/short-answer mix tunable per
practice session. Filter out distractors that are near-synonyms of the answer,
and skip questions whose answer is numeric or a formula (distractors there
should come from #4 instead).

## 4. Parameterized templates for computational questions

The math, chemistry, and physics computation questions follow a small number of
recurring shapes:

| Pattern | Example from the bank |
| --- | --- |
| Molar mass | "Find the mass of 1 mole of cuprous oxide, or Cu2O" |
| Significant figures | "How many significant figures are in 0.00750?" |
| Scientific notation arithmetic | "Divide and give your answer in scientific notation" |
| Kinematics | "…find the acceleration…" |
| Unit conversion | "…give your answer in meters squared…" |
| Trig / special angles | "…give the exact value of…" |

Each becomes a template with a generator function that picks the inputs and
*computes* the answer. Thirty or so templates covers most of the computational
half of MATH, CHEMISTRY, and PHYSICS and yields unlimited questions whose
answers are correct by construction — no verification needed. This is the
highest-confidence source of new questions there is.

Emit the accept-alternatives the grader already understands, e.g.
`144 (ACCEPT: 144 GRAMS or 144 G)`.

## 5. LLM generation, offline and batched

Generate with the Claude API as a build step, commit the resulting CSV. Do
**not** call an API from the page: this is a static GitHub Pages site, so any
key shipped to the browser is public. (If live generation is ever wanted, it
needs a small proxy — a Cloudflare Worker or Netlify function — holding the key,
which is a real amount of ongoing cost and abuse surface for a portfolio site.)

What makes the output trustworthy:

- **Few-shot per cluster.** Prompt with 5–10 real questions from the target
  concept plus its topic tags, so generated questions inherit Science Bowl
  phrasing and difficulty rather than sounding like a textbook quiz.
- **Ask for the accept-list.** Have the model emit the answer *and* acceptable
  alternatives in the existing `ANSWER (ACCEPT: alt or alt)` syntax — the
  grader already parses it.
- **Verify by answering it cold.** Second call, fresh context, no answer given:
  keep the question only if the model's independent answer matches the key.
  Catches most fabricated or ambiguous questions for roughly double the cost.
- **Dedupe by embedding.** Drop anything with cosine similarity above ~0.9 to an
  existing question. The pipeline already produces embeddings.
- **Label the source.** Set `source_file` to `generated/<date>` so generated
  questions can be filtered separately, with an "official questions only" toggle
  in the UI. Practicing against a hallucinated answer is worse than not
  practicing.

Cost is small — a few thousand questions with verification is single-digit
dollars — but the *review* cost is real. Spot-check a sample by hand before
committing a batch, especially in chemistry and astronomy where plausible-sounding
wrong answers are easiest to produce.

## 6. Get more out of the questions already there

Before generating anything, note that the bank is bigger than any one student
will exhaust. Tracking per-question history in `localStorage` (times seen, times
right, last seen) and scheduling by SM-2 or a simple leech/mastery bucket makes
3,362 questions feel much larger, and surfaces weak concepts — which is the
actual point of the concept clustering.

---

## Quality gate for any of the above

Whatever the source, run the same validation before committing rows. The rules
the practice page enforces at load time are the right ones:

- question text is non-empty and contains no `ANSWER:` leakage
- answer key has gradeable content after normalization
- multiple choice has ≥2 choices and the answer resolves to one of them by
  letter or by text
- no duplicate question text

That's the check in `practice.html`'s `parseCSV`, and it would be worth lifting
into a standalone `tools/validate-questions.mjs` run in CI so a bad batch can't
land silently.
