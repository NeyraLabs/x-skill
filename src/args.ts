/** Tiny argv parser for the CLI. Boolean flags never swallow the next word. */

export type Flags = Record<string, string | boolean>;

export interface ParsedArgs {
  cmd: string;
  positional: string[];
  flags: Flags;
}

export const BOOLEAN_FLAGS: ReadonlySet<string> = new Set(['json', 'allow-link-only', 'help']);

export function parseArgs(argv: readonly string[], booleans: ReadonlySet<string> = BOOLEAN_FLAGS): ParsedArgs {
  const [cmd = 'help', ...rest] = argv;
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === '--') {
      positional.push(...rest.slice(i + 1));
      break;
    }
    if (!a.startsWith('--')) {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > 2) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = rest[i + 1];
    if (booleans.has(key) || next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  return { cmd, positional, flags };
}

export function str(flags: Flags, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}

/** Numeric flag with a default; a present but unusable value throws instead of silently falling back. */
export function num(flags: Flags, key: string, fallback: number, range: { min?: number; integer?: boolean } = {}): number {
  const v = flags[key];
  if (v === undefined) return fallback;
  const n = typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new Error(`--${key} needs a number, got "${String(v)}"`);
  if (range.integer && !Number.isInteger(n)) throw new Error(`--${key} must be a whole number, got ${n}`);
  if (range.min !== undefined && n < range.min) throw new Error(`--${key} must be at least ${range.min}, got ${n}`);
  return n;
}
