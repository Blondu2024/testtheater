import { test } from 'node:test';
import assert from 'node:assert';
import { classify } from '../src/checks.js';

const at = (body, extra = {}) => classify({ name: 'x', line: 1, body, skipped: false, focused: false, ...extra });

test('a real expect assertion can fail', () => {
  const r = at('expect(add(1, 2)).toBe(3);');
  assert.strictEqual(r.reason, null);
});

test('a test with no assertion at all cannot fail', () => {
  const r = at('const user = buildUser();\nconsole.log(user);');
  assert.strictEqual(r.reason, 'no-assertion');
});

test('an empty body counts as empty, not as no-assertion', () => {
  assert.strictEqual(at('').reason, 'empty');
  assert.strictEqual(at('   \n  ').reason, 'empty');
});

test('a skipped test is reported as skipped even if it has assertions', () => {
  const r = at('expect(1).toBe(2);', { skipped: true });
  assert.strictEqual(r.reason, 'skipped');
});

test('recognises node:assert style assertions', () => {
  assert.strictEqual(at('assert.strictEqual(sum, 3);').reason, null);
  assert.strictEqual(at('assert.deepStrictEqual(a, b);').reason, null);
  assert.strictEqual(at('strictEqual(a, b);').reason, null);
  assert.strictEqual(at('t.assert.ok(isReady);').reason, null);
});

test('recognises chai and should style assertions', () => {
  assert.strictEqual(at('result.should.equal(3);').reason, null);
  assert.strictEqual(at('expect(result).to.equal(3);').reason, null);
});

test('expect(true).toBe(true) is tautological', () => {
  assert.strictEqual(at('expect(true).toBe(true);').reason, 'tautological');
});

test('comparing a literal with itself is tautological', () => {
  assert.strictEqual(at('expect(1).toBe(1);').reason, 'tautological');
  assert.strictEqual(at(`expect('ok').toEqual('ok');`).reason, 'tautological');
});

test('comparing a variable with itself is tautological', () => {
  assert.strictEqual(at('expect(user).toEqual(user);').reason, 'tautological');
});

test('assert(true) and assert.ok(true) are tautological', () => {
  assert.strictEqual(at('assert(true);').reason, 'tautological');
  assert.strictEqual(at('assert.ok(true);').reason, 'tautological');
  assert.strictEqual(at('assert.strictEqual(1, 1);').reason, 'tautological');
});

test('expect(true).toBeTruthy() is tautological', () => {
  assert.strictEqual(at('expect(true).toBeTruthy();').reason, 'tautological');
  assert.strictEqual(at('expect(null).toBeNull();').reason, 'tautological');
});

test('one real assertion next to a tautological one saves the test', () => {
  const r = at('expect(true).toBe(true);\nexpect(sum).toBe(3);');
  assert.strictEqual(r.reason, null);
});

test('a snapshot-only test is flagged separately and still counted as able to fail', () => {
  const r = at('expect(render()).toMatchSnapshot();');
  assert.strictEqual(r.reason, null);
  assert.strictEqual(r.snapshotOnly, true);
});

test('a snapshot plus a real assertion is not flagged as snapshot-only', () => {
  const r = at('expect(render()).toMatchSnapshot();\nexpect(calls).toBe(1);');
  assert.strictEqual(r.snapshotOnly, false);
});

test('assertions hidden in a comment do not save a test', () => {
  const r = at('// expect(sum).toBe(3);\nrun();');
  assert.strictEqual(r.reason, 'no-assertion');
});

test('an assertion inside a string does not save a test', () => {
  const r = at(`log('expect(sum).toBe(3)');`);
  assert.strictEqual(r.reason, 'no-assertion');
});

test('a rejects assertion counts as a real assertion', () => {
  assert.strictEqual(at('await assert.rejects(() => go());').reason, null);
  assert.strictEqual(at('await expect(go()).rejects.toThrow();').reason, null);
});
