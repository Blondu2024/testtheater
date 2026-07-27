// Blanks out the parts of a source file that must not be searched for code:
// comments always, string and regex contents optionally. Length and line
// breaks are preserved so every index in the masked text still points at the
// same character in the original.
//
// This is deliberately a lexer, not a parser. It is wrong on some exotic input
// (see README limitations) and cheap on all of it.

const SPACE = ' ';

// A slash starts a regex literal only when the previous significant character
// cannot end an expression. Otherwise it is division.
const BEFORE_REGEX = new Set([
  '', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>',
]);

export function mask(src, { strings = true } = {}) {
  const out = src.split('');
  const n = src.length;
  const blank = (i) => {
    if (src[i] !== '\n') out[i] = SPACE;
  };
  let prev = '';
  let i = 0;

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') blank(i++);
      continue;
    }

    if (c === '/' && next === '*') {
      blank(i++);
      blank(i++);
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) blank(i++);
      if (i < n) {
        blank(i++);
        blank(i++);
      }
      prev = '/';
      continue;
    }

    if (c === "'" || c === '"') {
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\') {
          if (strings) blank(i);
          i++;
          if (i < n) {
            if (strings) blank(i);
            i++;
          }
          continue;
        }
        if (strings) blank(i);
        i++;
      }
      if (i < n && src[i] === c) i++;
      prev = c;
      continue;
    }

    if (c === '`') {
      i++;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') {
          if (strings) blank(i);
          i++;
          if (i < n) {
            if (strings) blank(i);
            i++;
          }
          continue;
        }
        if (strings) blank(i);
        i++;
      }
      if (i < n) i++;
      prev = '`';
      continue;
    }

    if (c === '/' && BEFORE_REGEX.has(prev)) {
      i++;
      let inClass = false;
      while (i < n && src[i] !== '\n') {
        const ch = src[i];
        if (ch === '\\') {
          if (strings) blank(i);
          i++;
          if (i < n) {
            if (strings) blank(i);
            i++;
          }
          continue;
        }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) break;
        if (strings) blank(i);
        i++;
      }
      if (i < n && src[i] === '/') i++;
      while (i < n && /[a-z]/.test(src[i])) i++;
      prev = '/';
      continue;
    }

    if (!/\s/.test(c)) prev = c;
    i++;
  }

  return out.join('');
}

// Comments only: string contents survive, so literal values can still be
// compared to each other.
export function maskComments(src) {
  return mask(src, { strings: false });
}
