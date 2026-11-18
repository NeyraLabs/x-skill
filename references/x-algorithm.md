# Fact sheet: what xai-org/x-algorithm says

Source repository: https://github.com/xai-org/x-algorithm, licence Apache-2.0. Read on 2026-11-18. Everything below is a close paraphrase of the README or a value copied from a source file, with the path given. The repository changes; re-check the paths before quoting.

## Pipeline (README)

- Two candidate sources: in-network (`thunder/`, recent posts from followed accounts) and out-of-network (`phoenix/` retrieval, `simclusters/`, and a shared popular-posts list).
- Request path in `home-mixer/`: query hydration (recent engagements, follows, blocks, mutes, muted keywords, seen posts) → candidate sources in parallel → candidate hydration (text, media, author labels, language, engagement counts) → pre-scoring filters → scoring (PhoenixScorer, RankingScorer, VMRanker) → top-K selection → post-selection filters (visibility, ancillary visibility, conversation dedup).
- "Ranking decides the order. Visibility filtering decides whether a post can be shown at all."

## Predicted actions (README)

Engagement: favorite, reply, repost, quote, share, share via DM, share via copy link. Clicks: post, profile, link, photo expand, video open, quoted post. Attention: video quality view, dwell, dwell time, click dwell time, video continuation seconds, profile visit seconds. Author: follow author. Negative: not interested, mute author, block author, report, not dwelled.

## Scoring formula (README and `home-mixer/params/param.rs`)

`Final Score = Σ (weight_i × P(action_i))`. Positive actions have positive weights, negative actions negative weights. Weights live in `home-mixer/params/param.rs`; the arithmetic is in `xai-value-model/scoring.rs`.

The comment above the weights in `param.rs` says, in short: the weights reflect both how much an action is valued and the typical propensity of that action across X (negative feedback is rare); each weight multiplies the predicted probability of the action, not raw counts; reading the ratios as count equivalences ("one report cancels 468 likes") is a common misinterpretation; a report is weighted high because its baseline probability is more than 1000x lower than a like's; and mass blocking or reporting by bad actors is limited because predictions are personalised and only actions on posts served in the Home timeline count.

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

Boosts in the same file: `bidirectional_follow_reply_weight_boost` = 15.0, `bidirectional_follow_dwell_weight_boost` = 0.0. In `xai-value-model/weights.rs`, `reply_weight_for` returns `reply + bidirectional_follow_reply_weight_boost` when the candidate is "bidirectional boost eligible" (the viewer and the post's author follow each other); otherwise `reply`.

## Adjustments (README) and their defaults (`home-mixer/scorers/value_model.rs`, `param.rs`)

- Author diversity. README: "each post after an author's first is multiplied by a decaying factor, down to a floor". Defaults: `enable_author_diversity: false`, `author_diversity_decay: 1.0`, `author_diversity_floor: 1.0`. Off.
- Out-of-network discount. README: "posts from accounts the viewer does not follow are multiplied by a factor below 1, as are replies and reposts from accounts the viewer does follow". Code: `scoring.rs` applies `effective_oon_weight` when `oon_applies`; for in-network replies and reposts that depends on `oon_rescore_in_network_replies_retweets`, which defaults to `false`. The numeric out-of-network factor is a runtime parameter not located in the public params.
- New-author boost (cold start). README: "posts from authors whose impressions are below a threshold are lifted toward a target position". `param.rs`: `cold_start_slot_min` 15, `cold_start_slot_max` 16, `cold_start_follower_cap` 50000, `cold_start_max_post_age_secs` 7200, `low_impressions_max_boost_position_ratio` 0.97. Logic in `home-mixer/scorers/author_cold_start.rs` (not summarised here).
- VMRanker (`vm-ranker/`): reorders results with a determinantal point process over embeddings.

Other values in `param.rs`: `new_user_min_engagement_filter_max_account_age_secs` 1800; `new_user_soft_nsfw_filter_max_account_age_secs` 604800.

## Filters (README; `home-mixer/filters/`)

Pre-scoring, about 20 filters, including `AgeFilter` (the README says posts older than 48 hours; `age_filter.rs` takes the duration from the caller), `AuthorSocialgraphFilter` (blocked or muted), `MutedKeywordFilter`, duplicate and already-seen filters, and the viewer's own posts. Post-selection: `VFFilter` (visibility said drop), `AncillaryVFFilter` (parent, quoted or reposted post dropped), `DedupConversationFilter` (extra branches of one conversation).

Visibility filtering returns one of ALLOW, NOTICE, INTERSTITIAL, DROP per post and viewer; the first rule that says drop ends evaluation; some rules apply only to out-of-network recommendations and can only drop.

## Withheld

The README lists components withheld to reduce gaming, including the Grox prompts (the j2 files with the LLM prompts used in Grox) and some botmaker rules.

## What is not in this sheet

The Phoenix prediction model, the retrieval indexes, the embedding spaces, experiment overrides and any per-market tuning. Do not infer them.
