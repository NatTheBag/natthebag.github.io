#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const csv = require('./csv');
const bank = require('./bank');
const { QuestionModel } = require('./model');
const pipeline = require('./pipeline');
const { FakeModel } = require('./fake-model');

const DEFAULT_OUT = path.join(bank.SCIBOWL_DIR, 'questions-generated.csv');

const USAGE = `
Generate new Science Bowl practice questions with the Claude API.

  node generate.js [options]

Options
  --concept <name>     Concept cluster to generate for; repeatable.
                       Default: every cluster in questions.csv.
  --count <n>          Questions to accept per concept (default 10).
  --batch-size <n>     Questions requested per API call (default 8).
  --seeds <n>          Few-shot examples per prompt (default 8).
  --model <id>         Default claude-opus-5.
  --effort <level>     low | medium | high | xhigh | max (default high).
  --max-tokens <n>     Per-response cap (default 16000).
  --out <path>         Output CSV (default scibowl/questions-generated.csv).
  --append             Merge into the existing output file instead of replacing.
  --no-verify          Skip the cold re-answer check. Halves cost, and ships
                       questions nothing has checked. Not recommended.
  --dry-run            Run the whole pipeline against a stub model. No API
                       calls, no key needed, nothing written unless --out.
  --list-concepts      Print the clusters and their question counts, then exit.
  -h, --help           This message.

Credentials come from ANTHROPIC_API_KEY, or an \`ant auth login\` profile.
`.trim();

function parseArgs(argv) {
    const opts = {
        concepts: [],
        count: 10,
        batchSize: 8,
        seeds: 8,
        model: 'claude-opus-5',
        effort: 'high',
        maxTokens: 16000,
        out: DEFAULT_OUT,
        append: false,
        verify: true,
        dryRun: false,
        listConcepts: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => {
            const v = argv[++i];
            if (v === undefined) throw new Error(`${arg} needs a value`);
            return v;
        };

        switch (arg) {
            case '--concept': opts.concepts.push(next().toLowerCase()); break;
            case '--count': opts.count = Number(next()); break;
            case '--batch-size': opts.batchSize = Number(next()); break;
            case '--seeds': opts.seeds = Number(next()); break;
            case '--model': opts.model = next(); break;
            case '--effort': opts.effort = next(); break;
            case '--max-tokens': opts.maxTokens = Number(next()); break;
            case '--out': opts.out = path.resolve(next()); break;
            case '--append': opts.append = true; break;
            case '--no-verify': opts.verify = false; break;
            case '--dry-run': opts.dryRun = true; break;
            case '--list-concepts': opts.listConcepts = true; break;
            case '-h':
            case '--help': opts.help = true; break;
            default: throw new Error(`Unknown option: ${arg}`);
        }
    }

    for (const [k, v] of Object.entries({
        count: opts.count, batchSize: opts.batchSize,
        seeds: opts.seeds, maxTokens: opts.maxTokens
    })) {
        if (!Number.isFinite(v) || v <= 0) throw new Error(`--${k} must be a positive number`);
    }
    return opts;
}

async function buildModel(opts) {
    if (opts.dryRun) return new FakeModel();

    let Anthropic;
    try {
        Anthropic = require('@anthropic-ai/sdk');
    } catch {
        throw new Error(
            'The Anthropic SDK is not installed. Run `npm install` in tools/generate-questions/ ' +
            '(or use --dry-run to exercise the pipeline without it).'
        );
    }

    // Zero-arg construction resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN,
    // or an `ant auth login` profile — don't demand the env var specifically.
    const client = new Anthropic();
    return new QuestionModel({
        client,
        model: opts.model,
        effort: opts.effort,
        maxTokens: opts.maxTokens
    });
}

function logEvent(event) {
    switch (event.type) {
        case 'accepted':
            process.stdout.write('.');
            break;
        case 'verification_failed':
            process.stdout.write('x');
            break;
        case 'batch_error':
        case 'verify_error':
            console.error(`\n  ! ${event.type} (${event.concept}): ${event.error}`);
            break;
    }
}

async function main() {
    let opts;
    try {
        opts = parseArgs(process.argv.slice(2));
    } catch (err) {
        console.error(err.message + '\n');
        console.error(USAGE);
        process.exit(2);
    }

    if (opts.help) { console.log(USAGE); return; }

    const { gradeable, byConcept } = bank.loadBank();
    const topicsByConcept = bank.loadConceptTopics();

    if (opts.listConcepts) {
        const rows = [...byConcept.entries()].sort((a, b) => b[1].length - a[1].length);
        for (const [name, list] of rows) {
            console.log(`${String(list.length).padStart(4)}  ${name}`);
        }
        console.log(`\n${rows.length} clusters, ${gradeable.length} gradeable questions.`);
        return;
    }

    const concepts = opts.concepts.length ? opts.concepts : [...byConcept.keys()].sort();
    const missing = concepts.filter(c => !byConcept.has(c));
    if (missing.length) {
        console.error(`No questions in the bank for: ${missing.join(', ')}`);
        console.error('Run with --list-concepts to see the available clusters.');
        process.exit(2);
    }

    // One duplicate index across the whole run: candidates are checked against
    // the existing bank, every previously generated question, and each other.
    const duplicates = new pipeline.DuplicateIndex();
    for (const row of gradeable) duplicates.add(row.question_text, row.choices);

    let existing = [];
    if (opts.append && fs.existsSync(opts.out)) {
        existing = csv.parse(fs.readFileSync(opts.out, 'utf8')).rows;
        for (const row of existing) duplicates.add(row.question_text, row.choices);
        console.log(`Appending to ${existing.length} questions already in ${path.basename(opts.out)}`);
    }

    const model = await buildModel(opts);
    const sourceFile = `generated/${new Date().toISOString().slice(0, 10)}`;

    console.log(
        `${opts.dryRun ? '[dry run] ' : ''}${opts.model} · effort ${opts.effort} · ` +
        `${opts.verify ? 'verified' : 'UNVERIFIED'} · ${opts.count} per concept · ` +
        `${concepts.length} concept${concepts.length === 1 ? '' : 's'}\n`
    );

    const produced = [];
    const rejectedTotals = {};

    for (const concept of concepts) {
        process.stdout.write(`${concept.padEnd(18)} `);

        const result = await pipeline.generateForConcept({
            model,
            concept,
            topics: topicsByConcept.get(concept),
            examples: byConcept.get(concept),
            target: opts.count,
            batchSize: opts.batchSize,
            seedCount: opts.seeds,
            duplicates,
            sourceFile,
            verify: opts.verify,
            onEvent: logEvent
        });

        for (const [reason, n] of Object.entries(result.rejected)) {
            rejectedTotals[reason] = (rejectedTotals[reason] || 0) + n;
        }
        produced.push(...result.accepted);
        console.log(` ${result.accepted.length}/${opts.count}`);
    }

    // Renumber across the whole file so question_number is unique.
    const all = existing.concat(produced);
    all.forEach((row, i) => { row.question_number = String(i + 1); });

    fs.writeFileSync(opts.out, csv.stringify(all));

    console.log(`\nAccepted ${produced.length} question${produced.length === 1 ? '' : 's'}.`);
    const rejections = Object.entries(rejectedTotals).sort((a, b) => b[1] - a[1]);
    if (rejections.length) {
        console.log('Rejected: ' + rejections.map(([r, n]) => `${r} ${n}`).join(', '));
    }
    if (model.usage) {
        const u = model.usage;
        console.log(
            `Usage: ${u.calls} calls, ${u.input} in / ${u.output} out, ` +
            `${u.cacheRead} cache read, ${u.cacheWrite} cache write`
        );
    }
    console.log(`Wrote ${all.length} row${all.length === 1 ? '' : 's'} to ${opts.out}`);
    if (opts.dryRun) {
        console.log(
            '\nThe stub model writes from a small fixed vocabulary, so a dry run over\n' +
            'many concepts reports a duplicate rate that says nothing about the real\n' +
            'model. Read it as a plumbing check, not a yield estimate.'
        );
    }
    if (produced.length) {
        console.log(
            '\nSpot-check a sample before committing, then practise them at\n' +
            '  scibowl/practice.html?concept=<name>&generated=1'
        );
    }
}

main().catch(err => {
    console.error(`\n${err.stack || err.message}`);
    process.exit(1);
});
