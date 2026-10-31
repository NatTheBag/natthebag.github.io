'use strict';

// Everything that talks to Claude. Two calls per batch:
//   1. generate — write N new questions for one concept, few-shot from the bank
//   2. verify   — answer one question cold, with no answer key in context
// The verifier's answer is graded by the same code the practice page uses; a
// question only ships if the model independently lands on its own key.

const CATEGORIES = [
    'BIOLOGY', 'CHEMISTRY', 'PHYSICS', 'MATH', 'EARTH AND SPACE',
    'ENERGY', 'GENERAL SCIENCE'
];

const GENERATION_SCHEMA = {
    type: 'object',
    properties: {
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    format: { type: 'string', enum: ['Short Answer', 'Multiple Choice'] },
                    category: { type: 'string', enum: CATEGORIES },
                    question_text: { type: 'string' },
                    choices: { type: 'string' },
                    answer: { type: 'string' }
                },
                required: ['format', 'category', 'question_text', 'choices', 'answer'],
                additionalProperties: false
            }
        }
    },
    required: ['questions'],
    additionalProperties: false
};

const VERIFICATION_SCHEMA = {
    type: 'object',
    properties: {
        answer: { type: 'string' },
        answerable: { type: 'boolean' }
    },
    required: ['answer', 'answerable'],
    additionalProperties: false
};

const SYSTEM_PROMPT = `You write practice questions for the U.S. Department of Energy National Science Bowl, at high school difficulty.

A Science Bowl question is short enough to be read aloud in about fifteen seconds and has exactly one defensible answer. Two formats:

Short Answer — the question is read, the student says the answer. The answer is a term, a number, or a short phrase.

Multiple Choice — four options labelled W, X, Y, Z. Exactly one is correct; the other three are wrong but plausible to a student who half-knows the material. Do not write throwaway distractors.

Output rules:

- question_text: the question only. No answer, no category header, no "TOSS-UP" or "BONUS" label, no round or page markers.
- choices: for Multiple Choice, "W) first | X) second | Y) third | Z) fourth" — every option prefixed with its letter, separated by " | ". For Short Answer, the empty string.
- answer: for Multiple Choice, the correct option with its letter, e.g. "X) SODIUM CHLORIDE" — the letter and the text must match one of the choices exactly. For Short Answer, the answer in caps.
- Acceptable alternatives go in the answer using the round-packet convention: "NORTH STAR (ACCEPT: POLARIS or ALPHA URSA MINORIS)". Include them whenever a student could reasonably phrase the answer another way — a synonym, a formula, a full name versus an abbreviation. This is graded literally, so an omitted alternative marks a correct student wrong.
- Numeric answers: state units in the answer when the quantity has them.
- Computational questions must be solvable in the time a student has at the buzzer. Verify your own arithmetic before writing the answer.

Write questions a knowledgeable student could answer from understanding rather than recall of one specific textbook. Avoid anything whose answer depends on a date, a current record, or a recent discovery.`;

function buildFewShot(examples) {
    return examples.map((row, i) => {
        const lines = [
            `Example ${i + 1} — ${row.format || 'Short Answer'}, ${row.category || ''}`.trim(),
            `Q: ${row.question_text.replace(/\s+/g, ' ').trim()}`
        ];
        if (row.choices && row.choices.trim()) lines.push(`Choices: ${row.choices.trim()}`);
        lines.push(`A: ${row.answer.trim()}`);
        return lines.join('\n');
    }).join('\n\n');
}

function buildGenerationPrompt({ concept, topics, examples, count, avoid }) {
    const parts = [];

    parts.push(`Concept cluster: ${concept.toUpperCase()}`);
    if (topics && topics.length) {
        parts.push(`Topics in this cluster: ${topics.join(', ')}.`);
    }
    parts.push(
        `Below are real questions from this cluster. Match their difficulty, phrasing, and length — not their subject matter.\n\n${buildFewShot(examples)}`
    );

    if (avoid && avoid.length) {
        parts.push(
            `You have already written these in this session. Write about something else:\n` +
            avoid.map(q => `- ${q}`).join('\n')
        );
    }

    parts.push(
        `Write ${count} new questions for this cluster. Cover different topics from each other and from the examples. ` +
        `Aim for roughly half Short Answer and half Multiple Choice.`
    );

    return parts;
}

// The verifier must not see the answer key, the concept, or the fact that the
// question was model-written — it is checking whether the question stands on
// its own.
const VERIFIER_SYSTEM = `You are answering a Science Bowl practice question. Give the answer only — no working, no explanation, no restatement of the question.

For a multiple choice question, answer with the letter and the option text, e.g. "X) SODIUM CHLORIDE".
For a short answer question, give the term, number, or short phrase.

Set answerable to false if the question is ambiguous, has more than one defensible answer, depends on information not given, or is not answerable as written.`;

class QuestionModel {
    constructor({ client, model, effort, maxTokens = 16000 }) {
        this.client = client;
        this.model = model;
        this.effort = effort;
        this.maxTokens = maxTokens;
        this.usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 };
    }

    recordUsage(usage) {
        if (!usage) return;
        this.usage.calls++;
        this.usage.input += usage.input_tokens || 0;
        this.usage.output += usage.output_tokens || 0;
        this.usage.cacheRead += usage.cache_read_input_tokens || 0;
        this.usage.cacheWrite += usage.cache_creation_input_tokens || 0;
    }

    async structured({ system, content, schema }) {
        // Streaming so a large max_tokens can't trip the SDK's HTTP timeout.
        const stream = this.client.messages.stream({
            model: this.model,
            max_tokens: this.maxTokens,
            system,
            messages: [{ role: 'user', content }],
            output_config: {
                effort: this.effort,
                format: { type: 'json_schema', schema }
            }
        });

        const message = await stream.finalMessage();
        this.recordUsage(message.usage);

        if (message.stop_reason === 'refusal') {
            const detail = message.stop_details || {};
            throw new Error(`Model declined the request (${detail.category || 'unspecified'})`);
        }
        if (message.stop_reason === 'max_tokens') {
            throw new Error('Response hit max_tokens — raise --max-tokens or lower --batch-size');
        }

        const text = message.content.find(b => b.type === 'text');
        if (!text) throw new Error('No text block in response');
        return JSON.parse(text.text);
    }

    async generate({ concept, topics, examples, count, avoid }) {
        const [header, exampleBlock, ...tail] = buildGenerationPrompt({
            concept, topics, examples, count, avoid
        });

        const result = await this.structured({
            system: [
                { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
            ],
            content: [
                { type: 'text', text: header },
                // Examples are identical across every batch for this concept —
                // cache here so later batches only pay for the tail.
                { type: 'text', text: exampleBlock, cache_control: { type: 'ephemeral' } },
                { type: 'text', text: tail.join('\n\n') }
            ],
            schema: GENERATION_SCHEMA
        });

        return Array.isArray(result.questions) ? result.questions : [];
    }

    async verify(candidate) {
        const lines = [candidate.question_text];
        if (candidate.choices && candidate.choices.trim()) {
            lines.push('', candidate.choices.trim());
        }

        return this.structured({
            system: VERIFIER_SYSTEM,
            content: [{ type: 'text', text: lines.join('\n') }],
            schema: VERIFICATION_SCHEMA
        });
    }
}

module.exports = {
    CATEGORIES,
    GENERATION_SCHEMA,
    VERIFICATION_SCHEMA,
    SYSTEM_PROMPT,
    VERIFIER_SYSTEM,
    QuestionModel,
    buildFewShot,
    buildGenerationPrompt
};
