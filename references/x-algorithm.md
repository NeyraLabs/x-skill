# Fact sheet: what xai-org/x-algorithm says

Source repository: https://github.com/xai-org/x-algorithm, licence Apache-2.0. Read on 2026-11-18. Everything below is either a close paraphrase of the README or a value copied from a source file, with the path given. The repository may change; re-check the paths before quoting.

## Pipeline (README)

- Two candidate sources: in-network (`thunder/`, recent posts from followed accounts) and out-of-network (`phoenix/` retrieval, `simclusters/`, and a shared popular-posts list).
- Request path in `home-mixer/`: query hydration (recent engagements, follows, blocks, mutes, muted keywords, seen posts) → candidate sources in parallel → candidate hydration (text, media, author labels, language, engagement counts) → pre-scoring filters → scoring (PhoenixScorer, RankingScorer, VMRanker) → top-K selection → post-selection filters (visibility, ancillary visibility, conversation dedup).
- "Ranking decides the order. Visibility filtering decides whether a post can be shown at all."

## Predicted actions (README)

Engagement: favorite, reply, repost, quote, share, share via DM, share via copy link. Clicks: post, profile, link, photo expand, video open, quoted post. Attention: video quality view, dwell, dwell time, click dwell time, video continuation seconds, profile visit seconds. Author: follow author. Negative: not interested, mute author, block author, report, not dwelled.

## Scoring formula (README)

`Final Score = Σ (weight_i × P(action_i))`. Positive actions have positive weights, negative actions negative weights. Weights live in `home-mixer/params/param.rs`; the arithmetic is in `xai-value-model/scoring.rs`. The README notes the weights scale predicted probabilities, not raw engagement counts.

## Default weights (`home-mixer/params/param.rs`, prefix `rust_home_mixer_`, suffix `_weight`)

| parameter | value |
| --- | ---: |
| share_via_copy_link | 20.0 |
| reply | 5.0 |
| quote | 5.0 |
| share_via_dm | 5.0 |
| follow_author | 4.0 |
| share | 2.118 |
| retweet | 1.0 |
| favorite | 0.708 |
| cont_click_dwell_time | 0.385 |
| click | 0.274 |
| open_link | 0.2 |
| photo_expand | 0.05 |
| quoted_click | 0.05 |
| dwell | 0.05 |
| post_unexplored | 0.015 |
| cont_dwell_time | 0.0075 |
| video_open | 0.0 |
| profile_click | 0.0 |
| vqv | 0.0 |
| quoted_vqv | 0.0 |
| post_video | 0.0 |
| grok_analyze | 0.0 |
| not_dwelled | −0.02 |
| block_author | −31.2 |
| not_interested | −53.07 |
| mute_author | −58.8 |
| report | −234.0 |

Boosts in the same file: `bidirectional_follow_reply_weight_boost` = 15.0, `bidirectional_follow_dwell_weight_boost` = 0.0.

Other values in the same file: `cold_start_max_post_age_secs` = 7200; `new_user_min_engagement_filter_max_account_age_secs` = 1800; `new_user_soft_nsfw_filter_max_account_age_secs` = 604800.

## Adjustments (README; numeric values not found in `param.rs` or `xai-value-model/weights.rs`)

- Author diversity: "each post after an author's first is multiplied by a decaying factor, down to a floor". `weights.rs` declares `enable_author_diversity`, `author_diversity_decay`, `author_diversity_floor` without values.
- Out-of-network discount: posts from accounts the viewer does not follow are multiplied by a factor below 1, as are replies and reposts from followed accounts.
- New-author boost: posts from authors whose impressions are below a threshold are lifted toward a target position.
- VMRanker (`vm-ranker/`): reorders results with a determinantal point process over embeddings.

## Filters (README; `home-mixer/filters/`)

Pre-scoring, about 20 filters, including `AgeFilter` (posts older than 48 hours; the duration is passed in by the caller in `age_filter.rs`), `AuthorSocialgraphFilter` (blocked or muted), `MutedKeywordFilter`, duplicate and already-seen filters, and the viewer's own posts. Post-selection: `VFFilter` (visibility said drop), `AncillaryVFFilter` (parent, quoted or reposted post dropped), `DedupConversationFilter` (extra branches of one conversation).

Visibility filtering returns one of ALLOW, NOTICE, INTERSTITIAL, DROP per post and viewer; the first rule that says drop ends evaluation; some rules apply only to out-of-network recommendations and can only drop.

## Withheld

The README says some components are withheld to reduce gaming, including Grok prompts and some botmaker rules.

## What is not in this sheet

The Phoenix model itself, the retrieval indexes, the embedding spaces, experiment overrides and any per-market tuning. Do not infer them.
