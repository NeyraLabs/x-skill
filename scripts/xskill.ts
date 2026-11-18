#!/usr/bin/env -S npx tsx
/**
 * xskill: offline helpers for running an X account by hand.
 *
 *   npx tsx scripts/xskill.ts <command> ...   (or: npm run xskill -- <command> ...)
 *
 *   xskill lint <file|->        [--limit 280] [--banned "a,b"] [--allow-link-only] [--json]
 *   xskill thread <file|->      [--limit 280] [--number slash|of] [--json]
 *   xskill plan <posts.json>    --start YYYY-MM-DD --offset +08:00 [--slots 09:30,14:30,22:30] [--gap 3] [--awake 8-23] [--json]
 *   xskill audit <times.json>   [--gap 3] [--awake 8-23] [--json]
 *   xskill analytics <file.csv> [--top 10] [--json]
 *   xskill weights              [--json]
 *
 * Nothing here talks to X. Nothing posts. You read the output and act.
 */
import { readFileSync } from 'node:fs';
import { parseArgs, str, num, type Flags } from '../src/args.js';
import { countPost } from '../src/count.js';
import { lint, worst } from '../src/lint.js';
import { splitThread } from '../src/thread.js';
import { plan, audit, type PlanPost } from '../src/plan.js';
import { parseCsv, summarize } from '../src/analytics.js';
import { ACTION_WEIGHTS, ADJUSTMENTS, BOOSTS, VALUE_MODEL_SOURCE } from '../src/value-model.js';

class UsageError extends Error {}

function readInput(path: string | undefined): string {
  try {
    if (!path || path === '-') return readFileSync(0, 'utf8');
    return readFileSync(path, 'utf8');
  } catch (e) {
    throw new UsageError(`Cannot read ${path ?? 'stdin'}: ${(e as Error).message}`);
  }
}

function readJsonArray(path: string | undefined, what: string): unknown[] {
  let raw: unknown;
  try {
    raw = JSON.parse(readInput(path));
  } catch (e) {
    if (e instanceof UsageError) throw e;
    throw new UsageError(`${path ?? 'stdin'} is not valid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(raw)) throw new UsageError(`${path ?? 'stdin'} must be a JSON array of ${what}`);
  return raw;
}

function awakeFrom(flags: Flags): [number, number] {
  const raw = str(flags, 'awake') ?? '8-23';
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (!m) throw new UsageError(`--awake must look like 8-23, got "${raw}"`);
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (from < 0 || to > 24 || from >= to) throw new UsageError(`--awake range "${raw}" is out of order or outside 0-24`);
  return [from, to];
}

function out(obj: unknown, flags: Flags, human: () => void): void {
  if (flags.json) console.log(JSON.stringify(obj, null, 2));
  else human();
}

function cmdLint(positional: string[], flags: Flags): number {
  const text = readInput(positional[0]);
  const limit = num(flags, 'limit', 280, { min: 1, integer: true });
  const banned = (str(flags, 'banned') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const findings = lint(text, { limit, banned, allowLinkOnly: Boolean(flags['allow-link-only']) });
  const count = countPost(text.trim(), limit);
  const level = worst(findings);
  out({ count, level, findings }, flags, () => {
    console.log(`length ${count.weighted}/${limit} (${count.remaining} left)${count.urls.length ? `, ${count.urls.length} url` : ''}`);
    if (findings.length === 0) console.log('ok: no findings');
    for (const f of findings) {
      console.log(`${f.severity.toUpperCase().padEnd(5)} ${f.rule}: ${f.message}`);
      console.log(`      why: ${f.why}`);
    }
  });
  return level === 'error' ? 1 : 0;
}

function cmdThread(positional: string[], flags: Flags): number {
  const text = readInput(positional[0]);
  const limit = num(flags, 'limit', 280, { min: 1, integer: true });
  const numberingFlag = str(flags, 'number');
  const numbering = numberingFlag === 'slash' || numberingFlag === 'of' ? numberingFlag : 'none';
  const posts = splitThread(text, { limit, numbering });
  out({ posts }, flags, () => {
    posts.forEach((p, i) => {
      const c = countPost(p, limit);
      console.log(`--- post ${i + 1} (${c.weighted}/${limit}) ---\n${p}\n`);
    });
  });
  return 0;
}

function cmdPlan(positional: string[], flags: Flags): number {
  const raw = readJsonArray(positional[0], 'strings or {text, slot?, date?} objects');
  const posts: PlanPost[] = raw.map((p, i) => {
    if (typeof p === 'string') return { text: p };
    if (p && typeof p === 'object' && typeof (p as PlanPost).text === 'string') return p as PlanPost;
    throw new UsageError(`Entry ${i + 1} is neither a string nor an object with a "text" string`);
  });
  const start = str(flags, 'start');
  const utcOffset = str(flags, 'offset');
  if (!start || !utcOffset) throw new UsageError('plan needs --start YYYY-MM-DD and --offset +08:00');
  const slots = (str(flags, 'slots') ?? '09:30,14:30,22:30').split(',').map((s) => s.trim()).filter(Boolean);
  const scheduled = plan(posts, { start, utcOffset, slots, minGapHours: num(flags, 'gap', 3, { min: 0 }), awake: awakeFrom(flags) });
  out(scheduled, flags, () => {
    for (const s of scheduled) {
      console.log(`${s.local}  ${s.text.replace(/\s+/g, ' ').slice(0, 70)}`);
      for (const w of s.warnings) console.log(`    ! ${w}`);
    }
  });
  return 0;
}

function cmdAudit(positional: string[], flags: Flags): number {
  const raw = readJsonArray(positional[0], '"YYYY-MM-DD HH:MM" strings');
  const times = raw.map((t, i) => {
    if (typeof t === 'string') return { local: t };
    if (t && typeof t === 'object' && typeof (t as { local?: unknown }).local === 'string') return t as { local: string };
    throw new UsageError(`Entry ${i + 1} is neither a string nor an object with a "local" string`);
  });
  const notes = audit(times, { minGapHours: num(flags, 'gap', 3, { min: 0 }), awake: awakeFrom(flags) });
  out({ notes }, flags, () => {
    if (notes.length === 0) console.log('ok: no stacked or sleep-hour posts');
    for (const n of notes) console.log(`! ${n}`);
  });
  return notes.some((n) => n.startsWith('Cannot parse')) ? 2 : 0;
}

function cmdAnalytics(positional: string[], flags: Flags): number {
  const table = parseCsv(readInput(positional[0]));
  if (table.headers.length === 0) throw new UsageError('The CSV has no header row');
  const summary = summarize(table, num(flags, 'top', 10, { min: 1, integer: true }));
  out(summary, flags, () => {
    console.log(`${summary.rows} rows; columns found: ${summary.found.join(', ') || 'none'}; missing: ${summary.missing.join(', ') || 'none'}`);
    console.log('totals:', Object.entries(summary.totals).map(([k, v]) => `${k}=${v}`).join('  '));
    if (Object.keys(summary.per1k).length) console.log('per 1,000 impressions:', Object.entries(summary.per1k).map(([k, v]) => `${k}=${v}`).join('  '));
    if (summary.topPosts.length) {
      console.log('\nposts by replies+quotes+shares+follows:');
      for (const p of summary.topPosts) console.log(`  r${p.replies} q${p.quotes} s${p.shares} f${p.follows} rp${p.reposts} imp${p.impressions}  ${p.text}`);
    }
    if (summary.bestDays.length) {
      console.log('\ndays by follows then replies:');
      for (const d of summary.bestDays) console.log(`  ${d.date}  follows ${d.follows}  replies ${d.replies}  impressions ${d.impressions}`);
    }
    for (const n of summary.notes) console.log(`note: ${n}`);
  });
  return 0;
}

function cmdWeights(flags: Flags): number {
  out({ source: VALUE_MODEL_SOURCE, weights: ACTION_WEIGHTS, boosts: BOOSTS, adjustments: ADJUSTMENTS }, flags, () => {
    console.log(`Default weights from ${VALUE_MODEL_SOURCE.repo} (${VALUE_MODEL_SOURCE.file}, read ${VALUE_MODEL_SOURCE.retrieved}).`);
    console.log('Final Score = Σ (weight × P(action)). Weights multiply predicted probabilities, not counts;');
    console.log('param.rs calls reading them as count ratios ("one report cancels 468 likes") a misinterpretation.\n');
    for (const a of ACTION_WEIGHTS) console.log(`${String(a.weight).padStart(8)}  ${a.label.padEnd(32)} ${a.reader}`);
    console.log(`\nreply weight boost: +${BOOSTS.bidirectional_follow_reply_weight_boost} on P(reply) for an ORIGINAL post (not a reply or repost) when viewer and author follow each other (inputs.rs)`);
    console.log('\nAdjustments named in the README, with their status in the public defaults:');
    for (const adj of ADJUSTMENTS) console.log(`- ${adj.name}: ${adj.status}\n  → ${adj.meaning}`);
  });
  return 0;
}

function help(): number {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  const block = src.split('\n').slice(2, 14).join('\n').replace(/^ \* ?/gm, '');
  console.log(block);
  return 0;
}

const { cmd, positional, flags } = parseArgs(process.argv.slice(2));
try {
  let code = 0;
  switch (cmd) {
    case 'lint': code = cmdLint(positional, flags); break;
    case 'thread': code = cmdThread(positional, flags); break;
    case 'plan': code = cmdPlan(positional, flags); break;
    case 'audit': code = cmdAudit(positional, flags); break;
    case 'analytics': code = cmdAnalytics(positional, flags); break;
    case 'weights': code = cmdWeights(flags); break;
    default: code = help();
  }
  process.exitCode = code;
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`xskill: ${msg}`);
  process.exitCode = 2;
}
