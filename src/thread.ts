import { countPost, URL_PATTERN, DEFAULT_LIMIT } from './count.js';

export type Numbering = 'none' | 'slash' | 'of';

export interface ThreadOptions {
  limit?: number;
  /** 'slash' = "1/", 'of' = "1/7" appended to each post. */
  numbering?: Numbering;
}

/** Split text into sentences, keeping URLs whole. */
function sentences(paragraph: string): string[] {
  const protectedText = paragraph.replace(URL_PATTERN, (m) => m.replace(/\./g, '\u0000'));
  const parts = protectedText.split(/(?<=[.!?])\s+(?=\S)/);
  return parts.map((p) => p.replace(/\u0000/g, '.').trim()).filter(Boolean);
}

/** Split a sentence that is itself too long on word boundaries. */
function words(sentence: string, fits: (s: string) => boolean): string[] {
  const out: string[] = [];
  let current = '';
  for (const w of sentence.split(/\s+/)) {
    const next = current ? `${current} ${w}` : w;
    if (fits(next)) {
      current = next;
    } else {
      if (current) out.push(current);
      current = w;
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * Pack text into posts that each fit the weighted limit. Paragraph breaks
 * (blank lines) are preferred split points, then sentence ends, then words.
 * Numbering, when asked for, is appended and its width reserved.
 */
export function splitThread(text: string, opts: ThreadOptions = {}): string[] {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const numbering = opts.numbering ?? 'none';
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, '\n').trim())
    .filter(Boolean);

  const fitsWithReserve = (reserve: number) => (s: string) => countPost(s).weighted + reserve <= limit;

  // Pass 1: pack with a generous reserve for numbering ("99/99" + space = 6).
  const reserve = numbering === 'none' ? 0 : 6;
  const fits = fitsWithReserve(reserve);
  const units: string[] = [];
  for (const p of paragraphs) {
    if (fits(p)) {
      units.push(p);
      continue;
    }
    for (const s of sentences(p)) {
      if (fits(s)) units.push(s);
      else units.push(...words(s, fits));
    }
  }

  const posts: string[] = [];
  let current = '';
  for (const u of units) {
    const joiner = current && paragraphs.includes(u) && paragraphs.includes(current) ? '\n\n' : ' ';
    const next = current ? `${current}${joiner}${u}` : u;
    if (fits(next)) {
      current = next;
    } else {
      if (current) posts.push(current);
      current = u;
    }
  }
  if (current) posts.push(current);

  if (numbering === 'none') return posts;
  const total = posts.length;
  return posts.map((p, i) => (numbering === 'slash' ? `${p} ${i + 1}/` : `${p} ${i + 1}/${total}`));
}

/** True when every post fits the limit. */
export function threadFits(posts: readonly string[], limit: number = DEFAULT_LIMIT): boolean {
  return posts.every((p) => countPost(p, limit).ok);
}
