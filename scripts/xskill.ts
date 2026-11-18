#!/usr/bin/env -S npx tsx
/**
 * xskill: offline helpers for running an X account by hand.
 *
 *   npx tsx scripts/xskill.ts <command> ...   (or: npm run xskill -- <command> ...)
 *
 *   xskill lint <file|->        [--limit 280] [--banned "a,b"] [--allow-link-only] [--json]
 *   xskill thread <file|->      [--limit 280] [--number slash|of] [--json]
 *   xskill plan <posts.json>    --start YYYY-MM-DD --offset +08:00 [--slots 09:30,14:30,22:30] [--gap 3] [--awake 8-23] [--json]
 *   xskill audit <times.json>   [--gap 3] [--awake 8-23]
 *   xskill analytics <file.csv> [--top 10] [--json]
 *   xskill weights
 *
 * Nothing here talks to X. Nothing posts. You read the output and act.
 */
import { readFileSync } from 'node:fs';
import { countPost } from '../src/count.js';
import { lint, worst } from '../src/lint.js';
import { splitThread } from '../src/thread.js';
import { plan, audit, type PlanPost } from '../src/plan.js';
import { parseCsv, summarize } from '../src/analytics.js';
import { ACTION_WEIGHTS, ADJUSTMENTS, BOOSTS, VALUE_MODEL_SOURCE } from '../src/value-model.js';

type Flags = Record<string, string | boolean>;

function parseArgs(argv: string[]): { cmd: string; positional: string[]; flags: Flags } {
  const [cmd = 'help', ...rest] = argv;
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else positional.push(a);
  }
  return { cmd, positional, flags };
}

function readInput(path: string | undefined): string {
  if (!path || path === '-') return readFileSync(0, 'utf8');
  return readFileSync(path, 'utf8');
}

function str(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}

function numFlag(flags: Flags, key: string, fallback: number): number {
  const v = str(flags, key);
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function out(obj: unknown, flags: Flags, human: () => void): void {
  if (flags.json) console.log(JSON.stringify(obj, null, 2));
  else human();
}

function cmdLint(positional: string[], flags: Flags): number {
  const text = readInput(positional[0]);
  const limit = numFlag(flags, 'limit', 280);
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
  const limit = numFlag(flags, 'limit', 280);
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
  const raw = JSON.parse(readInput(positional[0])) as unknown;
  const posts: PlanPost[] = Array.isArray(raw) ? raw.map((p) => (typeof p === 'string' ? { text: p } : (p as PlanPost))) : [];
  const start = str(flags, 'start');
  const utcOffset = str(flags, 'offset');
  if (!start || !utcOffset) {
    console.error('plan needs --start YYYY-MM-DD and --offset +08:00');
    return 2;
  }
  const slots = (str(flags, 'slots') ?? '09:30,14:30,22:30').split(',').map((s) => s.trim());
  const awakeRaw = (str(flags, 'awake') ?? '8-23').split('-').map(Number);
  const awake: [number, number] = [awakeRaw[0] ?? 8, awakeRaw[1] ?? 23];
  const scheduled = plan(posts, { start, utcOffset, slots, minGapHours: numFlag(flags, 'gap', 3), awake });
  out(scheduled, flags, () => {
    for (const s of scheduled) {
      console.log(`${s.local}  ${s.text.replace(/\s+/g, ' ').slice(0, 70)}`);
      for (const w of s.warnings) console.log(`    ! ${w}`);
    }
  });
  return 0;
}

function cmdAudit(positional: string[], flags: Flags): number {
  const raw = JSON.parse(readInput(positional[0])) as unknown;
  const times = Array.isArray(raw) ? raw.map((t) => (typeof t === 'string' ? { local: t } : (t as { local: string }))) : [];
  const awakeRaw = (str(flags, 'awake') ?? '8-23').split('-').map(Number);
  const notes = audit(times, { minGapHours: numFlag(flags, 'gap', 3), awake: [awakeRaw[0] ?? 8, awakeRaw[1] ?? 23] });
  out({ notes }, flags, () => {
    if (notes.length === 0) console.log('ok: no stacked or sleep-hour posts');
    for (const n of notes) console.log(`! ${n}`);
  });
  return 0;
}

function cmdAnalytics(positional: string[], flags: Flags): number {
  const table = parseCsv(readInput(positional[0]));
  const summary = summarize(table, numFlag(flags, 'top', 10));
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
    console.log('Final Score = Σ (weight × P(action)); weights scale predicted probabilities, not counts.\n');
    for (const a of ACTION_WEIGHTS) console.log(`${String(a.weight).padStart(8)}  ${a.label.padEnd(32)} ${a.reader}`);
    console.log(`\nreply boost when you follow each other: +${BOOSTS.bidirectional_follow_reply_weight_boost}`);
    console.log('\nAdjustments described in the README (values not in the public params):');
    for (const adj of ADJUSTMENTS) console.log(`- ${adj.name}: ${adj.meaning}`);
  });
  return 0;
}

function help(): number {
  console.log(readFileSync(new URL(import.meta.url)).toString().split('\n').slice(2, 14).join('\n').replace(/^ \* ?/gm, ''));
  return 0;
}

const { cmd, positional, flags } = parseArgs(process.argv.slice(2));
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
