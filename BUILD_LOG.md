# Build log — day 2, testtheater

Built 27 July 2026, one session. Tool #2 of one-tool-a-day. Tool #1 was [lockcheck](https://github.com/Blondu2024/lockcheck).

## The idea

lockcheck answered "can you leave the platform that generated your app". This one answers a question from the same week of my life: **the suite was green the whole time my users were finding bugs. Why?**

`testtheater` reads test files and reports how many of the tests in them cannot fail, whatever the code does.

## Why this and not something else

Checked first whether it already exists, the way I now check every idea before building it. `jest/expect-expect` (ESLint, oxlint) already flags a test with no `expect` call. It is a lint rule: needs a plugin, a config, a framework preset, and it answers per file, not per repo. Nothing standalone gives you one number for a whole project, and nothing I found covers tautological assertions, forgotten skips, or Python at all.

So the gap is the same shape as day 1: the checks exist somewhere, the answer does not.

## What went wrong

**1. The first real run found nothing, and I assumed I had broken it.**

I ran it on my own repos. creazaapp: 583 tests, 0 that cannot fail. buildlog: 48 tests, 0. lockcheck: 7 tests, 0. A tool that reports zero problems on every input is usually a tool with a bug, so I wrote a throwaway script to list every test body containing no `expect`, `assert` or `should` anywhere. It printed:

```
total 583  bodies with no expect/assert/should keyword: 0
```

The zero was true. Every one of those 583 tests really does assert something. That is the boring answer, and I nearly patched a working tool because I did not like it.

**2. It was built for the wrong language.**

The whole point was to look at what the AI builder handed me. So I pointed it at the builder-generated projects:

```
CreazaApp-Emergent      no tests found
chess-test-emergent     no tests found
finromania-railway      no tests found
```

Three times "no tests found", and only the first one was true. The other two are full of tests — `backend_test.py`, `auth_test.py`, 26 files, 317 test functions — and my scanner only knew about JavaScript. I had built a tool that could not read the codebase the tool was built for.

Added Python: a separate masker (comments, docstrings, triple-quoted strings), indentation instead of braces for finding function bodies, pytest and unittest assertion styles, `@pytest.mark.skip` / `skipif` / `@unittest.skip` decorators including multi-line ones, class-level skips, and `pytest.skip()` in the body.

**3. The interesting bug was the one I found by reading the output instead of trusting it.**

With Python working, `auth_test.py` came back as 7 out of 7 tests that cannot fail, reason: no assertion. I opened the file to check before believing it. The tests do validate things — they check status codes and required fields — and then report the outcome like this:

```python
if missing_fields:
    self.log_test("Auth Me Endpoint", False, f"Missing fields: {missing_fields}", data)
    return False
```

They return `False` instead of asserting. A test that returns False passes.

Then I looked at the class holding them: `class FirebaseAuthTester`. pytest collects test methods from classes named `Test*` and from `unittest.TestCase` subclasses. This is neither. So those seven functions are not weak tests, they are **not tests**. The file is named `auth_test.py`, pytest imports it, and collects nothing:

```
$ python -m pytest auth_test.py --collect-only -q
no tests collected in 3.30s
```

Same for `backend_test.py`: 6 test functions, 0 collected.

So I added a fifth category, `never collected by pytest`, which takes priority over every other reason. It is a more precise and more damning answer than "no assertion", and it is checkable in one command by anyone who doubts it.

**4. Masking strings broke the tautology check, quietly.**

To find assertions I blank out comments and string contents first, so `log('expect(x).toBe(y)')` does not count as an assertion. But the tautology check compares the two sides of an assertion textually, and after masking, `expect('a').toBe('b')` becomes `expect('  ').toBe('  ')` — two identical sides, an honest test accused of being decoration.

Fix: two different masks. Comments-only when comparing literals, comments-and-strings when looking for assertions, and the assertion check runs first so a fake assertion inside a string never reaches the tautology stage.

**5. Ten tests vanished between two runs and I blamed myself.**

creazaapp read 583 tests, then 573 twenty minutes later, same 24 files. I went looking for the regression I had introduced. There was none: the repo had been switched to another branch in between, and the missing test file lives on the branch I was no longer on.

**6. `decoratorsAbove` was written twice.** The first version was a pile of conditions that I could not read back five minutes later, and it got Python decorators spanning several lines wrong. Rewrote it with an explicit buffer: walk upwards, collect continuation lines, close the group when a line starts with `@`.

## What it found, in the end

| project | tests | cannot fail | note |
|---|---|---|---|
| creazaapp (mine) | 573 | **0** | 0% |
| buildlog (mine) | 48 | **0** | 0% |
| lockcheck (mine, day 1) | 7 | **0** | 0% |
| testtheater (itself) | 73 | **0** | 0% |
| chess-test-emergent (builder) | 29 | 2 | 7% |
| **finromania-railway** (builder, then migrated by hand) | 306 | **20** | **15 never collected by pytest** |
| CreazaApp-Emergent (builder) | — | — | **no test files at all** |

The two files at the top of that last row, `auth_test.py` and `backend_test.py`, are 7/7 and 6/6. Thirteen functions with the word test in their names, in a live financial platform, that no test runner has ever executed.

I am not going to pretend that is a great feeling to publish. It is my repo.

## Honest limitations

- Pattern matching over text, not static analysis. No AST, no import resolution, no execution.
- **Assertions inside helper functions read as no assertion.** The most likely false positive by far.
- The assertion list is deliberately generous — a wrong "this is a real test" is cheaper than calling an honest test fake.
- `pytest.ini` overrides of `python_classes` are ignored, so the collection check assumes pytest defaults.
- 4 files under `finromania-railway/backend/tests` failed to import when I ran `--collect-only` locally. I did not chase the cause and I am not claiming anything about it; it is most likely missing dependencies on this machine.

## Numbers

- 73 tests, all passing, `node --test test/*.test.js`
- 6 test files, 2 fixture projects (one JavaScript, one Python), zero dependencies
- Node 18+, JavaScript and TypeScript and Python
