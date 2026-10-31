'use strict';

const parsing = require('../../scibowl/question-parsing.js');
const { DuplicateIndex } = require('./bank');

// Every rejection reason a candidate can pick up, in the order they're checked.
const REJECTIONS = [
    'empty_question', 'answer_leak', 'too_few_choices', 'answer_not_in_choices',
    'answer_letter_text_mismatch', 'ungradeable_answer', 'duplicate',
    'unanswerable', 'verification_mismatch'
];

// Structural checks — these are the practice page's own load-time rules, run
// here so a bad candidate never costs a verification call.
function validateCandidate(candidate) {
    const question = parsing.cleanQuestionText(candidate.question_text || '');
    if (!question) return { ok: false, reason: 'empty_question' };
    if (/ANSWER\s*:/i.test(candidate.question_text || '')) {
        return { ok: false, reason: 'answer_leak' };
    }

    const answer = (candidate.answer || '').trim();
    // The format field is advisory — the presence of choices decides, and
    // toRow() writes the format back to match.
    const isMC = !!(candidate.choices && candidate.choices.trim())
        || candidate.format === 'Multiple Choice';

    if (isMC) {
        const choices = parsing.parseChoices(candidate.choices);
        if (choices.length < 2) return { ok: false, reason: 'too_few_choices' };

        const correctIndex = parsing.resolveCorrectIndex(choices, answer);
        if (correctIndex < 0) return { ok: false, reason: 'answer_not_in_choices' };

        // resolveCorrectIndex trusts the letter over the text, which is right
        // for the OCR'd bank (where the text is what got mangled) and wrong
        // here: a model that writes "W) SULFURIC ACID" against a W of
        // "hydrochloric acid" would ship a question graded on the letter, with
        // an answer key naming something else. Require both to agree.
        const letter = /^\s*([WXYZ])\s*\)/.exec(answer);
        if (letter) {
            const stated = parsing.squash(parsing.stripChoiceLetter(answer));
            const actual = parsing.squash(choices[correctIndex].text);
            if (stated && stated !== actual) {
                return { ok: false, reason: 'answer_letter_text_mismatch' };
            }
        }

        return { ok: true, question, choices, correctIndex, isMC: true };
    }

    if (!parsing.squash(answer)) return { ok: false, reason: 'ungradeable_answer' };

    return { ok: true, question, isMC: false };
}

// Does the verifier's cold answer match the candidate's key? Graded with the
// same functions the student's typed answer goes through.
function verificationMatches(validated, candidate, verdict) {
    if (verdict.answerable === false) return { ok: false, reason: 'unanswerable' };

    const given = (verdict.answer || '').trim();
    if (!given) return { ok: false, reason: 'verification_mismatch' };

    if (validated.isMC) {
        const index = parsing.resolveCorrectIndex(validated.choices, given);
        return index === validated.correctIndex
            ? { ok: true }
            : { ok: false, reason: 'verification_mismatch' };
    }

    return parsing.gradeShortAnswer(given, candidate.answer)
        ? { ok: true }
        : { ok: false, reason: 'verification_mismatch' };
}

function toRow(candidate, { concept, sourceFile, questionNumber }) {
    const isMC = !!(candidate.choices && candidate.choices.trim());
    return {
        source_file: sourceFile,
        question_number: String(questionNumber),
        question_type: 'TOSSUP',
        category: candidate.category || '',
        format: isMC ? 'Multiple Choice' : 'Short Answer',
        question_text: parsing.cleanQuestionText(candidate.question_text),
        choices: isMC ? candidate.choices.trim() : '',
        answer: candidate.answer.trim(),
        predicted_concept: concept,
        cluster_id: '',
        confidence: '1.0'
    };
}

// Generates for one concept until `target` questions survive, or until the
// model stops producing anything usable.
async function generateForConcept({
    model, concept, topics, examples, target, batchSize, seedCount,
    duplicates, sourceFile, verify = true, onEvent = () => {}
}) {
    const accepted = [];
    const rejected = {};
    const avoid = [];
    let batches = 0;
    let emptyBatches = 0;

    const note = reason => { rejected[reason] = (rejected[reason] || 0) + 1; };

    while (accepted.length < target && emptyBatches < 2) {
        const want = Math.min(batchSize, (target - accepted.length) * 2);
        const seeds = pickSeeds(examples, seedCount);

        let candidates;
        try {
            candidates = await model.generate({
                concept, topics, examples: seeds, count: want, avoid: avoid.slice(-30)
            });
        } catch (err) {
            onEvent({ type: 'batch_error', concept, error: err.message });
            break;
        }

        batches++;
        if (!candidates.length) { emptyBatches++; continue; }

        let acceptedThisBatch = 0;

        for (const candidate of candidates) {
            if (accepted.length >= target) break;

            const validated = validateCandidate(candidate);
            if (!validated.ok) { note(validated.reason); continue; }

            if (duplicates.isDuplicate(candidate.question_text, candidate.choices)) {
                note('duplicate');
                avoid.push(validated.question);
                continue;
            }

            if (verify) {
                let verdict;
                try {
                    verdict = await model.verify(candidate);
                } catch (err) {
                    onEvent({ type: 'verify_error', concept, error: err.message });
                    note('verification_mismatch');
                    continue;
                }
                const check = verificationMatches(validated, candidate, verdict);
                if (!check.ok) {
                    note(check.reason);
                    onEvent({
                        type: 'verification_failed',
                        concept,
                        question: validated.question,
                        key: candidate.answer,
                        got: verdict.answer,
                        reason: check.reason
                    });
                    avoid.push(validated.question);
                    continue;
                }
            }

            duplicates.add(candidate.question_text, candidate.choices);
            avoid.push(validated.question);
            accepted.push(toRow(candidate, {
                concept,
                sourceFile,
                questionNumber: accepted.length + 1
            }));
            acceptedThisBatch++;
            onEvent({ type: 'accepted', concept, question: validated.question });
        }

        emptyBatches = acceptedThisBatch === 0 ? emptyBatches + 1 : 0;
    }

    return { accepted, rejected, batches };
}

// Spread the seed examples across the cluster instead of taking the first N,
// which would all come from the same rounds.
function pickSeeds(examples, count) {
    if (examples.length <= count) return examples.slice();
    const step = examples.length / count;
    const out = [];
    for (let i = 0; i < count; i++) out.push(examples[Math.floor(i * step)]);
    return out;
}

module.exports = {
    REJECTIONS,
    validateCandidate,
    verificationMatches,
    toRow,
    pickSeeds,
    generateForConcept,
    DuplicateIndex
};
