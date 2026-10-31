'use strict';

// Offline checks for the generation pipeline. No API key, no network.
//   node test.js

const assert = require('assert');
const csv = require('./csv');
const bank = require('./bank');
const pipeline = require('./pipeline');
const model = require('./model');
const { FakeModel } = require('./fake-model');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
    } catch (err) {
        failed++;
        console.error(`  ✗ ${name}\n    ${err.message}`);
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        passed++;
    } catch (err) {
        failed++;
        console.error(`  ✗ ${name}\n    ${err.message}`);
    }
}

// ── CSV round-trip ───────────────────────────────────────────────────

test('CSV quotes fields containing commas', () => {
    const out = csv.stringify([{ question_text: 'Find x, then y', answer: 'A' }],
        ['question_text', 'answer']);
    assert.ok(out.includes('"Find x, then y"'), out);
});

test('CSV escapes embedded quotes', () => {
    const rows = [{ question_text: 'What is a "quark"?', answer: 'PARTICLE' }];
    const round = csv.parse(csv.stringify(rows, ['question_text', 'answer'])).rows;
    assert.strictEqual(round[0].question_text, 'What is a "quark"?');
});

test('CSV flattens newlines so a record stays on one line', () => {
    const out = csv.stringify([{ question_text: 'line one\nline two', answer: 'A' }],
        ['question_text', 'answer']);
    assert.strictEqual(out.trim().split('\n').length, 2, out);
});

test('CSV round-trips every column of a generated row', () => {
    const row = pipeline.toRow({
        format: 'Multiple Choice', category: 'CHEMISTRY',
        question_text: 'Which, of these, is an acid?',
        choices: 'W) HCl | X) NaOH | Y) NaCl | Z) CH4',
        answer: 'W) HCL'
    }, { concept: 'acids', sourceFile: 'generated/2026-01-01', questionNumber: 1 });

    const round = csv.parse(csv.stringify([row])).rows[0];
    for (const key of csv.COLUMNS) {
        assert.strictEqual(round[key], row[key], `column ${key}`);
    }
});

// ── Candidate validation ─────────────────────────────────────────────

const GOOD_MC = {
    format: 'Multiple Choice', category: 'CHEMISTRY',
    question_text: 'Which of the following is a strong acid?',
    choices: 'W) hydrochloric acid | X) acetic acid | Y) carbonic acid | Z) boric acid',
    answer: 'W) HYDROCHLORIC ACID'
};

const GOOD_SA = {
    format: 'Short Answer', category: 'BIOLOGY',
    question_text: 'What organelle is the site of aerobic respiration?',
    choices: '',
    answer: 'MITOCHONDRION (ACCEPT: MITOCHONDRIA)'
};

test('accepts a well-formed multiple choice candidate', () => {
    const v = pipeline.validateCandidate(GOOD_MC);
    assert.ok(v.ok, v.reason);
    assert.strictEqual(v.correctIndex, 0);
    assert.strictEqual(v.choices.length, 4);
});

test('accepts a well-formed short answer candidate', () => {
    const v = pipeline.validateCandidate(GOOD_SA);
    assert.ok(v.ok, v.reason);
    assert.strictEqual(v.isMC, false);
});

const REJECTS = [
    ['empty_question', { ...GOOD_SA, question_text: '   ' }],
    ['answer_leak', { ...GOOD_SA, question_text: 'What organelle? ANSWER: MITOCHONDRION' }],
    ['too_few_choices', { ...GOOD_MC, choices: 'W) only one' }],
    ['ungradeable_answer', { ...GOOD_SA, answer: '—' }],
    // Right letter, but the text names something that isn't that option.
    ['answer_letter_text_mismatch', { ...GOOD_MC, answer: 'W) SULFURIC ACID' }],
    // Right text, but attached to the wrong letter.
    ['answer_letter_text_mismatch', { ...GOOD_MC, answer: 'Z) HYDROCHLORIC ACID' }]
];

for (const [reason, candidate] of REJECTS) {
    test(`rejects ${reason} (${candidate.answer})`, () => {
        const v = pipeline.validateCandidate(candidate);
        assert.strictEqual(v.ok, false);
        assert.strictEqual(v.reason, reason);
    });
}

test('an answer naming no option at all is rejected', () => {
    const v = pipeline.validateCandidate({ ...GOOD_MC, answer: 'PHOSPHORIC ACID' });
    assert.strictEqual(v.reason, 'answer_not_in_choices');
});

test('choices decide the format when the format field disagrees', () => {
    const v = pipeline.validateCandidate({ ...GOOD_MC, format: 'Short Answer' });
    assert.ok(v.ok, v.reason);
    assert.strictEqual(v.isMC, true);
    const row = pipeline.toRow({ ...GOOD_MC, format: 'Short Answer' },
        { concept: 'acids', sourceFile: 's', questionNumber: 1 });
    assert.strictEqual(row.format, 'Multiple Choice');
});

// ── Verification grading ─────────────────────────────────────────────

test('verification accepts the same answer worded differently', () => {
    const v = pipeline.validateCandidate(GOOD_SA);
    const check = pipeline.verificationMatches(v, GOOD_SA, { answer: 'mitochondria', answerable: true });
    assert.ok(check.ok);
});

test('verification accepts an MC answer given by letter alone', () => {
    const v = pipeline.validateCandidate(GOOD_MC);
    assert.ok(pipeline.verificationMatches(v, GOOD_MC, { answer: 'W)', answerable: true }).ok);
});

test('verification accepts an MC answer given by text alone', () => {
    const v = pipeline.validateCandidate(GOOD_MC);
    assert.ok(pipeline.verificationMatches(v, GOOD_MC, { answer: 'hydrochloric acid', answerable: true }).ok);
});

test('verification rejects a different MC option', () => {
    const v = pipeline.validateCandidate(GOOD_MC);
    const check = pipeline.verificationMatches(v, GOOD_MC, { answer: 'X) acetic acid', answerable: true });
    assert.strictEqual(check.reason, 'verification_mismatch');
});

test('verification rejects a wrong short answer', () => {
    const v = pipeline.validateCandidate(GOOD_SA);
    const check = pipeline.verificationMatches(v, GOOD_SA, { answer: 'RIBOSOME', answerable: true });
    assert.strictEqual(check.reason, 'verification_mismatch');
});

test('verification honours answerable:false', () => {
    const v = pipeline.validateCandidate(GOOD_SA);
    const check = pipeline.verificationMatches(v, GOOD_SA, { answer: 'MITOCHONDRION', answerable: false });
    assert.strictEqual(check.reason, 'unanswerable');
});

// ── Duplicate detection ──────────────────────────────────────────────

test('flags a reworded repeat', () => {
    const idx = new pipeline.DuplicateIndex();
    idx.add('What is the most common term used in genetics to describe the observable physical characteristics of an organism?');
    assert.ok(idx.isDuplicate(
        'What term is most commonly used in genetics to describe the observable physical characteristics of an organism?'
    ));
});

test('does not flag two distinct questions', () => {
    const idx = new pipeline.DuplicateIndex();
    idx.add('What organelle is the site of aerobic respiration?');
    assert.ok(!idx.isDuplicate('Which blood cell type transports oxygen?'));
});

test('shared MC stems are separated by their choices', () => {
    const idx = new pipeline.DuplicateIndex();
    idx.add('Which of the following is NOT true:', 'W) acids donate protons | X) bases accept protons | Y) water is neutral | Z) salt is an acid');
    assert.ok(!idx.isDuplicate(
        'Which of the following is NOT true:',
        'W) mitosis yields two cells | X) meiosis yields four | Y) DNA is a protein | Z) RNA has uracil'
    ));
});

test('threshold sits above the real bank\'s within-cluster similarity', () => {
    const { byConcept } = bank.loadBank();
    const rows = byConcept.get('cytology').slice(0, 40);
    const grams = rows.map(r => bank.trigrams(r.question_text, r.choices));
    let over = 0;
    for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
            if (bank.jaccard(grams[i], grams[j]) >= 0.6) over++;
        }
    }
    const pairs = (rows.length * (rows.length - 1)) / 2;
    assert.ok(over / pairs < 0.01, `${over}/${pairs} real pairs would be called duplicates`);
});

// ── Bank loading ─────────────────────────────────────────────────────

test('every seedable row is gradeable by the practice page\'s rules', () => {
    const { gradeable, byConcept } = bank.loadBank();
    assert.ok(gradeable.length > 3000, `only ${gradeable.length} gradeable rows`);
    assert.ok(byConcept.size >= 30, `only ${byConcept.size} clusters`);
    for (const rows of byConcept.values()) {
        for (const row of rows) assert.ok(bank.isGradeable(row));
    }
});

test('concept topics load from the study guide', () => {
    const topics = bank.loadConceptTopics();
    assert.ok(topics.size >= 30, `only ${topics.size} concepts had topics`);
    assert.ok(topics.get('cytology').includes('Cell organelles'));
});

test('seed picking spreads across the cluster', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const seeds = pipeline.pickSeeds(items, 5);
    assert.strictEqual(seeds.length, 5);
    assert.deepStrictEqual(seeds, [0, 20, 40, 60, 80]);
});

// ── Prompt construction ──────────────────────────────────────────────

test('few-shot block includes choices only for multiple choice', () => {
    const block = model.buildFewShot([GOOD_MC, GOOD_SA]);
    assert.ok(block.includes('Choices: W) hydrochloric acid'));
    assert.strictEqual(block.match(/Choices:/g).length, 1);
});

test('generation prompt carries concept, topics and avoid list', () => {
    const parts = model.buildGenerationPrompt({
        concept: 'cytology',
        topics: ['Cell organelles', 'Mitosis'],
        examples: [GOOD_SA],
        count: 4,
        avoid: ['A question already written']
    });
    const joined = parts.join('\n');
    assert.ok(joined.includes('CYTOLOGY'));
    assert.ok(joined.includes('Cell organelles'));
    assert.ok(joined.includes('A question already written'));
    assert.ok(joined.includes('Write 4 new questions'));
});

test('generation schema uses only supported JSON Schema keywords', () => {
    const unsupported = ['minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf', 'minItems', 'maxItems', 'pattern'];
    const seen = JSON.stringify(model.GENERATION_SCHEMA) + JSON.stringify(model.VERIFICATION_SCHEMA);
    for (const key of unsupported) {
        assert.ok(!seen.includes(`"${key}"`), `schema uses unsupported keyword ${key}`);
    }
});

test('every object in the schemas sets additionalProperties:false', () => {
    const walk = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'object') assert.strictEqual(node.additionalProperties, false);
        Object.values(node).forEach(walk);
    };
    walk(model.GENERATION_SCHEMA);
    walk(model.VERIFICATION_SCHEMA);
});

// ── End-to-end against the stub ──────────────────────────────────────

(async () => {
    await testAsync('pipeline produces gradeable rows end to end', async () => {
        const { byConcept } = bank.loadBank();
        const fake = new FakeModel();
        const duplicates = new pipeline.DuplicateIndex();

        const result = await pipeline.generateForConcept({
            model: fake,
            concept: 'cytology',
            topics: ['Cell organelles'],
            examples: byConcept.get('cytology'),
            target: 5,
            batchSize: 10,
            seedCount: 6,
            duplicates,
            sourceFile: 'generated/test'
        });

        assert.ok(result.accepted.length > 0, 'nothing survived the pipeline');

        // The real gate: every emitted row must load in practice.html.
        for (const row of result.accepted) {
            assert.ok(bank.isGradeable(row), `row not gradeable: ${row.question_text}`);
            assert.strictEqual(row.source_file, 'generated/test');
            assert.strictEqual(row.predicted_concept, 'cytology');
        }
    });

    await testAsync('every stub defect is caught, and by the right rule', async () => {
        const { DEFECTS } = require('./fake-model');
        const expected = [
            'answer_letter_text_mismatch', // answer letter names an option that isn't there
            'answer_leak',                 // key spelled out in the question
            'too_few_choices',             // one option offered
            'empty_question'               // no question at all
        ];
        assert.strictEqual(DEFECTS.length, expected.length);
        DEFECTS.forEach((build, i) => {
            const v = pipeline.validateCandidate(build(i + 1));
            assert.strictEqual(v.ok, false, `defect ${i} slipped through`);
            assert.strictEqual(v.reason, expected[i], `defect ${i}`);
        });
    });

    await testAsync('--no-verify skips verification calls', async () => {
        const { byConcept } = bank.loadBank();
        const fake = new FakeModel();
        await pipeline.generateForConcept({
            model: fake,
            concept: 'cytology',
            examples: byConcept.get('cytology'),
            target: 3,
            batchSize: 6,
            seedCount: 4,
            duplicates: new pipeline.DuplicateIndex(),
            sourceFile: 'generated/test',
            verify: false
        });
        assert.strictEqual(fake.verifyCount, 0);
    });

    await testAsync('a generated question never duplicates the existing bank', async () => {
        const { gradeable, byConcept } = bank.loadBank();
        const duplicates = new pipeline.DuplicateIndex();
        for (const row of gradeable) duplicates.add(row.question_text, row.choices);

        const result = await pipeline.generateForConcept({
            model: new FakeModel(),
            concept: 'acids',
            examples: byConcept.get('acids'),
            target: 4,
            batchSize: 8,
            seedCount: 5,
            duplicates,
            sourceFile: 'generated/test'
        });

        for (const row of result.accepted) {
            assert.ok(!duplicates.isDuplicate(row.question_text, row.choices) ||
                duplicates.closest(row.question_text, row.choices) >= 1,
                'accepted row collides with the bank');
        }
    });

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
