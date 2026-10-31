/* ══════════════════════════════════════════════════════════════════════
   QUESTION / ANSWER PARSING — shared by practice.html and tools/

   Loaded in the browser with a plain <script src> (everything lands on
   window) and required from Node by tools/generate-questions. Keeping one
   implementation means the generator grades candidate questions with the
   exact rules the practice page will grade a student's answer by.
   ══════════════════════════════════════════════════════════════════════ */

const CHOICE_LETTERS = ['W', 'X', 'Y', 'Z'];

// A question sometimes runs on into its own answer and the header of the
// *next* question. Cut everything from the "ANSWER:" marker onward.
function cleanQuestionText(text) {
    if (!text) return '';
    return text
        .split(/ANSWER\s*:/i)[0]
        .replace(/\s*(?:High|Middle)\s+School\s+Round\s+\d+\s+Page\s+\d+.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Choices arrive as "W) basic X)  acidic | Y) neutral | Z) in equilibrium" —
// the pipe separator is missing about as often as it's present, so split on
// the W)/X)/Y)/Z) markers themselves and use the pipes only as a fallback.
function parseChoices(raw) {
    if (!raw || !raw.trim()) return [];

    const text = raw.split(/ANSWER\s*:/i)[0];
    const marker = /([WXYZ])\s*\)/g;
    const hits = [];
    let m;

    while ((m = marker.exec(text)) !== null) {
        // A marker has to start the string or follow a separator, otherwise
        // it's just a letter inside the choice text.
        const before = text[m.index - 1];
        if (m.index !== 0 && !/[\s|(]/.test(before || '')) continue;

        // Letters must run in order. This drops duplicated markers left
        // behind when the next question's choices bled into this row.
        const rank = CHOICE_LETTERS.indexOf(m[1].toUpperCase());
        if (hits.length && rank <= CHOICE_LETTERS.indexOf(hits[hits.length - 1].letter)) continue;

        hits.push({ letter: m[1].toUpperCase(), start: m.index, end: marker.lastIndex });
    }

    if (!hits.length) {
        return text.split('|')
            .map(s => tidyChoice(s))
            .filter(Boolean)
            .map((t, i) => ({ letter: CHOICE_LETTERS[i] || '', text: t }));
    }

    return hits
        .map((hit, i) => ({
            letter: hit.letter,
            text: tidyChoice(text.slice(hit.end, i + 1 < hits.length ? hits[i + 1].start : text.length))
        }))
        .filter(c => c.text);
}

function tidyChoice(t) {
    return (t || '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
}

// Which choice does the answer key point at? Prefer its letter ("W) BASIC"),
// fall back to matching the answer text. Returns -1 when neither works.
function resolveCorrectIndex(choices, rawAnswer) {
    const answer = (rawAnswer || '').trim();
    if (!answer) return -1;

    const byLetter = /^\s*([WXYZ])\s*\)/.exec(answer);
    if (byLetter) {
        const idx = choices.findIndex(c => c.letter === byLetter[1].toUpperCase());
        if (idx >= 0) return idx;
    }

    const target = squash(normalize(stripChoiceLetter(answer)));
    if (!target) return -1;
    return choices.findIndex(c => squash(normalize(c.text)) === target);
}

// "W) BASIC" and "Y ) REFLECTIVITY" both become the bare choice text.
function stripChoiceLetter(s) {
    return (s || '').replace(/^\s*[WXYZ]\s*\)\s*/i, '').trim();
}

// ── Normalisation ────────────────────────────────────────────────
function normalize(s) {
    return (s || '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')          // strip accents
        .toLowerCase()
        .replace(/[‘’ʼ]/g, "'")     // curly → straight quotes
        .replace(/[‐-―−]/g, '-')    // en/em dash, minus → hyphen
        .replace(/[^a-z0-9'./+\-\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Drop everything but letters and digits. This is what rescues OCR word
// splits: "CHOLESTER OL" and "cholesterol" collapse to the same string.
function squash(s) {
    return normalize(s).replace(/[^a-z0-9]/g, '');
}

// Articles carry no meaning in a one-word answer — unless the whole answer
// is the letter "A", which is a perfectly good Science Bowl answer.
function stripArticles(s) {
    const stripped = s.replace(/\b(?:the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
    return stripped || s;
}

const UNIT_ALIASES = {
    meters: 'm', meter: 'm', metres: 'm', metre: 'm',
    seconds: 's', second: 's', sec: 's',
    grams: 'g', gram: 'g',
    kilograms: 'kg', kilogram: 'kg',
    liters: 'l', liter: 'l', litres: 'l', litre: 'l',
    newtons: 'n', newton: 'n',
    joules: 'j', joule: 'j',
    watts: 'w', watt: 'w',
    moles: 'mol', mole: 'mol',
    degrees: 'deg', degree: 'deg',
    amperes: 'a', ampere: 'a', amps: 'a', amp: 'a',
    volts: 'v', volt: 'v',
    percent: '%'
};

function normalizeUnits(s) {
    return s.split(' ')
        .map(w => UNIT_ALIASES[w] || w)
        .join(' ')
        .replace(/\bper\b/g, '/')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Numbers ──────────────────────────────────────────────────────
// Splits "144 grams" into { value: 144, unit: 'g' }; returns null when the
// string doesn't start with a number.
function parseQuantity(s) {
    const t = normalize(s)
        // "10 ,000" / "10,000" → "10000", without touching list answers
        // like "2, 3, 4, 1" where the groups aren't three digits long.
        .replace(/(\d)[\s,]+(?=\d{3}(?:\D|$))/g, '$1');

    const m = /^([-+]?(?:\d+\.?\d*|\.\d+)(?:\s*[/]\s*\d+\.?\d*)?(?:\s*[eE]\s*[-+]?\d+)?)\s*(.*)$/.exec(t);
    if (!m) return null;

    const raw = m[1].replace(/\s+/g, '');
    let value;
    if (raw.includes('/')) {
        const [num, den] = raw.split('/').map(Number);
        if (!den) return null;
        value = num / den;
    } else {
        value = Number(raw);
    }
    if (!isFinite(value)) return null;

    return { value, unit: normalizeUnits(stripArticles(m[2])) };
}

function sameNumber(a, b) {
    if (a === b) return true;
    const scale = Math.max(Math.abs(a), Math.abs(b), 1);
    return Math.abs(a - b) <= 1e-9 * scale;
}

// ── Answer key parsing ───────────────────────────────────────────
// Pulls the acceptable answers out of a key like
//   "NORTH STAR (ACCEPT: POLARIS or ALPHA URSA MINORIS)"
// Parentheses that are *part* of the answer — "(0, 3)", "2x(x + 2)" — are
// left alone; only annotation parentheticals are peeled off.
function parseAnswerKey(rawAnswer) {
    const raw = (rawAnswer || '').replace(/\s+/g, ' ').trim();
    const accepted = [];
    const rejected = [];
    let anyOrder = false;
    let main = '';
    let i = 0;

    while (i < raw.length) {
        if (raw[i] !== '(') { main += raw[i++]; continue; }

        const close = raw.indexOf(')', i);
        const body = raw.slice(i + 1, close === -1 ? raw.length : close);
        const next = close === -1 ? raw.length : close + 1;

        if (/^\s*do\s*not\s*acc\s*ept/i.test(body)) {
            rejected.push(...splitAlternatives(body.replace(/^\s*do\s*not\s*acc\s*ept\s*:?\s*/i, '')));
            i = next;
        } else if (/^\s*(?:also\s+)?acc\s*ept/i.test(body)) {
            accepted.push(...splitAlternatives(body.replace(/^\s*(?:also\s+)?acc\s*ept\s*:?\s*/i, '')));
            i = next;
        } else if (/^\s*(?:in any order|must give units|solution\s*:)/i.test(body)) {
            if (/in any order/i.test(body)) anyOrder = true;
            i = next;
        } else {
            // Genuine content — coordinates, factored polynomials, ion charges.
            main += raw.slice(i, next);
            i = next;
        }
    }

    main = main.replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');

    // "4 OR -4" means either one is fine.
    const primaries = splitAlternatives(main);
    const all = [...primaries, ...accepted].filter(Boolean);

    // "ACCEPT: ANY ANSWER BETWEEN 0.1 AND 1000"
    let range = null;
    const rangeMatch = /between\s+([-+]?[\d.]+)\s+and\s+([-+]?[\d.]+)/i.exec(rawAnswer || '');
    if (rangeMatch) {
        const lo = Number(rangeMatch[1]), hi = Number(rangeMatch[2]);
        if (isFinite(lo) && isFinite(hi)) range = [Math.min(lo, hi), Math.max(lo, hi)];
    }

    return {
        display: raw,
        main: main || raw,
        accepted: all.length ? all : [raw],
        rejected,
        anyOrder,
        range
    };
}

// Splits on "or" and ";" only. Commas are left alone because they're just
// as likely to be holding a list together ("PETROLEUM, HYDROPOWER, COAL")
// as they are to be separating alternatives.
function splitAlternatives(s) {
    return (s || '')
        .split(/\s+or\s+|;|(?:\s+\/\s+)/i)
        .map(part => part.replace(/\s+/g, ' ').trim().replace(/^[,.;]+|[,.;]+$/g, ''))
        .filter(Boolean);
}

// ── Grading ──────────────────────────────────────────────────────
function gradeShortAnswer(userInput, rawAnswer) {
    const user = (userInput || '').trim();
    if (!user) return false;

    const key = parseAnswerKey(rawAnswer);

    // An explicit "DO NOT ACCEPT" beats everything else. Compared strictly:
    // near-misses shouldn't be pulled into a rejection the way they're
    // forgiven on the accept side — "BOMB CALORIMETER" must survive a
    // "DO NOT ACCEPT: CALORIMETER".
    if (key.rejected.some(bad => sameAnswer(user, bad))) return false;

    if (key.range) {
        const q = parseQuantity(user);
        if (q && q.value >= key.range[0] && q.value <= key.range[1]) return true;
    }

    return key.accepted.some(candidate => matchesCandidate(user, candidate, key.anyOrder));
}

function matchesCandidate(user, candidate, anyOrder) {
    if (looseEqual(user, candidate)) return true;

    // Numeric answers: compare values, not strings, so 24 = 24.0 = 24.00,
    // and a bare number is accepted where the key spells out the units.
    const a = parseQuantity(user);
    const b = parseQuantity(candidate);
    if (a && b && sameNumber(a.value, b.value)) return unitsCompatible(a.unit, b.unit);
    if (a || b) return false; // one side is a number, the other isn't

    // "MERCURY; VENUS; MARS (in any order)" — grade as a set.
    if (anyOrder) {
        const toSet = s => new Set(s.split(/[;,]|\band\b/i).map(p => squash(p)).filter(Boolean));
        const ua = toSet(user), ca = toSet(candidate);
        if (ca.size > 1 && ua.size === ca.size && [...ca].every(p => ua.has(p))) return true;
    }

    const u = squash(stripArticles(normalize(user)));
    const c = squash(stripArticles(normalize(candidate)));
    if (!u || !c) return false;
    if (u === c) return true;

    // "diffraction of light" for "DIFFRACTION". Only for answers long
    // enough that containment isn't a coincidence.
    if (c.length >= 6 && u.includes(c)) return true;

    // Typos, scaled to answer length. Kept deliberately tight: a two-edit
    // budget would let "genotype" pass for "phenotype".
    const budget = c.length <= 5 ? 0 : c.length <= 12 ? 1 : 2;
    return budget > 0 && editDistance(u, c) <= budget;
}

// Units are compared loosely because the answer keys spell them out and
// students abbreviate: "m/s" for "meters per second", "g" for "grams".
// An abbreviation has to start with the same letter, so "s" doesn't sneak
// past "meters per second".
function unitsCompatible(a, b) {
    if (!a || !b) return true; // one side didn't state units
    const ua = squash(a), ub = squash(b);
    if (ua === ub) return true;
    if (editDistance(ua, ub) <= 1) return true;

    const [short, long] = ua.length <= ub.length ? [ua, ub] : [ub, ua];
    if (short[0] !== long[0]) return false;
    let i = 0;
    for (const ch of long) if (ch === short[i]) i++;
    return i === short.length; // short is an abbreviation of long
}

function looseEqual(a, b) {
    const na = squash(stripArticles(normalize(a)));
    const nb = squash(stripArticles(normalize(b)));
    return !!na && na === nb;
}

// Exact match, but aware that squash() throws away signs: "-6" and "6"
// squash to the same thing and must not be treated as the same answer.
function sameAnswer(a, b) {
    const qa = parseQuantity(a), qb = parseQuantity(b);
    if (qa && qb) return sameNumber(qa.value, qb.value) && squash(qa.unit) === squash(qb.unit);
    if (qa || qb) return false;
    return looseEqual(a, b);
}

// Optimal string alignment distance — Levenshtein plus transpositions, so a
// swapped pair of letters ("diffractoin") costs one edit rather than two.
function editDistance(a, b) {
    if (a === b) return 0;
    if (!a.length || !b.length) return Math.max(a.length, b.length);
    if (Math.abs(a.length - b.length) > 4) return 99; // far enough, don't bother

    const rows = [Array.from({ length: b.length + 1 }, (_, j) => j)];
    for (let i = 1; i <= a.length; i++) {
        const curr = [i];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let best = Math.min(rows[i - 1][j] + 1, curr[j - 1] + 1, rows[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                best = Math.min(best, rows[i - 2][j - 2] + 1);
            }
            curr[j] = best;
        }
        rows.push(curr);
    }
    return rows[a.length][b.length];
}

// Node (tools/) — the browser ignores this branch.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CHOICE_LETTERS,
        cleanQuestionText,
        parseChoices,
        tidyChoice,
        resolveCorrectIndex,
        stripChoiceLetter,
        normalize,
        squash,
        stripArticles,
        parseQuantity,
        sameNumber,
        parseAnswerKey,
        splitAlternatives,
        gradeShortAnswer,
        matchesCandidate,
        looseEqual,
        sameAnswer,
        unitsCompatible,
        editDistance
    };
}
