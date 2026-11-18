import { countPost, extractUrls, DEFAULT_LIMIT } from './count.js';

export type Severity = 'error' | 'warn' | 'info';

export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  /** Why the rule exists, tied to the published ranking code or platform rules. */
  why: string;
}

export interface LintOptions {
  /** Weighted character limit. 280 for a standard account. */
  limit?: number;
  /** Phrases your own house rules forbid (case-insensitive). */
  banned?: readonly string[];
  /** Allow a post that is only a link plus a few words (for a thread tail). */
  allowLinkOnly?: boolean;
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const MENTION_RE = /(^|\s)@[A-Za-z0-9_]{1,15}\b/g;
const CAPS_WORD_RE = /\b[A-Z]{4,}\b/g;
const BAIT_RE =
  /\b(?:like|rt|retweet|repost|follow|share|bookmark)\s+(?:if|for|this|to|and)\b|\btag\s+(?:a|your|3|three)\b|\bcomment\s+below\b|\bdrop\s+(?:a|your)\b|\bfollow\s+me\b|\bfollow\s+back\b|\bf4f\b/i;
const URGENCY_RE = /🚨|\bBREAKING\b|\bURGENT\b|\blast chance\b|\bhurry\b/i;
const QUESTION_OR_ASK_RE = /\?|\b(?:what do you|which|tell me|how do you|your take|disagree|what would you|anyone)\b/i;

export function lint(text: string, opts: LintOptions = {}): Finding[] {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const findings: Finding[] = [];
  const push = (rule: string, severity: Severity, message: string, why: string) =>
    findings.push({ rule, severity, message, why });

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    push('empty', 'error', 'The post is empty.', 'Nothing to rank.');
    return findings;
  }

  const count = countPost(trimmed, limit);
  if (!count.ok) {
    push(
      'length',
      'error',
      `Weighted length ${count.weighted} is over the limit of ${limit} (${-count.remaining} over). URLs count as 23, CJK and emoji as 2.`,
      'The composer will refuse it or turn it into a long post that the timeline truncates.',
    );
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const firstLine = lines[0] ?? '';
  // The hook is the first line of a multi-line post, or the first sentence of a one-line post.
  const hook = lines.length > 1 ? firstLine : (firstLine.split(/(?<=[.!?])\s+(?=\S)/)[0] ?? firstLine);
  const firstCount = countPost(hook, limit).weighted;
  if (firstCount > 140) {
    push(
      'hook-length',
      'warn',
      `The hook (first line or first sentence) weighs ${firstCount}; keep it under 140 so it reads in one glance.`,
      'Dwell is predicted per post in the feed; the first line decides whether the reader pauses or scrolls past (not_dwelled is weighted negatively).',
    );
  }
  if (/^(https?:\/\/|www\.)/i.test(firstLine) || extractUrls(firstLine).length > 0 && firstLine.length <= extractUrls(firstLine)[0]!.length + 3) {
    push(
      'hook-link',
      'warn',
      'The first line is a link. Lead with the fact or the question, put the link after it.',
      'open_link weighs 0.2 while reply weighs 5.0 and copy-link 20.0; a bare link gives the reader nothing to answer.',
    );
  }
  if (/^#/.test(firstLine)) {
    push('hook-hashtag', 'warn', 'The first line starts with a hashtag.', 'The hook is the only line most people read; spend it on a fact.');
  }

  const urls = count.urls;
  const withoutUrls = trimmed.replace(/https?:\/\/\S+|www\.\S+/gi, '').trim();
  if (!opts.allowLinkOnly && urls.length > 0 && countPost(withoutUrls).weighted < 40) {
    push(
      'link-only',
      'warn',
      'The post is a link with fewer than 40 characters of text.',
      'A link-only post invites one low-weight action (open_link 0.2). Say what the reader will find and why it matters, or put the link in a reply.',
    );
  }

  const hashtags = [...trimmed.matchAll(HASHTAG_RE)].length;
  if (hashtags > 2) {
    push('hashtags', 'warn', `${hashtags} hashtags; use at most 2.`, 'Hashtag walls read as spam and push the text out of the first glance. There is no hashtag term in the published value model.');
  }

  const mentions = [...trimmed.matchAll(MENTION_RE)].length;
  if (mentions > 3) {
    push('mentions', 'warn', `${mentions} mentions; more than 3 reads as a tag wall.`, 'Unsolicited mass mentions are listed under platform manipulation in X\'s rules and invite mute and report, the most negative weights.');
  }

  const caps = [...trimmed.matchAll(CAPS_WORD_RE)].filter((m) => !/^(?:CISA|NIST|API|MCP|CVE|AI|USA|EU|UK|GDPR|HTTPS?|JSON|SQL|AWS|GPU|CPU|LLM|OSS|CEO|CTO|CFO|NASA|FBI|OWASP)$/.test(m[0]));
  if (caps.length > 2) {
    push('caps', 'warn', `${caps.length} words in capitals: ${caps.slice(0, 4).map((m) => m[0]).join(', ')}.`, 'Shouting is a known trigger for "not interested" (-53.07).');
  }

  const emoji = [...trimmed.matchAll(EMOJI_RE)].length;
  if (emoji > 2) {
    push('emoji', 'warn', `${emoji} emoji; keep it to 2 or fewer.`, 'Each emoji weighs 2 characters and emoji walls are a spam signal to readers.');
  }

  if (BAIT_RE.test(trimmed)) {
    push(
      'bait',
      'error',
      'Engagement bait detected ("like if", "follow for", "tag a friend", "comment below" and similar).',
      'Bait trades a 0.708 like for the risk of a -53.07 "not interested" or a -234 report, and X\'s rules name engagement farming as manipulation.',
    );
  }

  if (URGENCY_RE.test(trimmed)) {
    push('urgency', 'warn', 'Alarm words or sirens (BREAKING, 🚨, URGENT).', 'Alarm framing is copied by low-quality accounts; it earns mutes from the readers you want to keep.');
  }

  for (const phrase of opts.banned ?? []) {
    if (phrase && trimmed.toLowerCase().includes(phrase.toLowerCase())) {
      push('banned', 'error', `Contains a banned phrase: "${phrase}".`, 'Your own house rule.');
    }
  }

  if (!QUESTION_OR_ASK_RE.test(trimmed)) {
    push(
      'no-invitation',
      'info',
      'No question or invitation to answer. Fine for a plain statement; consider one specific question.',
      'Reply (5.0) and quote (5.0) outweigh like (0.708) seven times over, and replies from mutual follows get a further 15.0 boost.',
    );
  }

  if (/\b\d+(?:[.,]\d+)?%|\b\d{2,}\b/.test(trimmed) && !/\b(?:source|per|according|says|said|reports?|published|released|added|study|data|survey|from|via|by)\b|\b[A-Z]{2,}\b|https?:\/\//.test(trimmed)) {
    push('number-without-source', 'info', 'A number with no source word or link next to it.', 'Numbers travel (copy link 20.0) when the reader can defend them; a sourced number gets quoted, an unsourced one gets corrected.');
  }

  return findings;
}

export function worst(findings: readonly Finding[]): Severity | 'ok' {
  if (findings.some((f) => f.severity === 'error')) return 'error';
  if (findings.some((f) => f.severity === 'warn')) return 'warn';
  if (findings.length > 0) return 'info';
  return 'ok';
}
