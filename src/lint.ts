import { countPost, extractUrls, DEFAULT_LIMIT } from './count.js';

export type Severity = 'error' | 'warn' | 'info';

export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  /** Why the rule exists: the published ranking code, X's rules, or plain reader behaviour. */
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
const KNOWN_ACRONYMS = /^(?:CISA|NIST|API|MCP|CVE|AI|USA|EU|UK|GDPR|HTTPS?|JSON|SQL|AWS|GPU|CPU|LLM|OSS|CEO|CTO|CFO|NASA|FBI|OWASP|SDK|CLI|HTML|CSS|NPM|IETF|RFC|ISO|SOC|HIPAA|DNS|TLS|SSH|VPN|IoT|SaaS)$/;
/**
 * Engagement bait: an imperative asking the reader for an action in exchange
 * for nothing. Anchored at the start of a sentence or line so that "people
 * like this approach" and "I follow this rule" do not trip it.
 */
const BAIT_RE =
  /(?:^|[.!?\n]\s*|[,;:]\s+)(?:(?:please\s+)?(?:like|rt|retweet|repost|share|bookmark)\s+(?:this\s+)?(?:if|and|&|for|to\s+support)\b|(?:please\s+)?follow\s+(?:me|us|for\s+more|back|for\s+follow)\b|tag\s+(?:a|your|\d+|three|two)\b|comment\s+below\b|drop\s+(?:a|an|your)\s+\S+\s+(?:below|if|in\s+the\s+comments)|smash\s+that\b|hit\s+(?:like|follow|the\s+bell)\b|f4f\b|follow\s*4\s*follow\b)/i;
const URGENCY_RE = /🚨|\bBREAKING\b|\bURGENT\b|\blast chance\b|\bhurry\b/i;
const QUESTION_OR_ASK_RE = /\?|\b(?:what do you|which|tell me|how do you|your take|disagree|what would you|anyone)\b/i;
const SOURCE_CUE_RE = /\b(?:source|per|according|says|said|reports?|published|released|added|study|data|survey|from|via|by)\b|\b[A-Z]{2,}\b|https?:\/\//;

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
      'The composer will refuse it, or it becomes a long post that the timeline truncates.',
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
      'The model predicts dwell and "not dwelled" per post; the first line decides whether the reader pauses. Reader behaviour, not a published number.',
    );
  }
  const firstUrls = extractUrls(firstLine);
  if (/^(https?:\/\/|www\.)/i.test(firstLine) || (firstUrls.length > 0 && firstLine.length <= (firstUrls[0]?.length ?? 0) + 3)) {
    push(
      'hook-link',
      'warn',
      'The first line is a link. Lead with the fact or the question, put the link after it.',
      'A bare link gives the reader nothing to answer or forward; the model predicts replies, quotes and shares, not just link opens.',
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
      'There is no link penalty in the public code (open_link has a positive weight), but a link-only post invites one action and no conversation. Say what the reader will find, or put the link in a reply.',
    );
  }

  const hashtags = [...trimmed.matchAll(HASHTAG_RE)].length;
  if (hashtags > 2) {
    push('hashtags', 'warn', `${hashtags} hashtags; use at most 2.`, 'Hashtag walls push the text out of the first glance and read as spam. There is no hashtag term in the published value model.');
  }

  const mentions = [...trimmed.matchAll(MENTION_RE)].length;
  if (mentions > 3) {
    push('mentions', 'warn', `${mentions} mentions; more than 3 reads as a tag wall.`, "Unsolicited mass mentions fall under X's platform manipulation and spam rules, and they invite mute and report, which the model predicts with negative weights.");
  }

  const caps = [...trimmed.matchAll(CAPS_WORD_RE)].filter((m) => !KNOWN_ACRONYMS.test(m[0]));
  if (caps.length > 2) {
    push('caps', 'warn', `${caps.length} words in capitals: ${caps.slice(0, 4).map((m) => m[0]).join(', ')}.`, 'Shouting is the house style of low-quality accounts; it earns "not interested" and mutes, both negative in the model.');
  }

  const emoji = [...trimmed.matchAll(EMOJI_RE)].length;
  if (emoji > 2) {
    push('emoji', 'warn', `${emoji} emoji; keep it to 2 or fewer.`, 'Each emoji weighs 2 characters and emoji walls are a spam signal to readers.');
  }

  if (BAIT_RE.test(trimmed)) {
    push(
      'bait',
      'error',
      'Engagement bait detected ("like if", "follow for more", "tag a friend", "comment below" and similar).',
      "X's rules name engagement farming as platform manipulation. In the model, bait invites the actions with negative weights (not interested, mute, report) from the readers you want to keep.",
    );
  }

  if (URGENCY_RE.test(trimmed)) {
    push('urgency', 'warn', 'Alarm words or sirens (BREAKING, 🚨, URGENT).', 'Alarm framing is copied by low-quality accounts; it earns mutes from careful readers.');
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
      'Reply and quote are among the actions the model is built to predict, with higher weights than like. The weights are not count ratios, but the direction is clear: the feed is tuned for conversation.',
    );
  }

  if (/\b\d+(?:[.,]\d+)?%|\b\d{2,}\b/.test(trimmed) && !SOURCE_CUE_RE.test(trimmed)) {
    push('number-without-source', 'info', 'A number with no source word or link next to it.', 'Numbers travel when the reader can defend them; a sourced number gets quoted and copied, an unsourced one gets corrected.');
  }

  return findings;
}

export function worst(findings: readonly Finding[]): Severity | 'ok' {
  if (findings.some((f) => f.severity === 'error')) return 'error';
  if (findings.some((f) => f.severity === 'warn')) return 'warn';
  if (findings.length > 0) return 'info';
  return 'ok';
}
