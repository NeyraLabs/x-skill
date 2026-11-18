/**
 * Slot planner. Spreads posts across daily slots so that:
 * - no two posts land closer than `minGapHours`, so each post gets its own
 *   reply window and your followers are not flooded (the author-diversity
 *   decay in X's README is OFF in the public defaults, so this is an
 *   operator habit, not an algorithm claim);
 * - every post lands inside your awake hours, so you can answer replies in
 *   the first hours of its 48-hour window.
 * Times are local to the UTC offset you give; output carries ISO strings.
 */

export interface PlanPost {
  text: string;
  /** Optional preferred slot "HH:MM"; the planner honours it when free. */
  slot?: string;
  /** Optional preferred date "YYYY-MM-DD". */
  date?: string;
}

export interface PlanOptions {
  /** First day to schedule, "YYYY-MM-DD" in local time. */
  start: string;
  /** Daily slots "HH:MM" in local time, e.g. ["09:30", "14:30", "22:30"]. */
  slots: readonly string[];
  /** UTC offset like "+08:00" or "-05:00". */
  utcOffset: string;
  /** Minimum hours between two posts. Default 3. */
  minGapHours?: number;
  /** Hours [from, to) in which you can answer replies. Default [8, 23]. */
  awake?: readonly [number, number];
  /** Days to look ahead before giving up. Default 14. */
  horizonDays?: number;
}

export interface Scheduled {
  text: string;
  /** Local wall-clock "YYYY-MM-DD HH:MM" at the given offset. */
  local: string;
  /** ISO 8601 with offset. */
  iso: string;
  epochMs: number;
  warnings: string[];
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const OFFSET = /^([+-])(0\d|1[0-4]):([0-5]\d)$/;

export function parseOffsetMinutes(offset: string): number {
  const m = OFFSET.exec(offset);
  if (!m) throw new Error(`Bad UTC offset "${offset}", expected "+08:00"`);
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

function validDate(date: string): boolean {
  const d = YMD.exec(date);
  if (!d) return false;
  const t = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3])));
  return t.toISOString().slice(0, 10) === date;
}

function localToEpoch(date: string, hhmm: string, offsetMin: number): number {
  const d = YMD.exec(date);
  const t = HHMM.exec(hhmm);
  if (!d || !t) throw new Error(`Bad date or time: ${date} ${hhmm}`);
  const utc = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return utc - offsetMin * 60_000;
}

function epochToLocal(epochMs: number, offsetMin: number): { local: string; iso: string } {
  const shifted = new Date(epochMs + offsetMin * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = shifted.getUTCFullYear();
  const mo = pad(shifted.getUTCMonth() + 1);
  const da = pad(shifted.getUTCDate());
  const h = pad(shifted.getUTCHours());
  const mi = pad(shifted.getUTCMinutes());
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const off = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return { local: `${y}-${mo}-${da} ${h}:${mi}`, iso: `${y}-${mo}-${da}T${h}:${mi}:00${off}` };
}

function addDays(date: string, n: number): string {
  const d = YMD.exec(date);
  if (!d) throw new Error(`Bad date ${date}`);
  const t = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]) + n));
  return t.toISOString().slice(0, 10);
}

export function plan(posts: readonly PlanPost[], opts: PlanOptions): Scheduled[] {
  const offsetMin = parseOffsetMinutes(opts.utcOffset);
  const minGapMs = (opts.minGapHours ?? 3) * 3_600_000;
  const [awakeFrom, awakeTo] = opts.awake ?? [8, 23];
  const horizon = opts.horizonDays ?? 14;
  if (!validDate(opts.start)) throw new Error(`Bad start date "${opts.start}", expected YYYY-MM-DD`);
  const slots = [...new Set(opts.slots)].sort();
  if (slots.length === 0) throw new Error('At least one slot is required');
  for (const s of slots) if (!HHMM.test(s)) throw new Error(`Bad slot "${s}", expected HH:MM between 00:00 and 23:59`);

  // Candidate times over the horizon, in order.
  const candidates: { epochMs: number; date: string; slot: string }[] = [];
  for (let day = 0; day < horizon; day++) {
    const date = addDays(opts.start, day);
    for (const slot of slots) candidates.push({ epochMs: localToEpoch(date, slot, offsetMin), date, slot });
  }

  const taken: number[] = [];
  const out: Scheduled[] = [];
  for (const [index, post] of posts.entries()) {
    if (typeof post.text !== 'string') throw new Error(`Post ${index + 1} has no text`);
    const warnings: string[] = [];

    // Validate preferences; a bad one is reported, then ignored.
    let wantDate = post.date;
    let wantSlot = post.slot;
    if (wantDate !== undefined && !validDate(wantDate)) {
      warnings.push(`Preferred date "${wantDate}" is not a valid YYYY-MM-DD; ignored.`);
      wantDate = undefined;
    }
    if (wantSlot !== undefined && !slots.includes(wantSlot)) {
      warnings.push(`Preferred slot "${wantSlot}" is not one of ${slots.join(', ')}; ignored.`);
      wantSlot = undefined;
    }
    if (wantDate !== undefined && !candidates.some((c) => c.date === wantDate)) {
      warnings.push(`Preferred date ${wantDate} is outside the ${horizon}-day horizon from ${opts.start}; ignored.`);
      wantDate = undefined;
    }

    const matches = (c: { date: string; slot: string }) => (!wantDate || c.date === wantDate) && (!wantSlot || c.slot === wantSlot);
    const free = (c: { epochMs: number }) => !taken.includes(c.epochMs) && gapOk(c.epochMs, taken, minGapMs);
    const wanted = wantDate || wantSlot ? candidates.find(matches) : undefined;
    const chosen = candidates.find((c) => matches(c) && free(c)) ?? candidates.find(free);
    if (!chosen) throw new Error(`No free slot within ${horizon} days for post ${index + 1}: ${post.text.slice(0, 40)}…`);
    taken.push(chosen.epochMs);

    const hour = Number(chosen.slot.slice(0, 2));
    if (hour < awakeFrom || hour >= awakeTo) {
      warnings.push(`Slot ${chosen.slot} is outside awake hours ${awakeFrom}:00–${awakeTo}:00; replies in the first hours will go unanswered.`);
    }
    if (wanted && wanted.epochMs !== chosen.epochMs) {
      warnings.push(`Moved from preferred ${wanted.date} ${wanted.slot} to keep a ${minGapMs / 3_600_000}h gap.`);
    }
    const { local, iso } = epochToLocal(chosen.epochMs, offsetMin);
    out.push({ text: post.text, local, iso, epochMs: chosen.epochMs, warnings });
  }
  return out.sort((a, b) => a.epochMs - b.epochMs);
}

function gapOk(epochMs: number, taken: readonly number[], minGapMs: number): boolean {
  return taken.every((t) => Math.abs(t - epochMs) >= minGapMs);
}

const LOCAL = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})$/;

/** Flag an existing schedule (e.g. copied from the X scheduled list) for stacking and sleep-hour posts. */
export function audit(times: readonly { local: string }[], opts: Pick<PlanOptions, 'minGapHours' | 'awake'> = {}): string[] {
  const minGapMs = (opts.minGapHours ?? 3) * 3_600_000;
  const [awakeFrom, awakeTo] = opts.awake ?? [8, 23];
  const notes: string[] = [];
  const parsed: { local: string; ms: number }[] = [];
  for (const t of times) {
    const m = LOCAL.exec(t.local ?? '');
    const ms = m && validDate(m[1]!) && HHMM.test(m[2]!) ? Date.parse(`${m[1]}T${m[2]}:00Z`) : NaN;
    if (Number.isNaN(ms)) notes.push(`Cannot parse "${t.local}"; expected "YYYY-MM-DD HH:MM".`);
    else parsed.push({ local: `${m![1]} ${m![2]}`, ms });
  }
  parsed.sort((a, b) => a.ms - b.ms);
  for (let i = 0; i < parsed.length; i++) {
    const cur = parsed[i]!;
    const prev = parsed[i - 1];
    if (prev && cur.ms - prev.ms < minGapMs) notes.push(`${cur.local} is ${((cur.ms - prev.ms) / 3_600_000).toFixed(1)}h after ${prev.local}: stacked, each post gets less of its own reply window.`);
    const hour = Number(cur.local.slice(11, 13));
    if (hour < awakeFrom || hour >= awakeTo) notes.push(`${cur.local} is outside awake hours; nobody to answer replies.`);
  }
  return notes;
}
