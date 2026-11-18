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
  for (const t of [
    'Like if you agree',
    'Follow for more',
    'Tag a friend who needs this',
    'Big news RT if you agree',
    'If you agree please like and RT',
    'Follow me for daily tips',
    'f4f anyone',
    'Follow us on Mastodon for updates',
    'Great thread. Share if you found it useful',
    'Retweet if this helped',
    'Like and share with your team!',
    'RT & follow for part two',
    'Tag 3 friends',
  ]) {
    assert.ok(rules(t).includes('bait'), t);
  }
});

test('ambiguous asks are a warning to check, not an error', () => {
  for (const t of [
    'Comment below with your CVE ID',
    'Thoughts? please comment below',
    'Results are in. Follow back policies vary.',
    'Run the benchmark on ARM and share if you see a regression.',
    'Follow us if you run Postgres on ARM.',
    'RT if you remember this bug',
  ]) {
    const f = lint(t);
    assert.ok(f.some((x) => x.rule === 'bait-check' && x.severity === 'warn'), t);
    assert.ok(!f.some((x) => x.rule === 'bait'), t);
  }
});

test('ordinary uses of like, follow and share are not bait', () => {
  for (const t of [
    'People like this approach and share for good reason.',
    'I follow this rule every day.',
    'Easy to share to your team.',
    'Prices drop a lot in winter.',
    'Which rule do you follow for secrets?',
    'Like and dislike counts are both public now, per the 2024 data.',
    'Share for the web rose 4% per StatCounter.',
    'To escalate, tag a moderator in the thread.',
    'Pick any license you like if you want, MIT is fine.',
    'Engineers like this if you show the numbers.',
    'Do not follow me for financial advice.',
    'Teams that follow us and audit monthly had 0 breaches.',
    'We review the patch, share and follow up with the vendor.',
    'Read it, follow us to the next section if you want details.',
    'Rivals, as usual, follow us and copy the feature a year later.',
    'Share prices fell 4% after the report, per Reuters.',
    'Tag the release, then follow the migration guide.',
  ]) {
    assert.ok(!rules(t).includes('bait'), t);
    assert.ok(!rules(t).includes('bait-check'), t);
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
