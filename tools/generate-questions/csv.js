'use strict';

// Minimal CSV reader/writer matching what practice.html expects: one record
// per line, quoted fields for anything containing a comma or quote.

const COLUMNS = [
    'source_file', 'question_number', 'question_type', 'category', 'format',
    'question_text', 'choices', 'answer', 'predicted_concept', 'cluster_id', 'confidence'
];

function parseLine(line) {
    const out = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { field += '"'; i += 2; continue; }
            inQuotes = !inQuotes;
            i++;
            continue;
        }
        if (ch === ',' && !inQuotes) { out.push(field.trim()); field = ''; i++; continue; }
        field += ch;
        i++;
    }
    out.push(field.trim());
    return out;
}

function parse(text) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/);
    let header = 0;
    while (header < lines.length && !lines[header].trim()) header++;
    if (header >= lines.length) return { headers: [], rows: [] };

    const headers = parseLine(lines[header]);
    const rows = [];
    for (let i = header + 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = parseLine(lines[i]);
        const row = {};
        headers.forEach((h, j) => { row[h] = values[j] || ''; });
        rows.push(row);
    }
    return { headers, rows };
}

function escapeField(value) {
    const s = String(value == null ? '' : value)
        // A newline inside a field would split the record — the reader in
        // practice.html is line-oriented on purpose.
        .replace(/[\r\n]+/g, ' ')
        .trim();
    return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function stringify(rows, headers = COLUMNS) {
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map(h => escapeField(row[h])).join(','));
    }
    return lines.join('\n') + '\n';
}

module.exports = { COLUMNS, parse, parseLine, stringify };
