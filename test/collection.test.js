import { test } from 'node:test';
import assert from 'node:assert';
import { findPythonTests } from '../src/python.js';
import { classify } from '../src/checks.js';

test('a test method in a class pytest does not collect is marked uncollected', () => {
  const src = [
    'class FirebaseAuthTester:',
    '    def test_login(self):',
    '        assert login() == 200',
  ].join('\n');
  const found = findPythonTests(src);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].uncollected, true);
});

test('a class named Test is collected', () => {
  const src = ['class TestAuth:', '    def test_login(self):', '        assert login() == 200'].join('\n');
  assert.strictEqual(findPythonTests(src)[0].uncollected, false);
});

test('a unittest.TestCase subclass is collected whatever it is called', () => {
  const src = [
    'class AuthChecks(unittest.TestCase):',
    '    def test_login(self):',
    '        self.assertEqual(login(), 200)',
  ].join('\n');
  assert.strictEqual(findPythonTests(src)[0].uncollected, false);
});

test('a Test class with an __init__ is not collected by pytest', () => {
  const src = [
    'class TestAuth:',
    '    def __init__(self):',
    '        self.token = None',
    '',
    '    def test_login(self):',
    '        assert login() == 200',
  ].join('\n');
  assert.strictEqual(findPythonTests(src)[0].uncollected, true);
});

test('a module level test function is always collected', () => {
  const src = ['def test_login():', '    assert login() == 200'].join('\n');
  assert.strictEqual(findPythonTests(src)[0].uncollected, false);
});

test('uncollected beats every other reason, including a real assertion', () => {
  const verdict = classify({
    name: 'test_login',
    line: 1,
    body: 'assert login() == 200',
    skipped: false,
    uncollected: true,
    language: 'py',
  });
  assert.strictEqual(verdict.reason, 'uncollected');
  assert.strictEqual(verdict.canFail, false);
});
