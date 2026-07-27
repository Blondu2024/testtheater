import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyze } from '../src/index.js';
import { format, verdict } from '../src/report.js';
import { isTestFile } from '../src/files.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const theater = path.join(root, 'fixtures', 'theater-project');
const honest = path.join(root, 'fixtures', 'honest-project');
const cli = path.join(root, 'bin', 'testtheater.js');

test('scores the theater fixture the way it was written', () => {
  const result = analyze(theater);
  assert.strictEqual(result.fileCount, 2);
  assert.strictEqual(result.total, 11);
  assert.strictEqual(result.cannotFail, 7);
  assert.deepStrictEqual(result.byReason, {
    'no-assertion': 2,
    tautological: 1,
    empty: 1,
    skipped: 3,
    uncollected: 0,
  });
  assert.strictEqual(result.focused, 1);
  assert.strictEqual(result.snapshotOnly, 1);
  assert.strictEqual(result.score, 64);
});

test('reads a python suite with the same yardstick', () => {
  const result = analyze(path.join(root, 'fixtures', 'python-project'));
  assert.strictEqual(result.total, 7);
  assert.strictEqual(result.cannotFail, 6);
  assert.deepStrictEqual(result.byReason, {
    'no-assertion': 1,
    tautological: 1,
    empty: 1,
    skipped: 1,
    uncollected: 2,
  });
  assert.strictEqual(result.languages.py, 7);
  assert.strictEqual(result.score, 86);
});

test('gives the honest fixture a clean score', () => {
  const result = analyze(honest);
  assert.strictEqual(result.total, 3);
  assert.strictEqual(result.cannotFail, 0);
  assert.strictEqual(result.score, 0);
  assert.deepStrictEqual(result.findings, []);
});

test('every finding points at a file and a line', () => {
  const { findings } = analyze(theater);
  assert.strictEqual(findings.length, 7);
  for (const finding of findings) {
    assert.ok(finding.file.length > 0);
    assert.ok(finding.line > 0);
    assert.ok(['no-assertion', 'tautological', 'empty', 'skipped'].includes(finding.reason));
  }
});

test('ranks the worst file first', () => {
  const { files } = analyze(theater);
  assert.strictEqual(files[0].cannotFail >= files[1].cannotFail, true);
});

test('skips fixture directories unless asked', () => {
  const withoutFixtures = analyze(root);
  const withFixtures = analyze(root, { includeFixtures: true });
  assert.ok(withFixtures.total > withoutFixtures.total);
});

test('recognises which files are test files', () => {
  assert.ok(isTestFile('src/user.test.js'));
  assert.ok(isTestFile('src/user.spec.ts'));
  assert.ok(isTestFile(path.join('test', 'anything.js')));
  assert.ok(isTestFile(path.join('__tests__', 'anything.tsx')));
  assert.ok(!isTestFile('src/user.js'));
  assert.ok(!isTestFile(path.join('test', 'types.d.ts')));
});

test('reports nothing found without pretending it is a good score', () => {
  const empty = analyze(path.join(root, 'bin'));
  assert.strictEqual(empty.total, 0);
  assert.match(format(empty), /no tests found/);
});

test('the printed report names the count, the reasons and the verdict', () => {
  const output = format(analyze(theater));
  assert.match(output, /7 of them cannot fail/);
  assert.match(output, /no assertion/);
  assert.match(output, /skipped or todo/);
  assert.match(output, /focused/);
  assert.match(output, /snapshot-only/);
  assert.match(output, /score 64/);
});

test('a mixed repo says how many tests came from each language', () => {
  const mixed = {
    root: 'x', files: [], fileCount: 2, languages: { js: 4, py: 7 }, total: 11,
    cannotFail: 0, byReason: { 'no-assertion': 0, tautological: 0, empty: 0, skipped: 0, uncollected: 0 },
    focused: 0, snapshotOnly: 0, score: 0, findings: [],
  };
  assert.match(format(mixed), /\(4 javascript, 7 python\)/);
  assert.doesNotMatch(format(analyze(honest)), /javascript, /);
});

test('the verdict gets harsher as the score climbs', () => {
  assert.match(verdict(0), /can fail/);
  assert.match(verdict(3), /mostly real/);
  assert.match(verdict(64), /screensaver/);
});

test('the cli prints json when asked', () => {
  const output = execFileSync(process.execPath, [cli, theater, '--json'], { encoding: 'utf8' });
  const parsed = JSON.parse(output);
  assert.strictEqual(parsed.score, 64);
  assert.strictEqual(parsed.total, 11);
  assert.ok(parsed.verdict.length > 0);
});

test('the cli fails the build when the score is above --max', () => {
  assert.throws(
    () => execFileSync(process.execPath, [cli, theater, '--max', '10'], { encoding: 'utf8', stdio: 'pipe' }),
    (error) => error.status === 1
  );
  const passing = execFileSync(process.execPath, [cli, honest, '--max', '10'], { encoding: 'utf8' });
  assert.match(passing, /score 0/);
});

test('the cli refuses a path that does not exist', () => {
  assert.throws(
    () => execFileSync(process.execPath, [cli, path.join(root, 'nope')], { encoding: 'utf8', stdio: 'pipe' }),
    (error) => error.status === 2
  );
});
