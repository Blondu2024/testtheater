// Same idea as the JavaScript side: blank out what must not be searched, keep
// every index where it was, then read the file with indentation instead of
// braces.

const SPACE = ' ';

export function maskPython(src, { strings = true } = {}) {
  const out = src.split('');
  const n = src.length;
  const blank = (i) => {
    if (src[i] !== '\n') out[i] = SPACE;
  };
  let i = 0;

  while (i < n) {
    const c = src[i];

    if (c === '#') {
      while (i < n && src[i] !== '\n') blank(i++);
      continue;
    }

    const triple = src.slice(i, i + 3);
    if (triple === '"""' || triple === "'''") {
      if (strings) {
        blank(i);
        blank(i + 1);
        blank(i + 2);
      }
      i += 3;
      while (i < n && src.slice(i, i + 3) !== triple) {
        if (src[i] === '\\') {
          if (strings) blank(i);
          i++;
          if (i < n && strings) blank(i);
          i++;
          continue;
        }
        if (strings) blank(i);
        i++;
      }
      if (i < n) {
        if (strings) {
          blank(i);
          blank(i + 1);
          blank(i + 2);
        }
        i += 3;
      }
      continue;
    }

    if (c === "'" || c === '"') {
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\') {
          if (strings) blank(i);
          i++;
          if (i < n && strings) blank(i);
          i++;
          continue;
        }
        if (strings) blank(i);
        i++;
      }
      if (i < n && src[i] === c) i++;
      continue;
    }

    i++;
  }

  return out.join('');
}

export function maskPythonComments(src) {
  return maskPython(src, { strings: false });
}

const DEF = /^(\s*)(?:async\s+)?def\s+(test\w*)\s*\(/;
const ANY_DEF = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/;
const CLASS = /^(\s*)class\s+(\w+)\s*(?:\(([^)]*)\))?/;
const DECORATOR = /^(\s*)@/;
const SKIP_DECORATOR = /@\s*(?:pytest\s*\.\s*mark\s*\.\s*)?(?:skip|skipif)\b|@\s*unittest\s*\.\s*skip/;
const SKIP_CALL = /(^|[^\w.])(?:pytest\s*\.\s*skip|self\s*\.\s*skipTest)\s*\(/;

const indentOf = (line) => line.replace(/\t/g, '    ').match(/^ */)[0].length;
const isBlank = (line) => line.trim() === '';

// Decorators immediately above a def or class, walking upwards. A decorator
// whose arguments span several lines is collected into one string.
function decoratorsAbove(lines, index) {
  const found = [];
  let buffer = [];
  for (let i = index - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed === '') {
      if (buffer.length > 0) break;
      continue;
    }
    if (DECORATOR.test(lines[i])) {
      found.push([trimmed, ...buffer].join(' '));
      buffer = [];
      continue;
    }
    const looksLikeContinuation =
      /^[)\]}]/.test(trimmed) || /[,([{]$/.test(trimmed) || (buffer.length > 0 && /^["'\w]/.test(trimmed));
    if (looksLikeContinuation) {
      buffer.unshift(trimmed);
      continue;
    }
    break;
  }
  return found;
}

export function findPythonTests(src) {
  const masked = maskPython(src);
  const maskedLines = masked.split('\n');
  const lines = src.split('\n');
  const tests = [];

  const classes = [];
  for (let i = 0; i < maskedLines.length; i++) {
    const m = maskedLines[i].match(CLASS);
    if (!m) continue;
    const indent = m[1].length;
    let end = maskedLines.length;
    for (let j = i + 1; j < maskedLines.length; j++) {
      if (!isBlank(maskedLines[j]) && indentOf(maskedLines[j]) <= indent) {
        end = j;
        break;
      }
    }
    const bases = m[3] || '';
    const hasInit = maskedLines
      .slice(i + 1, end)
      .some((line) => (line.match(ANY_DEF) || [])[2] === '__init__');
    // pytest collects classes named Test* without a constructor, plus anything
    // deriving from unittest.TestCase whatever it is called.
    const collected = /\bTestCase\b/.test(bases) || (/^Test/.test(m[2]) && !hasInit);
    classes.push({
      start: i,
      end,
      collected,
      skipped: decoratorsAbove(maskedLines, i).some((d) => SKIP_DECORATOR.test(d)),
    });
  }

  const enclosingClass = (line) => classes.find((c) => line > c.start && line < c.end) ?? null;

  for (let i = 0; i < maskedLines.length; i++) {
    const m = maskedLines[i].match(DEF);
    if (!m) continue;
    const indent = m[1].replace(/\t/g, '    ').length;

    let end = maskedLines.length;
    for (let j = i + 1; j < maskedLines.length; j++) {
      if (isBlank(maskedLines[j])) continue;
      if (indentOf(maskedLines[j]) <= indent) {
        end = j;
        break;
      }
    }

    const body = lines.slice(i + 1, end).join('\n');
    const maskedBody = maskedLines.slice(i + 1, end).join('\n');
    const decorators = decoratorsAbove(maskedLines, i);
    const owner = enclosingClass(i);
    const skipped =
      decorators.some((d) => SKIP_DECORATOR.test(d)) ||
      (owner !== null && owner.skipped) ||
      SKIP_CALL.test(maskedBody);

    tests.push({
      name: m[2],
      line: i + 1,
      body,
      skipped,
      focused: false,
      uncollected: owner !== null && !owner.collected,
      language: 'py',
    });
  }

  return tests;
}
