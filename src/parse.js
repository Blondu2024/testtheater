import { mask } from './mask.js';

// it / test / describe, with or without the x prefix, followed by any chain of
// modifiers (.skip, .only, .each, .concurrent, ...) and an opening paren.
// The leading class stops us matching re.test( or myTest(.
const CALL = /(^|[^\w$.])(x?)(it|test|describe)((?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*\(/g;

const SKIP_MODIFIERS = new Set(['skip', 'todo', 'failing', 'skipIf']);

function matchParen(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    const c = masked[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function matchBrace(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    const c = masked[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// test.each(table)('name', fn) puts the callback in a later call group.
// Walk every chained group and keep the last one.
function lastCallGroup(masked, open) {
  let start = open;
  let end = matchParen(masked, start);
  if (end === -1) return null;
  for (;;) {
    let j = end + 1;
    while (j < masked.length && /\s/.test(masked[j])) j++;
    if (masked[j] !== '(') break;
    const nextEnd = matchParen(masked, j);
    if (nextEnd === -1) break;
    start = j;
    end = nextEnd;
  }
  return { start, end };
}

function firstStringLiteral(src, from, to) {
  const slice = src.slice(from, to);
  const m = slice.match(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/);
  return m ? m[2] : null;
}

// Find the callback body inside a call group. Returns [start, end) of the body
// text, or null when the test has no callback at all (a pending test).
function findBody(masked, start, end) {
  const region = masked.slice(start, end + 1);
  const arrow = region.search(/=>/);
  const fn = region.search(/(^|[^\w$.])function\b/);
  let cursor = -1;
  if (arrow !== -1) cursor = arrow + 2;
  else if (fn !== -1) {
    const paren = region.indexOf('(', fn);
    const close = paren === -1 ? -1 : matchParen(region, paren);
    cursor = close === -1 ? -1 : close + 1;
  }
  if (cursor === -1) return null;

  let k = cursor;
  while (k < region.length && /\s/.test(region[k])) k++;
  if (region[k] === '{') {
    const close = matchBrace(region, k);
    if (close === -1) return null;
    return [start + k + 1, start + close];
  }
  // Concise arrow body: () => expect(1).toBe(2)
  return [start + k, end];
}

export function findTests(src) {
  const masked = mask(src);
  const calls = [];

  CALL.lastIndex = 0;
  let m;
  while ((m = CALL.exec(masked)) !== null) {
    const keywordAt = m.index + m[1].length;
    const open = CALL.lastIndex - 1;
    const group = lastCallGroup(masked, open);
    if (!group) continue;
    const modifiers = (m[4] || '').split('.').map((s) => s.trim()).filter(Boolean);
    calls.push({
      kind: m[3],
      prefixed: m[2] === 'x',
      modifiers,
      keywordAt,
      open,
      group,
    });
  }

  const skippedSuites = calls
    .filter((c) => c.kind === 'describe' && (c.prefixed || c.modifiers.some((mod) => SKIP_MODIFIERS.has(mod))))
    .map((c) => c.group);

  const tests = [];
  for (const call of calls) {
    if (call.kind === 'describe') continue;
    const body = findBody(masked, call.group.start, call.group.end);
    const insideSkippedSuite = skippedSuites.some(
      (s) => call.keywordAt > s.start && call.keywordAt < s.end
    );
    const skipped =
      call.prefixed ||
      call.modifiers.some((mod) => SKIP_MODIFIERS.has(mod)) ||
      insideSkippedSuite ||
      body === null;

    tests.push({
      name: firstStringLiteral(src, call.group.start, call.group.end + 1) ?? '(unnamed)',
      line: src.slice(0, call.keywordAt).split('\n').length,
      body: body ? src.slice(body[0], body[1]) : '',
      skipped,
      focused: call.modifiers.includes('only'),
    });
  }

  return tests;
}
