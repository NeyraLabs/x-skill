/**
 * The default weights of X's For You value model, copied from the public
 * repository xai-org/x-algorithm (Apache-2.0), file
 * home-mixer/params/param.rs, read on 2026-11-18.
 *
 * How the code describes scoring:
 *   Final Score = Σ (weight_i × P(action_i))
 * Each weight multiplies the PREDICTED PROBABILITY that this viewer takes
 * that action on this post (or a continuous value such as watch time).
 * The comment above the weights in param.rs says the weights "reflect a
 * combination of how much an action is valued in ranking and typical
 * propensities of these actions across the X network", that reading the
 * ratios as count equivalences ("one report cancels 468 likes") is a
 * common misinterpretation, and that a report is weighted high because
 * its baseline probability is more than 1000x lower than a like's.
 *
 * So: the table tells you WHICH actions the model is built to predict and
 * in which direction. It does not let you convert likes into replies, and
 * it is not a formula you can run on your own counts.
 */

export type ActionGroup = 'engagement' | 'click' | 'attention' | 'author' | 'negative';

export interface ActionWeight {
  /** Parameter name without the rust_home_mixer_ prefix and _weight suffix. */
  key: string;
  label: string;
  weight: number;
  group: ActionGroup;
  /** What the action is, in plain words. Marked "(name only)" where upstream gives no description. */
  reader: string;
}

export const VALUE_MODEL_SOURCE = {
  repo: 'https://github.com/xai-org/x-algorithm',
  file: 'home-mixer/params/param.rs',
  defaults: 'home-mixer/scorers/value_model.rs',
  readme: 'https://github.com/xai-org/x-algorithm#readme',
  retrieved: '2026-11-18',
  license: 'Apache-2.0',
} as const;

/** All weights in param.rs, highest first. */
export const ACTION_WEIGHTS: readonly ActionWeight[] = [
  { key: 'share_via_copy_link', label: 'share via copy link', weight: 20.0, group: 'engagement', reader: 'copies the post link' },
  { key: 'reply', label: 'reply', weight: 5.0, group: 'engagement', reader: 'writes a reply' },
  { key: 'quote', label: 'quote', weight: 5.0, group: 'engagement', reader: 'quote posts' },
  { key: 'share_via_dm', label: 'share via DM', weight: 5.0, group: 'engagement', reader: 'sends the post in a direct message' },
  { key: 'follow_author', label: 'follow author', weight: 4.0, group: 'author', reader: 'follows the author' },
  { key: 'share', label: 'share', weight: 2.118, group: 'engagement', reader: 'uses the share action' },
  { key: 'retweet', label: 'repost', weight: 1.0, group: 'engagement', reader: 'reposts' },
  { key: 'favorite', label: 'like', weight: 0.708, group: 'engagement', reader: 'likes' },
  { key: 'cont_click_dwell_time', label: 'click dwell time (continuous)', weight: 0.385, group: 'attention', reader: 'time on the post after opening it' },
  { key: 'click', label: 'post click', weight: 0.274, group: 'click', reader: 'opens the post' },
  { key: 'open_link', label: 'open link', weight: 0.2, group: 'click', reader: 'opens a link in the post' },
  { key: 'photo_expand', label: 'photo expand', weight: 0.05, group: 'click', reader: 'expands an image' },
  { key: 'quoted_click', label: 'quoted post click', weight: 0.05, group: 'click', reader: 'opens the quoted post' },
  { key: 'dwell', label: 'dwell', weight: 0.05, group: 'attention', reader: 'dwells on the post in the feed' },
  { key: 'post_unexplored', label: 'post unexplored', weight: 0.015, group: 'attention', reader: '(name only)' },
  { key: 'cont_dwell_time', label: 'dwell time (continuous)', weight: 0.0075, group: 'attention', reader: 'time on the post in the feed' },
  { key: 'video_open', label: 'video open', weight: 0.0, group: 'click', reader: 'opens a video' },
  { key: 'profile_click', label: 'profile click', weight: 0.0, group: 'click', reader: 'opens the author profile' },
  { key: 'vqv', label: 'video quality view', weight: 0.0, group: 'attention', reader: 'video quality view' },
  { key: 'quoted_vqv', label: 'quoted video quality view', weight: 0.0, group: 'attention', reader: 'quality view of the quoted video' },
  { key: 'post_video', label: 'post video', weight: 0.0, group: 'attention', reader: '(name only)' },
  { key: 'grok_analyze', label: 'Grok analyze', weight: 0.0, group: 'click', reader: 'asks Grok about the post' },
  { key: 'not_dwelled', label: 'not dwelled', weight: -0.02, group: 'negative', reader: 'does not dwell on the post' },
  { key: 'block_author', label: 'block author', weight: -31.2, group: 'negative', reader: 'blocks the author' },
  { key: 'not_interested', label: 'not interested', weight: -53.07, group: 'negative', reader: 'marks not interested' },
  { key: 'mute_author', label: 'mute author', weight: -58.8, group: 'negative', reader: 'mutes the author' },
  { key: 'report', label: 'report', weight: -234.0, group: 'negative', reader: 'reports the post' },
];

/**
 * Boosts in param.rs. xai-value-model/weights.rs applies the reply boost
 * to the reply weight of a candidate post when the viewer and the post's
 * author follow each other: for such a viewer, P(reply) on that post is
 * weighted 5.0 + 15.0.
 */
export const BOOSTS = {
  bidirectional_follow_reply_weight_boost: 15.0,
  bidirectional_follow_dwell_weight_boost: 0.0,
} as const;

/**
 * Adjustments named in the README and what the public defaults say about
 * them. The README text is a close paraphrase; the status column is from
 * home-mixer/scorers/value_model.rs and param.rs on 2026-11-18.
 */
export const ADJUSTMENTS = [
  {
    name: 'Author diversity',
    readme: "each post after an author's first is multiplied by a decaying factor, down to a floor",
    status: 'OFF in the public defaults: value_model.rs sets enable_author_diversity: false, decay 1.0, floor 1.0.',
    meaning: 'Spacing your posts is still a good habit for your readers and your reply window, but do not claim the code penalises stacking.',
  },
  {
    name: 'Out-of-network discount',
    readme: 'posts from accounts the viewer does not follow are multiplied by a factor below 1, as are replies and reposts from accounts the viewer does follow',
    status: 'The factor for non-followed authors is applied in xai-value-model/scoring.rs (effective_oon_weight); its value is a runtime parameter not located in the public params. Rescoring in-network replies and reposts is OFF by default (oon_rescore_in_network_replies_retweets: false).',
    meaning: 'Reaching people who do not follow you is discounted. For your own followers, replies and reposts are not discounted in the public defaults.',
  },
  {
    name: 'New-author boost (cold start)',
    readme: 'posts from authors whose impressions are below a threshold are lifted toward a target position',
    status: 'Parameters in param.rs: cold_start_slot_min 15, cold_start_slot_max 16, cold_start_follower_cap 50000, cold_start_max_post_age_secs 7200, low_impressions_max_boost_position_ratio 0.97. Logic in home-mixer/scorers/author_cold_start.rs.',
    meaning: 'A small account with a fresh post can be placed into the feed. It is not a reason to create accounts; that breaks the rules.',
  },
  {
    name: 'Age filter',
    readme: 'posts older than 48 hours are removed before scoring',
    status: 'AgeFilter in home-mixer/filters/age_filter.rs takes the duration from the caller; the README states 48 hours.',
    meaning: 'A post has a two-day window at most. Replies and thread additions belong in the first hours.',
  },
  {
    name: 'VMRanker',
    readme: 'reorders results using a determinantal point process over embeddings',
    status: 'Separate service in vm-ranker/; not reproduced here.',
    meaning: 'Similar posts in one feed load are spread apart. Posting the same idea twice in a row buys nothing.',
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
