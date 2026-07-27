import { test } from 'node:test';
import assert from 'node:assert';
import { maskPython, findPythonTests } from '../src/python.js';
import { classify } from '../src/checks.js';

const py = (body, extra = {}) =>
  classify({ name: 'x', line: 1, body, skipped: false, focused: false, language: 'py', ...extra });

test('masks python comments and keeps length', () => {
  const src = 'x = 1  # assert x == 2\ny = 2';
  const out = maskPython(src);
  assert.strictEqual(out.length, src.length);
  assert.ok(!out.includes('assert'));
  assert.ok(out.includes('y = 2'));
});

test('masks docstrings, including the triple quoted ones', () => {
  const src = 'def f():\n    """assert nothing here\n    still inside\n    """\n    return 1';
  const out = maskPython(src);
  assert.ok(!out.includes('assert'));
  assert.strictEqual(out.split('\n').length, src.split('\n').length);
  assert.ok(out.includes('return 1'));
});

test('does not treat a hash inside a string as a comment', () => {
  const src = `url = "https://x/#frag"\nassert url\n`;
  const out = maskPython(src);
  assert.ok(out.includes('assert url'));
});

test('finds test functions with name, line and body', () => {
  const src = [
    'import pytest',
    '',
    'def test_adds():',
    '    result = add(1, 2)',
    '    assert result == 3',
    '',
    'def helper():',
    '    return 1',
  ].join('\n');
  const found = findPythonTests(src);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].name, 'test_adds');
  assert.strictEqual(found[0].line, 3);
  assert.ok(found[0].body.includes('assert result == 3'));
  assert.ok(!found[0].body.includes('def helper'));
});

test('finds async test functions and methods inside a class', () => {
  const src = [
    'class TestApi:',
    '    def test_root(self):',
    '        assert get("/") == 200',
    '',
    '    async def test_slow(self):',
    '        assert await get("/slow") == 200',
  ].join('\n');
  const found = findPythonTests(src);
  assert.deepStrictEqual(found.map((t) => t.name), ['test_root', 'test_slow']);
});

test('marks pytest and unittest skip decorators as skipped', () => {
  const src = [
    '@pytest.mark.skip(reason="flaky")',
    'def test_one():',
    '    assert 1 == 2',
    '',
    '@pytest.mark.skipif(sys.platform == "win32", reason="posix only")',
    'def test_two():',
    '    assert 1 == 2',
    '',
    '@unittest.skip("later")',
    'def test_three():',
    '    assert 1 == 2',
  ].join('\n');
  const found = findPythonTests(src);
  assert.strictEqual(found.length, 3);
  assert.ok(found.every((t) => t.skipped));
});

test('marks methods of a skipped class as skipped', () => {
  const src = [
    '@pytest.mark.skip',
    'class TestBroken:',
    '    def test_a(self):',
    '        assert 1 == 2',
  ].join('\n');
  assert.strictEqual(findPythonTests(src)[0].skipped, true);
});

test('marks a body that calls pytest.skip as skipped', () => {
  const src = ['def test_a():', '    pytest.skip("not ready")', '    assert 1 == 2'].join('\n');
  assert.strictEqual(findPythonTests(src)[0].skipped, true);
});

test('does not confuse a decorator that is not a skip', () => {
  const src = ['@pytest.mark.parametrize("n", [1, 2])', 'def test_a(n):', '    assert n > 0'].join('\n');
  assert.strictEqual(findPythonTests(src)[0].skipped, false);
});

test('recognises python assertions', () => {
  assert.strictEqual(py('assert result == 3').reason, null);
  assert.strictEqual(py('self.assertEqual(result, 3)').reason, null);
  assert.strictEqual(py('with pytest.raises(ValueError):\n    go()').reason, null);
  assert.strictEqual(py('mock.assert_called_once_with(1)').reason, null);
  assert.strictEqual(py('np.testing.assert_allclose(a, b)').reason, null);
});

test('a python test that only prints cannot fail', () => {
  const r = py('r = requests.get(URL)\nprint("OK" if r.status_code == 200 else "FAIL")');
  assert.strictEqual(r.reason, 'no-assertion');
});

test('a body of only pass or a docstring is empty', () => {
  assert.strictEqual(py('    pass').reason, 'empty');
  assert.strictEqual(py('    ...').reason, 'empty');
  assert.strictEqual(py('    """not written yet"""').reason, 'empty');
});

test('assert True and friends are tautological', () => {
  assert.strictEqual(py('assert True').reason, 'tautological');
  assert.strictEqual(py('assert 1 == 1').reason, 'tautological');
  assert.strictEqual(py('assert user == user').reason, 'tautological');
  assert.strictEqual(py('self.assertTrue(True)').reason, 'tautological');
});

test('one real python assertion saves the test', () => {
  assert.strictEqual(py('assert True\nassert total == 3').reason, null);
});

test('an assert inside a comment does not save a python test', () => {
  assert.strictEqual(py('# assert total == 3\nprint(total)').reason, 'no-assertion');
});
