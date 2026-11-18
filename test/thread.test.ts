import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitThread, threadFits } from '../src/thread.js';
import { countPost } from '../src/count.js';

const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i + 1} explains one more point about the topic in a plain way.`).join(' ');

test('every post fits the limit', () => {
  const posts = splitThread(long);
  assert.ok(posts.length > 1);
  assert.ok(threadFits(posts));
});

test('numbering is reserved and applied', () => {
  const posts = splitThread(long, { numbering: 'of' });
  assert.ok(threadFits(posts));
  assert.match(posts[0]!, / 1\/\d+$/);
  assert.match(posts[posts.length - 1]!, new RegExp(` ${posts.length}\\/${posts.length}$`));
});

test('paragraph breaks are preferred split points', () => {
  const posts = splitThread('First idea.\n\nSecond idea.');
  assert.deepEqual(posts, ['First idea.\n\nSecond idea.']);
  const big = splitThread('A'.repeat(200) + '.\n\n' + 'B'.repeat(200) + '.');
  assert.equal(big.length, 2);
  assert.ok(big[0]!.startsWith('A'));
});

test('URLs are never split', () => {
  const url = 'https://example.com/a.b.c/d.html';
  const text = 'w '.repeat(130) + url + ' tail words here.';
  const posts = splitThread(text);
  assert.ok(posts.some((p) => p.includes(url)));
  assert.ok(threadFits(posts));
});

test('a single word longer than the limit is still emitted', () => {
  const posts = splitThread('x'.repeat(300));
  assert.equal(posts.length, 1);
  assert.equal(countPost(posts[0]!).ok, false);
});

test('custom limit', () => {
  const posts = splitThread(long, { limit: 100 });
  assert.ok(posts.every((p) => countPost(p, 100).ok));
});
