'use strict';

// Stub used by --dry-run and the tests. Same interface as QuestionModel, no
// network. It deliberately emits a mix of good candidates, malformed ones, and
// answers its own questions wrong some of the time, so a dry run exercises
// every branch of the pipeline — including the rejection paths.
//
// It reads candidate.answer inside verify(), which the real verifier never
// sees. That's the point: the stub is checking the plumbing, not the science.

// Distinct subject words so stub questions aren't near-duplicates of each
// other — otherwise the duplicate filter eats the batch and the verification
// path never runs in a dry run.
const SUBJECTS = [
    'ribosome', 'tectonic drift', 'enthalpy', 'refraction', 'the mantissa',
    'osmosis', 'the Doppler shift', 'valence shells', 'a parabola', 'entropy',
    'meiosis', 'the Coriolis effect', 'a catalyst', 'angular momentum',
    'logarithms', 'capillary action', 'isotopes', 'the photoelectric effect',
    'vector fields', 'sedimentation', 'chlorophyll', 'half-life', 'buoyancy',
    'the unit circle', 'plate subduction', 'enzymes', 'diffraction gratings',
    'molarity', 'derivatives', 'seismic waves'
];

// Second axis, so a 35-concept dry run doesn't run out of distinct questions
// and report a duplicate rate that says nothing about the real model.
const SETTINGS = [
    'a sealed container', 'the upper atmosphere', 'a saturated solution',
    'the ocean floor', 'a superconducting loop', 'a eukaryotic cell',
    'low earth orbit', 'a laboratory centrifuge', 'a volcanic vent',
    'a hydraulic press', 'a plant stem', 'a particle accelerator'
];

const subject = n => SUBJECTS[n % SUBJECTS.length];
const setting = n => SETTINGS[(n * 7) % SETTINGS.length];

const TEMPLATES = [
    {
        format: 'Short Answer',
        question: n => `Which single term names the process that governs ${subject(n)} within ${setting(n)}?`,
        answer: n => `STUB TERM ${n} (ACCEPT: STUB ANSWER ${n})`
    },
    {
        format: 'Multiple Choice',
        question: n => `Considering ${setting(n)}, which statement about ${subject(n)} is correct?`,
        choices: n => `W) ${subject(n)} increases without bound in ${setting(n)} ` +
            `| X) ${subject(n)} depends on the temperature of ${setting(n)} ` +
            `| Y) ${subject(n)} is independent of the pressure in ${setting(n)} ` +
            `| Z) ${subject(n)} reverses at equilibrium in ${setting(n)}`,
        answer: n => `X) ${subject(n).toUpperCase()} DEPENDS ON THE TEMPERATURE OF ${setting(n).toUpperCase()}`
    },
    {
        format: 'Short Answer',
        question: n => `Giving your answer in meters, find the displacement produced by ${subject(n)} in ${setting(n)} over ${n} seconds.`,
        answer: n => `${n * 3} METERS`
    }
];

// Malformed candidates, injected on a fixed cycle so each rejection path runs.
const DEFECTS = [
    n => ({
        format: 'Multiple Choice', category: 'PHYSICS',
        question_text: `Stub defect ${n}: answer not among the choices?`,
        choices: `W) alpha | X) beta | Y) gamma | Z) delta`,
        answer: 'Y) EPSILON'
    }),
    n => ({
        format: 'Short Answer', category: 'BIOLOGY',
        question_text: `Stub defect ${n}: leaked key? ANSWER: MITOCHONDRION`,
        choices: '',
        answer: 'MITOCHONDRION'
    }),
    n => ({
        format: 'Multiple Choice', category: 'CHEMISTRY',
        question_text: `Stub defect ${n}: only one choice offered?`,
        choices: 'W) the only option',
        answer: 'W) THE ONLY OPTION'
    }),
    n => ({
        format: 'Short Answer', category: 'MATH',
        question_text: '',
        choices: '',
        answer: 'NOTHING'
    })
];

const CATEGORIES = ['BIOLOGY', 'CHEMISTRY', 'PHYSICS', 'MATH', 'EARTH AND SPACE'];

class FakeModel {
    constructor({ failVerifyEvery = 5, defectEvery = 7 } = {}) {
        this.failVerifyEvery = failVerifyEvery;
        this.defectEvery = defectEvery;
        this.counter = 0;
        this.verifyCount = 0;
        this.usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 };
        this.generateCalls = [];
    }

    async generate({ concept, topics, examples, count, avoid }) {
        this.generateCalls.push({ concept, topics, seeds: examples.length, count, avoid });
        this.usage.calls++;
        this.usage.input += 2000;
        this.usage.output += 400 * count;

        const out = [];
        for (let i = 0; i < count; i++) {
            const n = ++this.counter;
            if (n % this.defectEvery === 0) {
                out.push(DEFECTS[(n / this.defectEvery) % DEFECTS.length | 0](n));
                continue;
            }
            const t = TEMPLATES[n % TEMPLATES.length];
            out.push({
                format: t.format,
                category: CATEGORIES[n % CATEGORIES.length],
                question_text: t.question(n),
                choices: t.choices ? t.choices(n) : '',
                answer: t.answer(n)
            });
        }
        return out;
    }

    async verify(candidate) {
        this.verifyCount++;
        this.usage.calls++;
        this.usage.input += 200;
        this.usage.output += 30;

        if (this.verifyCount % this.failVerifyEvery === 0) {
            return { answer: 'SOMETHING ENTIRELY DIFFERENT', answerable: true };
        }
        // Strip the ACCEPT clause so the grader's alternative handling is what
        // actually decides the match, not a byte-identical string.
        const bare = candidate.answer.replace(/\s*\(ACCEPT:[^)]*\)?/i, '').trim();
        return { answer: bare, answerable: true };
    }
}

module.exports = { FakeModel, TEMPLATES, DEFECTS };
