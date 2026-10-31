'use strict';

const fs = require('fs');
const path = require('path');
const csv = require('./csv');
const parsing = require('../../scibowl/question-parsing.js');

const SCIBOWL_DIR = path.join(__dirname, '..', '..', 'scibowl');
const QUESTIONS_CSV = path.join(SCIBOWL_DIR, 'questions.csv');
const INDEX_HTML = path.join(SCIBOWL_DIR, 'index.html');

// ── Loading ──────────────────────────────────────────────────────────

// Rows the practice page can actually grade — same gate as its parseCSV.
// Broken rows make bad few-shot examples, so they're excluded from seeding too.
function isGradeable(row) {
    if (!row.question_text || !row.question_text.trim()) return false;
    if (!row.answer || !row.answer.trim()) return false;
    if (!parsing.cleanQuestionText(row.question_text)) return false;

    const choices = parsing.parseChoices(row.choices);
    if (choices.length) {
        if (choices.length < 2) return false;
        return parsing.resolveCorrectIndex(choices, row.answer) >= 0;
    }
    return !!parsing.squash(row.answer);
}

function loadBank() {
    const { rows } = csv.parse(fs.readFileSync(QUESTIONS_CSV, 'utf8'));
    const gradeable = rows.filter(isGradeable);

    const byConcept = new Map();
    for (const row of gradeable) {
        const key = (row.predicted_concept || '').toLowerCase();
        if (!key) continue;
        if (!byConcept.has(key)) byConcept.set(key, []);
        byConcept.get(key).push(row);
    }
    return { rows, gradeable, byConcept };
}

// Topic tags per concept, lifted from the study guide's conceptsData so the
// prompt knows what a cluster is actually about. Best effort — a concept with
// no entry just generates from its examples.
function loadConceptTopics() {
    const topics = new Map();
    let html;
    try {
        html = fs.readFileSync(INDEX_HTML, 'utf8');
    } catch {
        return topics;
    }

    const re = /"([a-z_]+)":\s*\{[^}]*?"topics":\s*\[([^\]]*)\]/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const list = m[2].split(',')
            .map(s => s.trim().replace(/^"|"$/g, ''))
            .filter(Boolean);
        if (list.length) topics.set(m[1], list);
    }
    return topics;
}

// ── Near-duplicate detection ─────────────────────────────────────────
// Character trigrams over the normalized question, compared by Jaccard
// similarity. Embeddings would be better, but the Claude API has no embedding
// endpoint and this catches the case that actually matters: the model
// re-emitting a question already in the bank with light rewording.
//
// The choices are part of the fingerprint because a good many multiple choice
// stems are generic ("Which of the following is NOT true:") and carry all
// their content in the options.

function trigrams(text, choices) {
    let s = parsing.squash(parsing.cleanQuestionText(text));
    if (choices && choices.trim()) {
        s += parsing.parseChoices(choices).map(c => parsing.squash(c.text)).join('');
    }
    const out = new Set();
    for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3));
    return out;
}

function jaccard(a, b) {
    if (!a.size || !b.size) return 0;
    let shared = 0;
    for (const g of a) if (b.has(g)) shared++;
    return shared / (a.size + b.size - shared);
}

// 0.6 is calibrated against the bank itself: across ~48k within-cluster pairs
// of genuinely distinct questions, the 99th percentile similarity is 0.30 and
// the 99.9th is 0.52. Only 0.06% of real pairs reach 0.6, and spot-checking
// those found actual duplicate stems. Raise it if legitimate questions start
// getting rejected; lower it if reworded repeats slip through.
class DuplicateIndex {
    constructor(threshold = 0.6) {
        this.threshold = threshold;
        this.entries = [];
    }

    add(questionText, choices) {
        const grams = trigrams(questionText, choices);
        if (grams.size) this.entries.push(grams);
    }

    // Returns the similarity of the closest match, or 0 when nothing is near.
    closest(questionText, choices) {
        const grams = trigrams(questionText, choices);
        if (!grams.size) return 0;
        let best = 0;
        for (const other of this.entries) {
            const score = jaccard(grams, other);
            if (score > best) best = score;
            if (best >= 1) break;
        }
        return best;
    }

    isDuplicate(questionText, choices) {
        return this.closest(questionText, choices) >= this.threshold;
    }
}

module.exports = {
    SCIBOWL_DIR,
    QUESTIONS_CSV,
    isGradeable,
    loadBank,
    loadConceptTopics,
    DuplicateIndex,
    trigrams,
    jaccard
};
