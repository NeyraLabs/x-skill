import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countPost, extractUrls } from '../src/count.js';

test('plain ascii weighs 1 per character', () => {
  assert.equal(countPost('hello world').weighted, 11);
});

test('a URL weighs 23 whatever its length', () => {
  const short = countPost('see https://a.co/x').weighted;
  const long = countPost('see https://example.com/a/very/long/path?with=query&and=more').weighted;
  assert.equal(short, 4 + 23);
  assert.equal(long, 4 + 23);
});

test('bare domains are URLs, plain words are not', () => {
  assert.deepEqual(extractUrls('go to ghostdrive.com/News now'), ['ghostdrive.com/News']);
  assert.deepEqual(extractUrls('e.g. this is fine'), []);
  // e-mail addresses are not links on X
  assert.deepEqual(extractUrls('mail me at hello@example.com'), []);
});

test('CJK weighs 2, Cyrillic weighs 1', () => {
  assert.equal(countPost('日本語').weighted, 6);
  assert.equal(countPost('привет').weighted, 6);
});

test('an emoji weighs 2 even as a ZWJ sequence', () => {
  assert.equal(countPost('👍').weighted, 2);
  assert.equal(countPost('👨‍👩‍👧').weighted, 2);
  assert.equal(countPost('🇺🇦').weighted, 2);
});

test('limit and remaining', () => {
  const c = countPost('a'.repeat(281));
  assert.equal(c.ok, false);
  assert.equal(c.remaining, -1);
  assert.equal(countPost('a'.repeat(280)).ok, true);
});
