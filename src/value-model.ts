/**
 * The default weights of X's For You value model, copied from the public
 * repository xai-org/x-algorithm (Apache-2.0), file
 * home-mixer/params/param.rs, read on 2026-11-18.
 *
 * How the README describes scoring:
 *   Final Score = Σ (weight_i × P(action_i))
 * The weights scale PREDICTED PROBABILITIES of each action for a given
 * viewer, not raw engagement counts. They are repository defaults and can
 * be overridden by experiments, so treat them as "what X says it values",
 * not as a formula you can run on your own numbers.
 */

export type ActionGroup = 'engagement' | 'click' | 'attention' | 'author' | 'negative';

export interface ActionWeight {
  /** Parameter name without the rust_home_mixer_ prefix and _weight suffix. */
  key: string;
  label: string;
  weight: number;
  group: ActionGroup;
  /** What a reader does that produces this action. */
  reader: string;
}

export const VALUE_MODEL_SOURCE = {
  repo: 'https://github.com/xai-org/x-algorithm',
  file: 'home-mixer/params/param.rs',
  readme: 'https://github.com/xai-org/x-algorithm#readme',
  retrieved: '2026-11-18',
  license: 'Apache-2.0',
} as const;

export const ACTION_WEIGHTS: readonly ActionWeight[] = [
  { key: 'share_via_copy_link', label: 'share via copy link', weight: 20.0, group: 'engagement', reader: 'copies the post link to send it elsewhere' },
  { key: 'reply', label: 'reply', weight: 5.0, group: 'engagement', reader: 'writes a reply' },
  { key: 'quote', label: 'quote', weight: 5.0, group: 'engagement', reader: 'quote posts with a comment' },
  { key: 'share_via_dm', label: 'share via DM', weight: 5.0, group: 'engagement', reader: 'sends the post in a direct message' },
  { key: 'follow_author', label: 'follow author', weight: 4.0, group: 'author', reader: 'follows you from the post' },
  { key: 'share', label: 'share', weight: 2.118, group: 'engagement', reader: 'opens the share menu' },
  { key: 'retweet', label: 'repost', weight: 1.0, group: 'engagement', reader: 'reposts without comment' },
  { key: 'favorite', label: 'like', weight: 0.708, group: 'engagement', reader: 'likes the post' },
  { key: 'cont_click_dwell_time', label: 'dwell after click (continuous)', weight: 0.385, group: 'attention', reader: 'opens the post and stays' },
  { key: 'click', label: 'post click', weight: 0.274, group: 'click', reader: 'opens the post detail' },
  { key: 'open_link', label: 'open link', weight: 0.2, group: 'click', reader: 'opens an outbound link' },
  { key: 'photo_expand', label: 'photo expand', weight: 0.05, group: 'click', reader: 'expands an image' },
  { key: 'quoted_click', label: 'quoted post click', weight: 0.05, group: 'click', reader: 'opens the quoted post' },
  { key: 'dwell', label: 'dwell', weight: 0.05, group: 'attention', reader: 'pauses on the post in the feed' },
  { key: 'post_unexplored', label: 'post unexplored', weight: 0.015, group: 'attention', reader: 'sees a post from a source they rarely get' },
  { key: 'cont_dwell_time', label: 'dwell time (continuous)', weight: 0.0075, group: 'attention', reader: 'time spent on the post in feed' },
  { key: 'video_open', label: 'video open', weight: 0.0, group: 'click', reader: 'opens a video' },
  { key: 'profile_click', label: 'profile click', weight: 0.0, group: 'click', reader: 'opens your profile' },
  { key: 'vqv', label: 'video quality view', weight: 0.0, group: 'attention', reader: 'watches a video past the quality threshold' },
  { key: 'quoted_vqv', label: 'quoted video quality view', weight: 0.0, group: 'attention', reader: 'watches the quoted video' },
  { key: 'post_video', label: 'post video', weight: 0.0, group: 'attention', reader: 'the post carries a video' },
  { key: 'grok_analyze', label: 'Grok analyze', weight: 0.0, group: 'click', reader: 'asks Grok about the post' },
  { key: 'not_dwelled', label: 'not dwelled', weight: -0.02, group: 'negative', reader: 'scrolls past without pausing' },
  { key: 'block_author', label: 'block author', weight: -31.2, group: 'negative', reader: 'blocks you' },
  { key: 'not_interested', label: 'not interested', weight: -53.07, group: 'negative', reader: 'marks "not interested"' },
  { key: 'mute_author', label: 'mute author', weight: -58.8, group: 'negative', reader: 'mutes you' },
  { key: 'report', label: 'report', weight: -234.0, group: 'negative', reader: 'reports the post' },
];

/** Extra boosts in the same file. */
export const BOOSTS = {
  /** Reply weight boost when author and replier follow each other. */
  bidirectional_follow_reply_weight_boost: 15.0,
  bidirectional_follow_dwell_weight_boost: 0.0,
} as const;

/** Qualitative adjustments described in the README; values not published in param.rs or weights.rs as of 2026-11-18. */
export const ADJUSTMENTS = [
  {
    name: 'Author diversity',
    readme: "each post after an author's first is multiplied by a decaying factor, down to a floor",
    meaning: 'Several of your posts in one feed load compete with each other. Space posts out.',
  },
  {
    name: 'Out-of-network discount',
    readme: 'posts from accounts the viewer does not follow are multiplied by a factor below 1; so are replies and reposts from followed accounts',
    meaning: 'Reaching strangers costs more than reaching followers. Replies and reposts rank below original posts even for followers.',
  },
  {
    name: 'New-author boost',
    readme: 'posts from authors whose impressions are below a threshold are lifted toward a target position',
    meaning: 'Small accounts get a lift. It is not a reason to create new accounts, which the rules forbid.',
  },
  {
    name: 'Age filter',
    readme: 'posts older than 48 hours are removed before scoring',
    meaning: 'A post has a two-day window. Reply and add to threads inside the first hours.',
  },
  {
    name: 'VMRanker',
    readme: 'reorders results using a determinantal point process over embeddings',
    meaning: 'Near-duplicate posts in one feed are spread apart. Do not post the same idea twice in a row.',
  },
] as const;

export function positiveActions(): ActionWeight[] {
  return ACTION_WEIGHTS.filter((a) => a.weight > 0).sort((a, b) => b.weight - a.weight);
}

export function negativeActions(): ActionWeight[] {
  return ACTION_WEIGHTS.filter((a) => a.weight < 0).sort((a, b) => a.weight - b.weight);
}

export function weightOf(key: string): number | undefined {
  return ACTION_WEIGHTS.find((a) => a.key === key)?.weight;
}
