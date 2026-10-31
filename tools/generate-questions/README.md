# generate-questions

Writes new Science Bowl practice questions with the Claude API and appends the
ones that survive checking to `scibowl/questions-generated.csv`.

This runs **offline, as a build step** — never from the browser. The site is
static GitHub Pages, so an API key shipped to the page would be a public key.

## Setup

```bash
cd tools/generate-questions
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # or: ant auth login
```

## Use

```bash
node generate.js --list-concepts                 # what clusters exist
node generate.js --dry-run --count 5             # plumbing check, no API calls
node generate.js --concept cytology --count 20   # one cluster
node generate.js --count 10 --append             # every cluster, merged in
node test.js                                     # offline test suite
```

Generated questions do **not** appear in the practice page by default. Open
`practice.html?concept=<name>&generated=1`, or hit the toolbar toggle, and each
one carries an `AI-GENERATED` badge.

## How a question gets in

Each candidate has to clear four gates. Anything that fails is counted in the
run summary by reason, so a bad batch is legible rather than silent.

1. **Few-shot generation.** Per concept cluster, the prompt carries 8 real
   questions spread across that cluster plus its topic tags from the study
   guide, and asks for a batch of new ones. Questions already written this run
   are passed back as an avoid-list.

2. **Structural validation.** The same rules `practice.html` applies at load
   time, run here so a malformed candidate never costs a verification call:
   non-empty question, no answer leaked into the question text, ≥2 parseable
   choices, an answer that resolves to one of them, a gradeable answer key.

   One rule is *stricter* than the page's: for multiple choice, the answer's
   letter and its text must agree. The page resolves ties in favour of the
   letter, which is right for the OCR'd rounds (the text is what got mangled)
   and wrong for a model that writes `W) SULFURIC ACID` against a `W` reading
   "hydrochloric acid".

3. **Duplicate check.** Character-trigram Jaccard similarity against the whole
   existing bank, everything generated earlier in the run, and any previous
   generated file. Threshold 0.6 — calibrated against ~48k within-cluster pairs
   of real questions, whose 99th percentile similarity is 0.30 and 99.9th is
   0.52. Choices are part of the fingerprint because many multiple choice stems
   ("Which of the following is NOT true:") carry their content in the options.

4. **Cold verification.** A second call answers the question with no answer key,
   no concept, and no hint that a model wrote it. Its answer is graded by
   `scibowl/question-parsing.js` — the exact code that will grade the student —
   and the question ships only on a match. Roughly doubles the cost; `--no-verify`
   skips it and is not recommended.

## Layout

| File | |
|---|---|
| `generate.js` | CLI, run loop, CSV output |
| `pipeline.js` | validation, verification grading, per-concept loop |
| `model.js` | prompts, JSON schemas, the two API calls |
| `bank.js` | loads `questions.csv`, topic tags, duplicate index |
| `fake-model.js` | stub for `--dry-run` and tests |
| `csv.js` | reader/writer matching what `practice.html` expects |
| `test.js` | offline suite — no key, no network |

Grading rules live in `scibowl/question-parsing.js`, loaded by both the browser
and this tool. One implementation, so the generator can't drift from the page.

## Cost and review

Two calls per batch of ~8 candidates plus one verification call per candidate
that reaches gate 4. The system prompt and each cluster's examples are cached,
so later batches for the same cluster mostly pay for the tail.

Verification catches questions the model can't answer consistently. It does not
catch a question that is confidently and consistently wrong. **Read a sample
before committing a batch** — chemistry and astronomy are where plausible-sounding
wrong answers are easiest to produce.

## Notes

- `--dry-run` uses a stub with a small fixed vocabulary. Over many concepts it
  reports a high duplicate rate that says nothing about the real model — read it
  as a plumbing check, not a yield estimate.
- Default model is `claude-opus-5` at `high` effort. `--model` and `--effort`
  override; lower effort is cheaper and faster, and worth an A/B on a single
  cluster before committing to a full run.
