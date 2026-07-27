import { REASONS, REASON_LABELS } from './index.js';

const VERDICTS = [
  { upTo: 0, text: 'every test in here can fail. that is the whole job.' },
  { upTo: 5, text: 'mostly real.' },
  { upTo: 15, text: 'some of this suite is decoration.' },
  { upTo: 30, text: 'a lot of this suite is decoration.' },
  { upTo: 60, text: 'this suite is mostly theater.' },
  { upTo: 100, text: 'this suite is a screensaver with a green tick.' },
];

export function verdict(score) {
  return VERDICTS.find((v) => score <= v.upTo).text;
}

function paint(enabled) {
  const wrap = (code) => (s) => (enabled ? `[${code}m${s}[0m` : String(s));
  return {
    dim: wrap('2'),
    bold: wrap('1'),
    red: wrap('31'),
    green: wrap('32'),
    yellow: wrap('33'),
  };
}

function scoreColor(c, score) {
  if (score === 0) return c.green;
  if (score <= 15) return c.yellow;
  return c.red;
}

export function format(result, { color = false, all = false, limit = 10 } = {}) {
  const c = paint(color);
  const lines = [];
  const tint = scoreColor(c, result.score);

  lines.push('');
  lines.push(`  ${c.bold('testtheater')}  ${c.dim(result.root)}`);
  lines.push('');

  if (result.total === 0) {
    lines.push(`  ${c.yellow('no tests found')}`);
    lines.push(`  ${c.dim('looked for *.test.* / *.spec.* files and anything inside test/ or __tests__/')}`);
    lines.push('');
    return lines.join('\n');
  }

  const mixed = result.languages.js > 0 && result.languages.py > 0;
  const breakdown = mixed
    ? c.dim(`  (${result.languages.js} javascript, ${result.languages.py} python)`)
    : '';
  lines.push(
    `  ${result.fileCount} test ${result.fileCount === 1 ? 'file' : 'files'}, ${result.total} ${result.total === 1 ? 'test' : 'tests'}${breakdown}`
  );
  lines.push('');
  lines.push(
    `  ${tint(c.bold(`${result.cannotFail} of them cannot fail`))} ${c.dim(`(${result.score}%)`)}`
  );
  lines.push('');

  for (const reason of REASONS) {
    const count = result.byReason[reason];
    if (count === 0) continue;
    lines.push(`     ${String(count).padStart(4)}  ${REASON_LABELS[reason]}`);
  }

  const offenders = result.files.filter((f) => f.cannotFail > 0);
  if (offenders.length > 0) {
    lines.push('');
    lines.push(`  ${c.bold('worst files')}`);
    for (const file of offenders.slice(0, all ? offenders.length : 5)) {
      lines.push(`     ${String(`${file.cannotFail}/${file.tests}`).padStart(6)}  ${file.file}`);
    }
    if (!all && offenders.length > 5) {
      lines.push(`     ${c.dim(`... and ${offenders.length - 5} more`)}`);
    }
  }

  if (result.findings.length > 0) {
    const shown = all ? result.findings : result.findings.slice(0, limit);
    lines.push('');
    lines.push(`  ${c.bold('tests that cannot fail')}`);
    for (const finding of shown) {
      lines.push(
        `     ${c.dim(`${finding.file}:${finding.line}`)}  ${finding.name}  ${c.dim(`[${REASON_LABELS[finding.reason]}]`)}`
      );
    }
    if (!all && result.findings.length > shown.length) {
      lines.push(`     ${c.dim(`... and ${result.findings.length - shown.length} more, run with --all`)}`);
    }
  }

  const notes = [];
  if (result.focused > 0) {
    notes.push(
      `${result.focused} focused ${result.focused === 1 ? 'test' : 'tests'} (.only) — everything else in those files did not run`
    );
  }
  if (result.snapshotOnly > 0) {
    notes.push(
      `${result.snapshotOnly} snapshot-only ${result.snapshotOnly === 1 ? 'test' : 'tests'} — these can fail, but only against whatever the code did the day the snapshot was written`
    );
  }
  if (notes.length > 0) {
    lines.push('');
    lines.push(`  ${c.bold('also worth a look')}`);
    for (const note of notes) lines.push(`     ${note}`);
  }

  lines.push('');
  lines.push(`  ${tint(c.bold(`score ${result.score}`))}  ${c.dim(verdict(result.score))}`);
  lines.push('');

  return lines.join('\n');
}
