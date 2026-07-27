import assert from 'node:assert';
import { add, divide, parse } from '../src/math.js';

test('adds two numbers', () => {
  expect(add(1, 2)).toBe(3);
});

test('refuses to divide by zero', () => {
  assert.throws(() => divide(1, 0), /divide by zero/);
});

test('parses a decimal string', () => {
  const value = parse('3.5');
  assert.strictEqual(value, 3.5);
});
