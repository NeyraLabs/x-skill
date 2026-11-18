/**
 * Weighted character counting for X posts.
 *
 * Approximates the twitter-text v3 configuration that X uses:
 * - most Latin, Greek, Cyrillic, Hebrew, Arabic and general punctuation
 *   code points weigh 1 (ranges U+0000–U+10FF, U+2000–U+200D,
 *   U+2010–U+201F, U+2032–U+2037);
 * - every other code point (CJK, most symbols) weighs 2;
 * - an emoji grapheme weighs 2 whatever its code point count;
 * - every URL weighs 23, because X wraps links in t.co.
 *
 * The limit for a standard account is 280. Premium long posts have a
 * different limit, so `limit` is a parameter everywhere.
 */

export const DEFAULT_LIMIT = 280;
export const URL_WEIGHT = 23;

const LIGHT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];

const TLDS =
  'com|org|net|io|ai|dev|co|app|me|xyz|info|biz|gov|edu|uk|de|fr|es|it|nl|ru|ua|pl|jp|cn|in|br|ca|au|ch|se|no|fi|dk|be|at|cz|id|sg|kr|tv|cc|ly|sh|to|gg|us|eu|so|fm|is|link|news|tech|blog|site|online|store|cloud|network|money|finance|exchange|zone';

/** Matches scheme URLs, www. hosts and bare domains with a known TLD. */
export const URL_PATTERN = new RegExp(
  String.raw`(?:https?:\/\/[^\s<>()\[\]"']+|(?:^|(?<=[\s(]))(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:${TLDS})(?:\/[^\s<>()\[\]"']*)?(?=$|[\s),.!?;:]))`,
  'giu',
);

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function codePointWeight(cp: number): number {
  for (const [lo, hi] of LIGHT_RANGES) {
    if (cp >= lo && cp <= hi) return 1;
  }
  return 2;
}

/** Weight of plain text (no URLs inside). */
function textWeight(text: string): number {
  let total = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (segment.includes('‍') || EMOJI.test(segment)) {
      total += 2;
      continue;
    }
    for (const ch of segment) total += codePointWeight(ch.codePointAt(0) ?? 0);
  }
  return total;
}

export interface CountResult {
  /** Weighted length as X counts it. */
  weighted: number;
  /** Raw code point count, for reference. */
  codePoints: number;
  urls: string[];
  remaining: number;
  limit: number;
  ok: boolean;
}

/** Trailing sentence punctuation is not part of a link. */
function trimUrl(u: string): string {
  return u.replace(/[.,!?;:]+$/, '');
}

export function extractUrls(text: string): string[] {
  return [...text.normalize('NFC').matchAll(URL_PATTERN)].map((m) => trimUrl(m[0]));
}

export function countPost(input: string, limit: number = DEFAULT_LIMIT): CountResult {
  // twitter-text normalises to NFC before counting, so "e + combining acute" weighs 1.
  const text = input.normalize('NFC');
  const urls = extractUrls(text);
  const plain = text.replace(URL_PATTERN, (m) => ' ' + m.slice(trimUrl(m).length));
  // the replacement space weighs 1, so subtract it per URL
  const weighted = textWeight(plain) - urls.length + urls.length * URL_WEIGHT;
  return {
    weighted,
    codePoints: [...text].length,
    urls,
    remaining: limit - weighted,
    limit,
    ok: weighted <= limit,
  };
}

/** Weighted length only. */
export function weightedLength(text: string): number {
  return countPost(text).weighted;
}
