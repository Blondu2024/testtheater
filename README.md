# testtheater

How many of your tests cannot fail?

A green test suite means one of two things: the code works, or the tests do not check anything. `testtheater` reads your test files and tells you which one you have. No config, no dependencies, JavaScript/TypeScript and Python.

```
npx testtheater
```

## What it does

```
  testtheater  ~/some-project

  22 test files, 306 tests

  20 of them cannot fail (7%)

        3  no assertion
        2  skipped or todo
       15  never collected by pytest

  worst files
        7/7  auth_test.py
        6/6  backend_test.py
       3/27  backend/tests/test_screener_pro.py

  tests that cannot fail
     auth_test.py:148  test_auth_me_endpoint  [never collected by pytest]
     auth_test.py:194  test_session_persistence  [never collected by pytest]
     ... and 10 more, run with --all

  score 7  some of this suite is decoration.
```

The score is the percentage of your tests that cannot fail. Lower is better. Zero is the goal, and zero is normal for a suite written by someone who watched the tests fail before making them pass.

## Install

Nothing to install:

```bash
npx testtheater path/to/project
```

Or globally:

```bash
npm install -g testtheater
testtheater .
```

Node 18 or newer. No dependencies, ever.

## What counts as a test that cannot fail

| check | example |
|---|---|
| **no assertion** | the body calls the code, prints the result, and asserts nothing |
| **tautological assertion** | `expect(true).toBe(true)`, `assert.strictEqual(1, 1)`, `assert True` |
| **empty body** | `it('does the thing', () => {})`, `def test_thing(): pass` |
| **skipped or todo** | `it.skip`, `xit`, `test.todo`, `@pytest.mark.skip`, or anything inside `describe.skip` |
| **never collected by pytest** | `test_*` methods in a class pytest does not collect, so they never run at all |

That last one is worth spelling out. pytest collects test methods from classes named `Test*` (without a constructor) and from `unittest.TestCase` subclasses. A file called `auth_test.py`, holding a class called `AuthTester` with seven `test_*` methods, gets imported and produces exactly zero tests. Nothing fails, because nothing runs. Confirm it yourself with `pytest yourfile.py --collect-only -q`.

Two more things are reported but **not** counted in the score, because they can genuinely fail:

- **focused tests** (`it.only`) — these pass, but everything else in the file did not run
- **snapshot-only tests** — they can fail, but only against whatever the code happened to do the day the snapshot was written

## Options

```
  --json               machine readable output
  --all                list every finding, not just the first ten
  --max <percent>      exit with code 1 if the score is above this
  --include-fixtures   also scan directories named fixtures/
  --no-color           plain output
```

In CI:

```bash
npx testtheater --max 0
```

Exit codes: `0` fine, `1` score above `--max`, `2` bad usage.

## What it looks at

- `*.test.js` / `*.spec.ts` and friends (`js jsx ts tsx mjs cjs`)
- anything JavaScript inside `test/`, `tests/`, `__tests__/`, `spec/`
- `test_*.py` and `*_test.py`, plus any `.py` inside a test directory
- skips `node_modules`, `dist`, `build`, `coverage`, `.next`, hidden directories, and `fixtures/`

## Limitations, on purpose

This is pattern matching, not static analysis. It reads your test files as text, after blanking out comments and strings. It does not run your tests, does not resolve imports, and does not know what your helper functions do.

So:

- **A test whose assertions live in a helper is reported as having none.** If `checkUser(u)` asserts internally, `testtheater` cannot see it. This is the most common false positive.
- **The assertion list is generous by design.** `expect`, `assert`, `should`, `strictEqual`, `pytest.raises`, `assert_called_with` and friends all count. A wrong "this is real" is cheaper than accusing an honest test of being decoration.
- **Tautology detection is literal.** `expect(x).toBe(x)` is caught; `expect(x).toBe(copyOf(x))` is not.
- **Exotic syntax will be misread.** Deeply nested template literals, tabs mixed with spaces in Python, decorators spanning many lines.
- **`pytest.ini` / `setup.cfg` overrides are ignored.** If you renamed `python_classes`, the collection check will be wrong for your repo.

The score is a first look, not a verdict. Every finding prints a file and a line so you can go and disagree with it.

## Why this exists

I paid an AI app builder several hundred euro for an application, and got back a codebase with bugs and a test suite that was green. It stayed green through every bug my users found. When I finally read the tests, they were calling the API and printing the result. Nothing was ever asserted. Later, a file in another project turned out to have seven test functions that pytest never collected at all.

A test that cannot fail is worse than no test. No test is an honest gap. A test that cannot fail is a gap with a green tick next to it.

## License

MIT
