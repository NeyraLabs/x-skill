import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv, detectColumns, summarize } from '../src/analytics.js';

const posts = readFileSync(new URL('./fixtures/posts.csv', import.meta.url), 'utf8');
const days = readFileSync(new URL('./fixtures/days.csv', import.meta.url), 'utf8');

test('csv parser handles quotes, commas and newlines inside fields', () => {
  const t = parseCsv('a,b\n"x, y","line1\nline2"\n"q ""quoted""",3\n');
  assert.deepEqual(t.headers, ['a', 'b']);
  assert.equal(t.rows[0]!.a, 'x, y');
  assert.equal(t.rows[0]!.b, 'line1\nline2');
  assert.equal(t.rows[1]!.a, 'q "quoted"');
});

test('duplicate headers are kept apart', () => {
  const t = parseCsv('a,a,b,a (2)\n1,2,3,4\n');
  assert.deepEqual(t.headers, ['a', 'a (2)', 'b', 'a (2) (2)']);
  assert.equal(t.rows[0]!['a (2)'], '2');
});

test('column detection is loose and case-insensitive', () => {
  const c = detectColumns(['Date', 'Impressions', 'Likes', 'Replies', 'Reposts', 'New follows', 'Post text']);
  assert.equal(c.metrics.follows, 'New follows');
  assert.equal(c.metrics.reposts, 'Reposts');
  assert.equal(c.text, 'Post text');
  assert.equal(c.date, 'Date');
});

test('per-post export: top posts ordered by high-weight actions', () => {
  const s = summarize(parseCsv(posts), 3);
  assert.equal(s.rows, 4);
  assert.equal(s.topPosts[0]!.text.startsWith('Question post'), true);
  assert.equal(s.totals.impressions, 4600);
  assert.equal(s.per1k.replies, round((7 / 4600) * 1000));
});

test('per-day export: best days by follows then replies', () => {
  const s = summarize(parseCsv(days));
  assert.equal(s.bestDays[0]!.date, '2026-11-17');
  assert.equal(s.topPosts.length, 0);
  assert.ok(s.notes.some((n) => n.includes('not a reproduction')));
});

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
