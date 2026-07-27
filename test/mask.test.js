import { test } from 'node:test';
import assert from 'node:assert';
import { mask } from '../src/mask.js';

test('keeps identifiers untouched', () => {
  const src = 'const a = expect(1);';
  assert.strictEqual(mask(src), src);
});

test('blanks line comment contents but keeps length', () => {
  const src = 'const a = 1; // expect(2).toBe(2)\nconst b = 2;';
  const out = mask(src);
  assert.strictEqual(out.length, src.length);
  assert.ok(!out.includes('expect'));
  assert.ok(out.includes('const b = 2;'));
});

test('blanks block comment contents and keeps newlines', () => {
  const src = 'a;\n/* it("x", () => {\n  expect(1);\n}) */\nb;';
  const out = mask(src);
  assert.strictEqual(out.length, src.length);
  assert.ok(!out.includes('expect'));
  assert.strictEqual(out.split('\n').length, src.split('\n').length);
});

test('blanks string contents but keeps the quotes', () => {
  const src = `const s = 'expect(1).toBe(1)';`;
  const out = mask(src);
  assert.ok(!out.includes('expect'));
  assert.ok(out.includes(`'`));
  assert.strictEqual(out.length, src.length);
});

test('blanks template literal contents', () => {
  const src = 'const s = `assert.ok(true)`;';
  const out = mask(src);
  assert.ok(!out.includes('assert'));
  assert.strictEqual(out.length, src.length);
});

test('does not treat a quote inside a regex literal as a string start', () => {
  const src = `const re = /['"]/; expect(1).toBe(1);`;
  const out = mask(src);
  assert.ok(out.includes('expect(1).toBe(1)'));
});

test('does not treat division as a regex', () => {
  const src = `const half = total / 2; expect(half).toBe(1);`;
  const out = mask(src);
  assert.ok(out.includes('expect(half).toBe(1)'));
});

test('handles escaped quotes inside strings', () => {
  const src = `const s = 'it\\'s fine'; expect(2).toBe(2);`;
  const out = mask(src);
  assert.ok(out.includes('expect(2).toBe(2)'));
});
