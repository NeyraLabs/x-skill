/**
 * Reads the CSV files X lets an account export from its analytics pages
 * (account overview per day, or per-post content export) and reports what
 * the published value model cares about: replies, quotes, reposts, shares,
 * follows, next to impressions. No API, no credentials: you download the
 * CSV in the browser and point the tool at it.
 *
 * Column names differ between exports and change over time, so the parser
 * matches headers loosely and reports which columns it found.
 */

export interface Table {
  headers: string[];
  rows: Record<string, string>[];
}

/** RFC 4180-ish CSV parser: quotes, escaped quotes, CRLF. */
export function parseCsv(text: string): Table {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  const headers = (nonEmpty.shift() ?? []).map((h) => h.trim());
  return {
    headers,
    rows: nonEmpty.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))),
  };
}

export type Metric = 'impressions' | 'likes' | 'replies' | 'reposts' | 'quotes' | 'shares' | 'bookmarks' | 'follows' | 'profileVisits' | 'linkClicks' | 'engagements';

const ALIASES: Record<Metric, RegExp> = {
  impressions: /^(impressions|views)$/i,
  likes: /^(likes|favorites|favourites)$/i,
  replies: /^(replies|reply)$/i,
  reposts: /^(reposts|retweets)$/i,
  quotes: /^(quotes|quote (posts|tweets))$/i,
  shares: /^(shares?|share)$/i,
  bookmarks: /^(bookmarks|saves)$/i,
  follows: /^(new follows|follows|follows gained)$/i,
  profileVisits: /^(profile visits|user profile clicks)$/i,
  linkClicks: /^(url clicks|link clicks)$/i,
  engagements: /^engagements$/i,
};

const TEXT_RE = /^(post text|tweet text|text)$/i;
const DATE_RE = /^(date|time|created at)$/i;

export function detectColumns(headers: readonly string[]): { metrics: Partial<Record<Metric, string>>; text?: string; date?: string } {
  const metrics: Partial<Record<Metric, string>> = {};
  for (const h of headers) {
    for (const [m, re] of Object.entries(ALIASES) as [Metric, RegExp][]) {
      if (!metrics[m] && re.test(h)) metrics[m] = h;
    }
  }
  const text = headers.find((h) => TEXT_RE.test(h));
  const date = headers.find((h) => DATE_RE.test(h));
  const out: ReturnType<typeof detectColumns> = { metrics };
  if (text) out.text = text;
  if (date) out.date = date;
  return out;
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export interface Summary {
  rows: number;
  found: Metric[];
  missing: Metric[];
  totals: Partial<Record<Metric, number>>;
  /** Per 1,000 impressions, where impressions exist. */
  per1k: Partial<Record<Metric, number>>;
  /** Posts ordered by the actions the published value model weights highest (replies, quotes, shares, follows), when a text column exists. */
  topPosts: { text: string; replies: number; quotes: number; reposts: number; shares: number; follows: number; impressions: number }[];
  /** Days ordered by follows then replies, when a date column exists. */
  bestDays: { date: string; follows: number; replies: number; impressions: number }[];
  notes: string[];
}

export function summarize(table: Table, top = 10): Summary {
  const cols = detectColumns(table.headers);
  const found = Object.keys(cols.metrics) as Metric[];
  const missing = (Object.keys(ALIASES) as Metric[]).filter((m) => !found.includes(m));
  const totals: Partial<Record<Metric, number>> = {};
  for (const m of found) totals[m] = table.rows.reduce((s, r) => s + num(r[cols.metrics[m]!]), 0);

  const per1k: Partial<Record<Metric, number>> = {};
  const imp = totals.impressions ?? 0;
  if (imp > 0) {
    for (const m of found) if (m !== 'impressions') per1k[m] = round((totals[m] ?? 0) / imp * 1000);
  }

  const get = (r: Record<string, string>, m: Metric) => (cols.metrics[m] ? num(r[cols.metrics[m]!]) : 0);

  const topPosts = cols.text
    ? table.rows
        .map((r) => ({
          text: (r[cols.text!] ?? '').replace(/\s+/g, ' ').slice(0, 90),
          replies: get(r, 'replies'),
          quotes: get(r, 'quotes'),
          reposts: get(r, 'reposts'),
          shares: get(r, 'shares'),
          follows: get(r, 'follows'),
          impressions: get(r, 'impressions'),
        }))
        .sort((a, b) => b.replies + b.quotes + b.shares + b.follows - (a.replies + a.quotes + a.shares + a.follows) || b.reposts - a.reposts)
        .slice(0, top)
    : [];

  const bestDays = cols.date && !cols.text
    ? table.rows
        .map((r) => ({ date: r[cols.date!] ?? '', follows: get(r, 'follows'), replies: get(r, 'replies'), impressions: get(r, 'impressions') }))
        .sort((a, b) => b.follows - a.follows || b.replies - a.replies)
        .slice(0, top)
    : [];

  const notes: string[] = [];
  if (!cols.metrics.impressions) notes.push('No impressions column: rates per 1,000 are not computed.');
  if (!cols.text && !cols.date) notes.push('Neither a text nor a date column was found; only totals are reported.');
  notes.push('Ordering uses observed counts of the actions X weights highest (reply 5.0, quote 5.0, share 2.118, follow 4.0). It is not a reproduction of the ranker, which scores predicted probabilities per viewer.');

  return { rows: table.rows.length, found, missing, totals, per1k, topPosts, bestDays, notes };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
