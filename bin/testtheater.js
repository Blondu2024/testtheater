#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { analyze } from '../src/index.js';
import { format, verdict } from '../src/report.js';

const HELP = `
  testtheater — how many of your tests cannot fail?

  usage
    npx github:Blondu2024/testtheater [path] [options]

  options
    --json               machine readable output
    --all                list every finding, not just the first ten
    --max <percent>      exit with code 1 if the score is above this
    --include-fixtures   also scan directories named fixtures/
    --no-color           plain output
    -h, --help           this text
    -v, --version        print the version

  what counts as a test that cannot fail
    no assertion            nothing in the body can throw
    tautological assertion  expect(true).toBe(true), assert.strictEqual(1, 1)
    empty body              the test is a pair of braces
    skipped or todo         it.skip, xit, test.todo, or inside describe.skip

  exit codes
    0  fine, or no threshold set
    1  score above --max
    2  bad usage
`;

function parseArgs(argv) {
  const options = { path: '.', json: false, all: false, max: null, color: true, includeFixtures: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--all') options.all = true;
    else if (arg === '--include-fixtures') options.includeFixtures = true;
    else if (arg === '--no-color') options.color = false;
    else if (arg === '--max') {
      const value = Number(argv[++i]);
      if (!Number.isFinite(value)) throw new Error('--max needs a number, for example --max 10');
      options.max = value;
    } else if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '-v' || arg === '--version') options.version = true;
    else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
    else options.path = arg;
  }
  return options;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`\n  ${error.message}\n${HELP}`);
    process.exit(2);
  }

  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  if (options.version) {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    process.stdout.write(`${pkg.version}\n`);
    return;
  }

  if (!fs.existsSync(options.path)) {
    process.stderr.write(`\n  no such path: ${options.path}\n\n`);
    process.exit(2);
  }

  const result = analyze(options.path, { includeFixtures: options.includeFixtures });

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ...result, verdict: verdict(result.score) }, null, 2)}\n`);
  } else {
    const color = options.color && process.stdout.isTTY;
    process.stdout.write(format(result, { color, all: options.all }));
  }

  if (options.max !== null && result.score > options.max) {
    process.exit(1);
  }
}

main();
