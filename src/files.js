import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', 'vendor', '.venv',
  'venv', '__pycache__', '.pytest_cache', 'tmp', '.vercel', '.output',
]);

// A directory of test fixtures is usually full of deliberately broken code.
// Scanning it produces noise, so it is skipped unless asked for.
const FIXTURE_DIRS = new Set(['fixtures', '__fixtures__', 'fixture']);

const TEST_FILE = /\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$/i;
const CODE_FILE = /\.(js|jsx|ts|tsx|mjs|cjs)$/i;
const TYPE_FILE = /\.d\.ts$/i;
const TEST_DIR = /^(test|tests|__tests__|spec|__spec__)$/i;

// pytest and unittest naming, plus anything python inside a test directory.
const PY_TEST_FILE = /^(test_.*|.*_test)\.py$/i;
const PY_FILE = /\.py$/i;
const PY_IGNORE = /^(conftest|setup)\.py$/i;

export function languageOf(file) {
  return PY_FILE.test(file) ? 'py' : 'js';
}

function insideTestDir(relative) {
  return relative.split(path.sep).slice(0, -1).some((part) => TEST_DIR.test(part));
}

export function isTestFile(relative) {
  const base = path.basename(relative);
  if (TYPE_FILE.test(base)) return false;
  if (PY_FILE.test(base)) {
    if (PY_IGNORE.test(base)) return false;
    return PY_TEST_FILE.test(base) || insideTestDir(relative);
  }
  if (TEST_FILE.test(base)) return true;
  return CODE_FILE.test(base) && insideTestDir(relative);
}

export function findTestFiles(root, { includeFixtures = false } = {}) {
  const found = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory: not our business to complain
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') && entry.name !== '.') continue;
        if (SKIP_DIRS.has(entry.name)) continue;
        if (!includeFixtures && FIXTURE_DIRS.has(entry.name.toLowerCase())) continue;
        walk(full);
      } else if (entry.isFile()) {
        const relative = path.relative(root, full);
        if (isTestFile(relative)) found.push(full);
      }
    }
  };

  const stat = fs.statSync(root);
  if (stat.isFile()) return [root];
  walk(root);
  return found.sort();
}
