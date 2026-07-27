import { mask, maskComments } from './mask.js';
import { maskPython, maskPythonComments } from './python.js';

// Anything that can make a test fail. Deliberately generous: a false "this is
// a real assertion" is much cheaper than accusing an honest test of being fake.
const ASSERTIONS = [
  /(^|[^\w$.])(expect|expectTypeOf|assertType)\s*[(.]/,
  /(^|[^\w$.])assert\s*[(.]/,
  /\.\s*assert\s*[(.]/, // node:test — t.assert.ok(...)
  /\.\s*should\b/,
  /(^|[^\w$.])should\s*\(/,
  /(^|[^\w$.])(strictEqual|notStrictEqual|deepStrictEqual|deepEqual|notDeepEqual|equal|notEqual|ok|match|doesNotMatch|throws|rejects|doesNotThrow|doesNotReject|ifError|fail)\s*\(/,
  /(^|[^\w$.])(assertThat|verify)\s*\(/,
];

// Used to count how many assertions a test makes, so one honest assertion next
// to a decorative one still saves it.
const ASSERTION_COUNT = /(^|[^\w$.])(expect|assert)\s*[(.]|\.\s*assert\s*[(.]|\.\s*should\b|(^|[^\w$.])(strictEqual|notStrictEqual|deepStrictEqual|deepEqual|equal|ok|match|throws|rejects|ifError)\s*\(/g;

const SNAPSHOT = /(toMatchSnapshot|toMatchInlineSnapshot|toMatchFileSnapshot)\s*\(/;
const SNAPSHOT_CALL = /expect\s*\([^;]*?\)\s*\.\s*(toMatchSnapshot|toMatchInlineSnapshot|toMatchFileSnapshot)\s*\([^;]*?\)/g;

const EQUALITY = /expect\s*\(\s*([^()]*?)\s*\)\s*\.\s*(?:to\s*\.\s*)?(?:not\s*\.\s*)?(?:toBe|toEqual|toStrictEqual|toBeCloseTo|equal|eql)\s*\(\s*([^()]*?)\s*\)/g;
const NODE_EQUALITY = /assert\s*\.\s*(?:strictEqual|deepStrictEqual|deepEqual|equal)\s*\(\s*([^(),]*?)\s*,\s*([^(),]*?)\s*[,)]/g;

const ALWAYS_TRUE = [
  /expect\s*\(\s*true\s*\)\s*\.\s*toBeTruthy\s*\(\s*\)/,
  /expect\s*\(\s*false\s*\)\s*\.\s*toBeFalsy\s*\(\s*\)/,
  /expect\s*\(\s*null\s*\)\s*\.\s*toBeNull\s*\(\s*\)/,
  /expect\s*\(\s*undefined\s*\)\s*\.\s*toBeUndefined\s*\(\s*\)/,
  /expect\s*\(\s*(true|false|null|\d+|'[^']*'|"[^"]*")\s*\)\s*\.\s*toBeDefined\s*\(\s*\)/,
  /assert\s*\(\s*true\s*\)/,
  /assert\s*\.\s*ok\s*\(\s*true\s*\)/,
];

// ---- python -------------------------------------------------------------

const PY_ASSERTIONS = [
  /(^|[^\w.])assert[\s(]/,
  /\bself\s*\.\s*assert\w*\s*\(/,
  /\bself\s*\.\s*fail\s*\(/,
  /(^|[^\w.])pytest\s*\.\s*(raises|warns|fail|approx)\b/,
  /\bassert_\w+\s*\(/,
];

const PY_ASSERTION_COUNT = /(^|[^\w.])assert[\s(]|\bself\s*\.\s*assert\w*\s*\(|pytest\s*\.\s*raises|\bassert_\w+\s*\(/g;

const PY_ALWAYS_TRUE = [
  /assert\s+True\b/,
  /assert\s+not\s+False\b/,
  /assert\s*\(\s*True\s*\)/,
  /assertTrue\s*\(\s*True\s*\)/,
  /assertFalse\s*\(\s*False\s*\)/,
  /assertIsNone\s*\(\s*None\s*\)/,
];

const PY_EQUALITY = [
  /assert\s+([A-Za-z_]\w*(?:\.\w+)*|\d+|'[^']*'|"[^"]*")\s*==\s*([A-Za-z_]\w*(?:\.\w+)*|\d+|'[^']*'|"[^"]*")/g,
  /assert\w*\s*\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g,
];

// Lines that are a body only in the way a placeholder is a body.
const PY_FILLER = /^\s*(pass|\.\.\.|return)\s*$/gm;

const norm = (s) => s.replace(/\s+/g, '');

function countPythonTautologies(body) {
  let count = 0;
  for (const re of PY_ALWAYS_TRUE) {
    const all = body.match(new RegExp(re.source, 'g'));
    if (all) count += all.length;
  }
  for (const re of PY_EQUALITY) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body)) !== null) {
      if (m[1] && m[2] && norm(m[1]) === norm(m[2])) count++;
    }
  }
  return count;
}

function countMatches(body, re) {
  re.lastIndex = 0;
  let count = 0;
  while (re.exec(body) !== null) count++;
  return count;
}

function classifyPython(testCase) {
  const code = maskPython(testCase.body);
  const literals = maskPythonComments(testCase.body);

  // A test pytest never collects is not a weak test, it is not a test at all.
  if (testCase.uncollected) return { reason: 'uncollected', canFail: false, snapshotOnly: false };
  if (testCase.skipped) return { reason: 'skipped', canFail: false, snapshotOnly: false };
  if (code.replace(PY_FILLER, '').trim() === '') {
    return { reason: 'empty', canFail: false, snapshotOnly: false };
  }
  if (!PY_ASSERTIONS.some((re) => re.test(code))) {
    return { reason: 'no-assertion', canFail: false, snapshotOnly: false };
  }

  const tautologies = countPythonTautologies(literals);
  if (tautologies > 0 && tautologies >= countMatches(literals, PY_ASSERTION_COUNT)) {
    return { reason: 'tautological', canFail: false, snapshotOnly: false };
  }
  return { reason: null, canFail: true, snapshotOnly: false };
}

// ---- javascript ---------------------------------------------------------

function countTautologies(body) {
  let count = 0;
  for (const re of ALWAYS_TRUE) {
    const all = body.match(new RegExp(re.source, 'g'));
    if (all) count += all.length;
  }
  for (const re of [EQUALITY, NODE_EQUALITY]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body)) !== null) {
      if (m[1] && m[2] && norm(m[1]) === norm(m[2])) count++;
    }
  }
  return count;
}

function countAssertions(body) {
  ASSERTION_COUNT.lastIndex = 0;
  let count = 0;
  while (ASSERTION_COUNT.exec(body) !== null) count++;
  return count;
}

export function classify(testCase) {
  if (testCase.language === 'py') return classifyPython(testCase);

  const code = mask(testCase.body); // comments and strings gone
  const literals = maskComments(testCase.body); // comments gone, literals kept

  if (testCase.skipped) {
    return { reason: 'skipped', canFail: false, snapshotOnly: false };
  }
  if (code.trim() === '') {
    return { reason: 'empty', canFail: false, snapshotOnly: false };
  }

  const hasSnapshot = SNAPSHOT.test(code);
  const withoutSnapshots = code.replace(SNAPSHOT_CALL, '');
  const hasRealAssertion = ASSERTIONS.some((re) => re.test(withoutSnapshots));

  if (!hasRealAssertion && !hasSnapshot) {
    return { reason: 'no-assertion', canFail: false, snapshotOnly: false };
  }

  const snapshotOnly = hasSnapshot && !hasRealAssertion;
  if (snapshotOnly) {
    return { reason: null, canFail: true, snapshotOnly: true };
  }

  const tautologies = countTautologies(literals);
  if (tautologies > 0 && tautologies >= countAssertions(literals)) {
    return { reason: 'tautological', canFail: false, snapshotOnly: false };
  }

  return { reason: null, canFail: true, snapshotOnly: false };
}
