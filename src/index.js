import fs from 'node:fs';
import path from 'node:path';
import { findTestFiles, languageOf } from './files.js';
import { findTests } from './parse.js';
import { findPythonTests } from './python.js';
import { classify } from './checks.js';

export const REASONS = ['no-assertion', 'tautological', 'empty', 'skipped', 'uncollected'];

export const REASON_LABELS = {
  'no-assertion': 'no assertion',
  tautological: 'tautological assertion',
  empty: 'empty body',
  skipped: 'skipped or todo',
  uncollected: 'never collected by pytest',
};

export function analyze(root, options = {}) {
  const absolute = path.resolve(root);
  const files = findTestFiles(absolute, options);

  const byReason = Object.fromEntries(REASONS.map((r) => [r, 0]));
  const findings = [];
  const fileSummaries = [];
  const languages = { js: 0, py: 0 };
  let total = 0;
  let cannotFail = 0;
  let focused = 0;
  let snapshotOnly = 0;

  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const relative = path.relative(absolute, file) || path.basename(file);
    const language = languageOf(file);
    const cases = language === 'py' ? findPythonTests(source) : findTests(source);
    let fileCannotFail = 0;

    for (const testCase of cases) {
      const verdict = classify(testCase);
      total++;
      if (testCase.focused) focused++;
      if (verdict.snapshotOnly) snapshotOnly++;
      if (!verdict.canFail) {
        cannotFail++;
        fileCannotFail++;
        byReason[verdict.reason]++;
        findings.push({
          file: relative,
          line: testCase.line,
          name: testCase.name,
          reason: verdict.reason,
        });
      }
    }

    if (cases.length > 0) {
      fileSummaries.push({ file: relative, tests: cases.length, cannotFail: fileCannotFail, language });
      languages[language] += cases.length;
    }
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  fileSummaries.sort((a, b) => b.cannotFail - a.cannotFail || b.tests - a.tests);

  const score = total === 0 ? 0 : Math.round((cannotFail / total) * 100);

  return {
    root: absolute,
    files: fileSummaries,
    fileCount: fileSummaries.length,
    languages,
    total,
    cannotFail,
    byReason,
    focused,
    snapshotOnly,
    score,
    findings,
  };
}
