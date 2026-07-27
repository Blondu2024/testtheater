import { test } from 'node:test';
import assert from 'node:assert';
import { findTests } from '../src/parse.js';

test('finds a plain test case with its name, line and body', () => {
  const src = [
    `it('adds numbers', () => {`,
    `  expect(add(1, 2)).toBe(3);`,
    `});`,
  ].join('\n');
  const found = findTests(src);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].name, 'adds numbers');
  assert.strictEqual(found[0].line, 1);
  assert.ok(found[0].body.includes('toBe(3)'));
  assert.strictEqual(found[0].skipped, false);
});

test('finds both it() and test()', () => {
  const src = `it('a', () => { expect(1).toBe(2); });\ntest('b', () => { expect(1).toBe(2); });`;
  assert.strictEqual(findTests(src).length, 2);
});

test('ignores describe blocks as test cases', () => {
  const src = `describe('group', () => { it('a', () => { expect(1).toBe(2); }); });`;
  const found = findTests(src);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].name, 'a');
});

test('marks it.skip, xit and test.todo as skipped', () => {
  const src = [
    `it.skip('one', () => { expect(1).toBe(2); });`,
    `xit('two', () => { expect(1).toBe(2); });`,
    `test.todo('three');`,
  ].join('\n');
  const found = findTests(src);
  assert.strictEqual(found.length, 3);
  assert.ok(found.every((t) => t.skipped));
});

test('marks tests inside describe.skip as skipped', () => {
  const src = `describe.skip('group', () => {\n  it('a', () => { expect(1).toBe(2); });\n});`;
  const found = findTests(src);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].skipped, true);
});

test('marks it.only as focused', () => {
  const src = `it.only('a', () => { expect(1).toBe(2); });`;
  const found = findTests(src);
  assert.strictEqual(found[0].focused, true);
});

test('handles a test declared with an async function expression', () => {
  const src = `test('a', async function () {\n  await go();\n  expect(1).toBe(2);\n});`;
  const found = findTests(src);
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].body.includes('await go()'));
});

test('handles the node:test signature with a t argument', () => {
  const src = `test('a', async (t) => {\n  t.assert.ok(true);\n});`;
  const found = findTests(src);
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].body.includes('t.assert.ok'));
});

test('handles test.each where the callback is in a second call group', () => {
  const src = `test.each([1, 2])('case %i', (n) => {\n  expect(n).toBe(n);\n});`;
  const found = findTests(src);
  assert.strictEqual(found.length, 1);
  assert.ok(found[0].body.includes('expect(n)'));
});

test('treats a test with no callback as a pending test', () => {
  const src = `it('some day this will work');`;
  const found = findTests(src);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].skipped, true);
  assert.strictEqual(found[0].body, '');
});

test('does not pick up the word test inside a string or comment', () => {
  const src = `const s = "it('fake', () => {})"; // it('also fake', () => {})`;
  assert.strictEqual(findTests(src).length, 0);
});

test('does not pick up a method call ending in test', () => {
  const src = `if (re.test('abc')) { run(); }`;
  assert.strictEqual(findTests(src).length, 0);
});

test('reports the correct line number for a nested test', () => {
  const src = `describe('a', () => {\n\n  it('b', () => {\n    expect(1).toBe(2);\n  });\n});`;
  assert.strictEqual(findTests(src)[0].line, 3);
});
