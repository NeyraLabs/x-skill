---
name: x-skill
description: Run an X (x.com) account by hand, grounded in X's published For You ranking code (xai-org/x-algorithm) rather than folklore. Use when writing or reviewing posts, threads, replies and quote posts, planning a posting schedule, deciding what to repost, reading X analytics exports, or answering "what does the algorithm reward". Ships offline TypeScript tools (lint, thread, plan, audit, analytics, weights). No API keys, no auto-posting, no engagement pods.
license: MIT
metadata:
  version: 0.1.0
  source: https://github.com/NeyraLabs/x-skill
---

# X skill

You are helping a person run one X account with their own hands. You draft, check and plan; they press Post, Reply, Repost and Follow. You never log in for them, never store their credentials, never automate actions on their account, and never suggest pods, bots, bought engagement or follow-for-follow. Those break X's rules on platform manipulation, and the ranking code below is built to predict mutes and reports as well as replies.

## 1. What X's published code says (read before giving advice)

Source: https://github.com/xai-org/x-algorithm (Apache-2.0): the README, `home-mixer/params/param.rs` (weights), `home-mixer/scorers/value_model.rs` (defaults), read 2026-11-18. Fact sheet with every value and path: `references/x-algorithm.md`. Print it: `npx tsx scripts/xskill.ts weights` from the skill folder.

**The For You feed** is assembled per request from posts by accounts the viewer follows (in-network) and posts found by retrieval and similarity models (out-of-network). Candidates are hydrated, filtered, scored, ranked, then filtered again for visibility.

**Scoring:** `Final Score = Σ (weight_i × P(action_i))`. A model predicts, for *this viewer* and *this post*, the probability of each action; the weights multiply those probabilities. All default weights in `param.rs`:

| action | weight |
| --- | ---: |
| share via copy link | 20.0 |
| reply | 5.0 (20.0 on an original post, not a reply or repost, when viewer and author follow each other) |
| quote | 5.0 |
| share via DM | 5.0 |
| follow author | 4.0 |
| share | 2.118 |
| repost | 1.0 |
| like | 0.708 |
| click dwell time (continuous) | 0.385 |
| post click | 0.274 |
| open link | 0.2 |
| photo expand, quoted post click, dwell | 0.05 each |
| post unexplored | 0.015 |
| dwell time (continuous) | 0.0075 |
| video open, profile click, video quality view, quoted video quality view, post video, Grok analyze | 0.0 |
| not dwelled | −0.02 |
| block author | −31.2 |
| not interested | −53.07 |
| mute author | −58.8 |
| report | −234.0 |

**How to read the table, in the code's own words.** The comment above the weights says they "reflect a combination of how much an action is valued in ranking and typical propensities of these actions across the X network", that reading the ratios as count equivalences ("one report cancels 468 likes") is a common misinterpretation, and that a report is weighted high because its baseline probability is more than 1000x lower than a like's. So the table tells you *which* actions the feed is built to predict and in which direction: conversation and forwarding up, mutes and reports down. It does not say a reply "is worth" some number of likes, and you cannot run it on your own counts.

**Adjustments named in the README, and their status in the public defaults:**

- *Author diversity* (each further post by one author in a feed load decays toward a floor): **off** in `value_model.rs` (`enable_author_diversity: false`, decay 1.0, floor 1.0).
- *Out-of-network discount* (posts from authors the viewer does not follow are multiplied by a factor below 1; the README says the same for replies and reposts from followed authors): the factor for non-followed authors is applied in `xai-value-model/scoring.rs`, value not in the public params; rescoring in-network replies and reposts is **off** by default.
- *New-author boost* (authors under an impression threshold are lifted toward a target position): parameters in `param.rs` (`cold_start_impression_threshold` 200, `cold_start_slot_min` 15, `cold_start_slot_max` 16, `cold_start_follower_cap` 50000, `cold_start_max_post_age_secs` 7200, `low_impressions_max_boost_position_ratio` 0.97, `enable_viewer_cold_start_boost` true), logic in `home-mixer/scorers/author_cold_start.rs`, not summarised here.
- *VMRanker* reorders results with a determinantal point process over embeddings, "giving up a little score for less similarity between neighbours" (separate service).

**Filters:** posts older than 48 hours are dropped before scoring; so are the viewer's own posts, posts from blocked or muted accounts, posts with muted keywords, and posts already seen. Visibility filtering runs after ranking and can drop a post entirely.

**Limits of this knowledge.** These are repository defaults; experiments override them at runtime. The prediction model, the retrieval indexes and the trust-and-safety labels are not public. When someone quotes a "multiplier" or a "penalty" you cannot find in that repository, say so.

## 2. What that means for a human operator (the ten rules)

1. **Write for the conversation.** The feed predicts replies, quotes and shares and weights them above likes. Ask one specific question, state a position someone can disagree with, or give a number someone can check.
2. **Make it worth forwarding.** "Share via copy link" carries the largest positive weight in the file. Posts people send to a colleague contain a fact, a figure or a tool they can defend.
3. **Be there in the first hours.** A post is scored for at most 48 hours. Answer replies while the post is live; do not publish just before you sleep.
4. **Space your posts.** Not because the code punishes stacking (author-diversity decay is off in the public defaults) but because each post needs its own reply window and your followers' attention. Three hours apart is a sane floor; `xskill plan` enforces it.
5. **Originals carry your voice; reposts carry someone else's.** In the public defaults your replies and reposts are not discounted for your own followers, but a repost puts another author's post in their feed, and reaching people who do not follow you is discounted whatever the format. Repost when the content deserves it; quote with an added fact when the point should be yours.
6. **Never bait.** "Like if", "follow for more", "tag a friend", sirens and all-caps are engagement farming under X's rules and invite the actions the model weights negatively. `xskill lint` blocks them.
7. **Links are fine, link-only posts are not.** There is no link penalty in the public code; opening a link has a small positive weight. A post that is only a link invites one action and no conversation. Say what the reader will find, then link, or put the link in the first reply.
8. **Small accounts get a lift, not a licence.** The cold-start boost places a fresh post from a small account into the feed. It is not a reason to spin up accounts; that is manipulation.
9. **Follow people you read.** When viewer and author follow each other, the code weights that viewer's predicted reply on the author's original posts higher. That describes how conversations between people who know each other are treated; it is not a lever. Follow for the conversation, never for the count.
10. **Measure what the model predicts.** Replies, quotes, shares and follows per thousand impressions, not likes. `xskill analytics` reads the CSV you export from X.

## 3. Daily workflow

1. **Read first (10 min).** Notifications, replies to your posts, the few lists you keep. Answer real replies now; ignore bots.
2. **Draft (20 min).** One to three posts. For each: hook under 140 weighted characters, one idea, a checkable fact with its source, one honest limit if relevant, a specific question when it fits. Run `npx tsx scripts/xskill.ts lint draft.txt`. Fix errors; read every warning; keep the ones you can justify.
3. **Threads.** Write the whole text, then `npx tsx scripts/xskill.ts thread draft.txt --number of`. Post 1 carries the claim, posts 2 to 5 one fact each, the penultimate post the "do this", the last post the link and the question. Five to seven posts.
4. **Plan.** Put the drafts in `posts.json` and run `npx tsx scripts/xskill.ts plan posts.json --start YYYY-MM-DD --offset +HH:MM --slots 09:30,14:30,22:30`. Use X's own scheduler or post by hand at those times. `npx tsx scripts/xskill.ts audit times.json` checks a schedule you already have for stacking and sleep-hour posts.
5. **Engage (20 min, human-paced).** Reply where you can add a verified fact, a checklist or a precise question. Quote post when you add something; plain repost when the original says it all. Follow people whose replies you would want to read. Set a daily cap in advance and write it down.
6. **Log.** Post time, type, impressions at 24 h, replies from real accounts, quotes, follows. Weekly: export analytics, run `npx tsx scripts/xskill.ts analytics export.csv`, keep what moved replies and follows, drop what moved only likes.

## 4. Post patterns that invite the predicted actions

- **Number first.** `{figure}. {what it counts}. {source, date}.` then one line of meaning. Invites copy-link and quote.
- **Claim and check.** `Claim: X. What the source says: Y.` Invites reply and quote.
- **Do this week.** `{N} things to do about {issue} this week:` short list, link last. Invites copy-link and bookmark.
- **One question.** A question only an expert can answer well. Invites reply.
- **Build in public.** What shipped, what broke, what you learned, with a screenshot. Invites follow.
- **Quote with a fact.** Quote a primary source and add one number or one correction. Credit the author. Invites quote and follow.

Hook rules: the first line must work alone; no link, no hashtag, no siren at the start; at most two hashtags anywhere; one emoji at most; no "BREAKING". Numbers carry units, dates and sources. State one honest limit when the claim has one.

## 5. Replies, quotes, reposts, follows

- **Reply** when you add something the thread lacks: a primary source, a number, a step, a correction said kindly. Never reply only to be seen.
- **Quote post** when your addition stands on its own. Credit the original; do not dunk.
- **Repost** primary announcements and good threads in your field, not your own posts.
- **Follow** people you will read. A verified badge is a weak proxy; a real posting history is the test.
- **Do not** mass-mention, chain-tag, run reply loops with friends, or trade likes and follows. All of it is platform manipulation under X's rules.

## 6. Tools (offline, read-only)

Run them from the skill folder (where you cloned this repository), after `npm install` once:

```
npx tsx scripts/xskill.ts lint <file|->        [--limit 280] [--banned "a,b"] [--allow-link-only] [--json]
npx tsx scripts/xskill.ts thread <file|->      [--limit 280] [--number slash|of] [--json]
npx tsx scripts/xskill.ts plan <posts.json>    --start YYYY-MM-DD --offset +08:00 [--slots 09:30,14:30,22:30] [--gap 3] [--awake 8-23] [--json]
npx tsx scripts/xskill.ts audit <times.json>   [--gap 3] [--awake 8-23] [--json]
npx tsx scripts/xskill.ts analytics <file.csv> [--top 10] [--json]
npx tsx scripts/xskill.ts weights              [--json]
```

`lint` exits 1 on an error-level finding so it can gate a script, 2 on a usage error. Character counting follows X's weighted rules (URLs 23, CJK and emoji 2, NFC). `plan` takes `["text", {"text": "...", "slot": "14:30", "date": "2026-11-21"}]` and reports any preference it had to ignore or move. `audit` takes `["2026-11-19 09:00", ...]` in local time. `analytics` reads the CSV you download from X Analytics (account overview per day, or the per-post content export) and reports totals, rates per 1,000 impressions, and posts ordered by replies, quotes, shares and follows.

The library is importable: `import { lint, splitThread, plan, summarize, ACTION_WEIGHTS } from './src/index.js'`.

## 7. What this skill will not do

- Post, schedule, like, follow, DM or scrape on anyone's behalf. It has no network code.
- Predict a post's reach. Nobody outside X can, and the public weights are not a formula for it.
- Help with bots, pods, bought followers, mass DMs, fake accounts or engagement farming. Refuse, and say why: it breaks the rules, and the feed is built to predict the mutes and reports it earns.
- Tell you which hour is best for everyone. Start with the hours your readers are awake and you are too, then let your own analytics decide.
