import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, audit, parseOffsetMinutes } from '../src/plan.js';

const base = { start: '2026-11-19', slots: ['09:30', '14:30', '22:30'], utcOffset: '+08:00' };

test('offset parsing', () => {
  assert.equal(parseOffsetMinutes('+08:00'), 480);
  assert.equal(parseOffsetMinutes('-05:30'), -330);
  assert.throws(() => parseOffsetMinutes('8'));
});

test('posts fill slots in order and ISO carries the offset', () => {
  const s = plan([{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }], base);
  assert.deepEqual(s.map((x) => x.local), ['2026-11-19 09:30', '2026-11-19 14:30', '2026-11-19 22:30', '2026-11-20 09:30']);
  assert.equal(s[0]!.iso, '2026-11-19T09:30:00+08:00');
  assert.equal(new Date(s[0]!.iso).getTime(), s[0]!.epochMs);
});

test('minimum gap moves a post and says so', () => {
  const slots = ['09:30', '10:00', '14:30'];
  // slot only: the planner keeps the slot and moves the day
  const a = plan([{ text: 'a', slot: '09:30' }, { text: 'b', slot: '10:00' }], { ...base, slots, minGapHours: 3 });
  assert.equal(a[1]!.local, '2026-11-20 10:00');
  assert.ok(a[1]!.warnings.some((w) => w.includes('Moved')));
  // date and slot fixed: nothing matches with the gap, so the next free slot that day is used
  const b = plan([{ text: 'a', date: '2026-11-19', slot: '09:30' }, { text: 'b', date: '2026-11-19', slot: '10:00' }], { ...base, slots, minGapHours: 3 });
  assert.equal(b[1]!.local, '2026-11-19 14:30');
});

test('preferred date and slot are honoured when free', () => {
  const s = plan([{ text: 'late', date: '2026-11-21', slot: '14:30' }, { text: 'early' }], base);
  assert.equal(s[0]!.text, 'early');
  assert.equal(s[1]!.local, '2026-11-21 14:30');
});

test('sleep-hour slots are flagged', () => {
  const s = plan([{ text: 'night' }], { ...base, slots: ['03:00'] });
  assert.ok(s[0]!.warnings.some((w) => w.includes('awake')));
});

test('audit flags stacked and night posts', () => {
  const notes = audit([{ local: '2026-11-19 09:00' }, { local: '2026-11-19 10:00' }, { local: '2026-11-20 02:00' }]);
  assert.equal(notes.length, 2);
  assert.match(notes[0]!, /stacked/);
  assert.match(notes[1]!, /awake/);
});

test('no slot within horizon throws', () => {
  assert.throws(() => plan([{ text: 'a' }, { text: 'b' }], { ...base, slots: ['09:30'], horizonDays: 1 }));
});
