import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lint, worst } from '../src/lint.js';

const rules = (text: string, opts = {}) => lint(text, opts).map((f) => f.rule);

test('a sourced, short, replyable post passes with no warnings', () => {
  const f = lint('CISA added 3 entries to the KEV catalog on 17 Nov 2026, one with a 1 Dec deadline. Which of the three is in your stack?');
  assert.equal(worst(f), 'ok');
});

test('over-length is an error', () => {
  assert.ok(rules('x'.repeat(300)).includes('length'));
  assert.equal(worst(lint('x'.repeat(300))), 'error');
});

test('engagement bait is an error', () => {
  for (const t of ['Like if you agree', 'Follow for more', 'Tag a friend who needs this', 'Comment below!', 'RT if you remember']) {
    assert.ok(rules(t).includes('bait'), t);
  }
});

test('ordinary uses of like, follow and share are not bait', () => {
  for (const t of [
    'People like this approach and share for good reason.',
    'I follow this rule every day.',
    'Easy to share to your team.',
    'Prices drop a lot in winter.',
    'Which rule do you follow for secrets?',
  ]) {
    assert.ok(!rules(t).includes('bait'), t);
  }
});

test('link-only post warns, unless allowed', () => {
  assert.ok(rules('New post: https://example.com/a').includes('link-only'));
  assert.ok(!rules('New post: https://example.com/a', { allowLinkOnly: true }).includes('link-only'));
});

test('hashtags, mentions, caps, emoji, urgency', () => {
  assert.ok(rules('one #a #b #c').includes('hashtags'));
  assert.ok(rules('hi @a @b @c @d').includes('mentions'));
  assert.ok(rules('THIS IS HUGE NEWS TODAY').includes('caps'));
  assert.ok(!rules('CISA and NIST and OWASP').includes('caps'));
  assert.ok(rules('🔥🔥🔥 hot').includes('emoji'));
  assert.ok(rules('🚨 BREAKING: thing').includes('urgency'));
});

test('banned phrases from house rules', () => {
  assert.ok(rules('guaranteed returns every week', { banned: ['guaranteed returns'] }).includes('banned'));
});

test('a number with no source word is info, not an error', () => {
  const f = lint('70% of teams do this.');
  assert.ok(f.some((x) => x.rule === 'number-without-source' && x.severity === 'info'));
  assert.ok(!lint('70% of teams do this, per NIST (2026).').some((x) => x.rule === 'number-without-source'));
});

test('first-line link and long hook warn', () => {
  assert.ok(rules('https://example.com/a\nthen some words that explain it well enough').includes('hook-link'));
  assert.ok(rules('w'.repeat(150) + '\nmore').includes('hook-length'));
  // a one-line post with a short first sentence is fine
  assert.ok(!rules('Short claim. ' + 'w '.repeat(100)).includes('hook-length'));
  assert.ok(rules('w '.repeat(100)).includes('hook-length'));
});
