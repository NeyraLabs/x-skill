import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, num } from '../src/args.js';

test('boolean flags do not swallow the next word', () => {
  const a = parseArgs(['lint', '--json', 'draft.txt']);
  assert.deepEqual(a.positional, ['draft.txt']);
  assert.equal(a.flags.json, true);
  const b = parseArgs(['lint', '--allow-link-only', 'draft.txt', '--limit', '4000']);
  assert.deepEqual(b.positional, ['draft.txt']);
  assert.equal(b.flags.limit, '4000');
});

test('value flags, --key=value and -- terminator', () => {
  const a = parseArgs(['plan', 'p.json', '--start=2026-11-19', '--offset', '+08:00', '--', '--not-a-flag']);
  assert.equal(a.cmd, 'plan');
  assert.deepEqual(a.positional, ['p.json', '--not-a-flag']);
  assert.equal(a.flags.start, '2026-11-19');
  assert.equal(a.flags.offset, '+08:00');
});

test('a value flag at the end becomes true', () => {
  assert.equal(parseArgs(['lint', 'f', '--limit']).flags.limit, true);
});

test('numeric flags are validated when present', () => {
  assert.equal(num({}, 'gap', 3), 3);
  assert.equal(num({ gap: '2.5' }, 'gap', 3), 2.5);
  assert.throws(() => num({ gap: 'abc' }, 'gap', 3), /needs a number/);
  assert.throws(() => num({ gap: '-5' }, 'gap', 3, { min: 0 }), /at least 0/);
  assert.throws(() => num({ limit: '2.5' }, 'limit', 280, { integer: true }), /whole number/);
  assert.throws(() => num({ gap: true }, 'gap', 3), /needs a number/);
});
