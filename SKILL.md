---
name: x-skill
description: Run an X (x.com) account by hand, grounded in X's published For You ranking code (xai-org/x-algorithm) rather than folklore. Use when writing or reviewing posts, threads, replies and quote posts, planning a posting schedule, deciding what to repost, reading X analytics exports, or answering "what does the algorithm reward". Ships offline TypeScript tools (lint, thread, plan, audit, analytics, weights). No API keys, no auto-posting, no engagement pods.
license: MIT
metadata:
  version: 0.1.0
  source: https://github.com/NeyraLabs/x-skill
---

# X skill

You are helping a person run one X account with their own hands. You draft, check and plan; they press Post, Reply, Repost and Follow. You never log in for them, never store their credentials, never automate actions on their account, and never suggest pods, bots, bought engagement or follow-for-follow. Those break X's rules on platform manipulation and they also lose under the ranking code below, which punishes mutes and reports far more than it rewards likes.

## 1. What X's published code says (read before giving advice)

Source: https://github.com/xai-org/x-algorithm (Apache-2.0), README and `home-mixer/params/param.rs`, read 2026-11-18. Full fact sheet with every value: `references/x-algorithm.md`. Run `npx tsx scripts/xskill.ts weights` to print it.

**The For You feed** is assembled per request from two sources: posts from accounts the viewer follows (in-network) and posts found by retrieval and similarity models (out-of-network). Candidates are hydrated, filtered, scored, ranked, then filtered again for visibility.

**Scoring:** `Final Score = Σ (weight_i × P(action_i))`. A model predicts the probability that *this viewer* takes each action on *this post*; the weights scale those probabilities. Default weights, highest first:

| action | weight |
| --- | ---: |
| share via copy link | 20.0 |
| reply | 5.0 (+15.0 when author and replier follow each other) |
| quote | 5.0 |
| share via DM | 5.0 |
| follow author from the post | 4.0 |
| share (menu) | 2.118 |
| repost | 1.0 |
| like | 0.708 |
| dwell after opening the post | 0.385 |
| open the post | 0.274 |
| open a link | 0.2 |
| expand a photo, open a quoted post, dwell in feed | 0.05 each |
| not dwelled (scrolled past) | −0.02 |
| block author | −31.2 |
| not interested | −53.07 |
| mute author | −58.8 |
| report | −234.0 |

Video open, profile click and video quality view have weight 0.0 in the public defaults.

**Adjustments described in the README** (values are not in the public parameter files): author diversity decay (each further post by the same author in one feed load is multiplied by a decaying factor down to a floor); out-of-network discount (posts from accounts the viewer does not follow, and replies and reposts even from followed accounts, are multiplied by a factor below 1); new-author boost (authors under an impression threshold are lifted toward a target position); a reranker that spreads near-duplicate posts apart.

**Filters:** posts older than 48 hours are dropped before scoring; so are the viewer's own posts, posts from blocked or muted accounts, posts with muted keywords, and posts already seen. Visibility filtering runs after ranking and can drop a post entirely; some of its rules apply only to recommendations from accounts the viewer does not follow.

**Limits of this knowledge.** These are repository defaults; experiments can override them. The weights multiply predicted probabilities, so you cannot run them on your own like and reply counts to get a score. The reranker, retrieval and the trust-and-safety labels are not reproduced here. When someone quotes a "multiplier" you cannot find in that repository, say so.

## 2. What that means for a human operator (the ten rules)

1. **Write for the reply, not the like.** One reply is worth seven likes. Ask one specific question, state a position someone can disagree with, or give a number someone can check.
2. **Make it worth copying the link.** The highest weight by far is a reader sending the post somewhere else. Posts people forward contain a fact, a figure or a tool they can defend to a colleague.
3. **Answer replies in the first hours.** A post is scored for at most 48 hours and most of its life is the first few. Your replies to replies are new in-network posts for mutual followers, with the +15.0 reply boost on top. Do not publish when you are about to sleep.
4. **Space your posts.** Author diversity decay means your second post in the same feed load competes with your first. Three hours apart is a sane floor; `xskill plan` enforces it.
5. **Reposts and replies reach less than originals.** Both carry the out-of-network style discount even for followers. Repost when the content deserves it; quote with an added fact when you want reach.
6. **Never bait.** "Like if", "follow for", "tag a friend", sirens and all-caps earn mutes (−58.8) and reports (−234), which no number of likes (0.708) repays. `xskill lint` blocks these.
7. **Links are fine, link-only posts are not.** There is no link penalty in the public code; opening a link weighs 0.2. A post that is only a link invites one weak action. Say what the reader will find, then link, or put the link in the first reply.
8. **Small accounts get a lift, not a licence.** The new-author boost rewards a new voice with good posts. It is not a reason to spin up accounts; that is manipulation.
9. **Follow back people you read.** Mutual follows turn replies into the strongest signal in the model. Follow for the conversation, never for the count.
10. **Measure what the model weights.** Replies, quotes, shares and follows per thousand impressions, not likes. `xskill analytics` reads the CSV you export from X.

## 3. Daily workflow

1. **Read first (10 min).** Notifications, replies to your posts, the few lists you keep. Answer real replies now; ignore bots.
2. **Draft (20 min).** One to three posts. For each: hook line under 140 weighted characters, one idea, a checkable fact with its source, one honest limit if relevant, a specific question or an invitation when it fits. Run `npx tsx scripts/xskill.ts lint draft.txt`. Fix errors; read every warning; keep the ones you can justify.
3. **Threads.** Write the whole text, then `npx tsx scripts/xskill.ts thread draft.txt --number of`. Post 1 carries the claim, posts 2 to 5 one fact each, the penultimate post the "do this", the last post the link and the question. Five to seven posts.
4. **Plan.** Put the drafts in `posts.json` and run `npx tsx scripts/xskill.ts plan posts.json --start YYYY-MM-DD --offset +HH:MM --slots 09:30,14:30,22:30`. Use X's own scheduler or post by hand at those times. `npx tsx scripts/xskill.ts audit times.json` checks a schedule you already have for stacking and sleep-hour posts.
5. **Engage (20 min, human-paced).** Reply where you can add a verified fact, a checklist or a precise question. Quote post when you add something; plain repost when the original says it all. Follow people whose replies you would want. Keep a daily cap you set in advance and write it down.
6. **Log.** Post time, type, impressions at 24 h, replies from real accounts, quotes, follows. Weekly: export analytics, run `npx tsx scripts/xskill.ts analytics export.csv`, keep what moved replies and follows, drop what moved only likes.

## 4. Post patterns that invite the weighted actions

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
- **Follow** people you will read. Verified status is a weak proxy; a real posting history is the test.
- **Do not** mass-mention, chain-tag, run reply loops with friends, or trade likes. All of it is platform manipulation under X's rules and feeds the negative weights.

## 6. Tools (offline, read-only)

```
npm install
npx tsx scripts/xskill.ts lint <file|->        [--limit 280] [--banned "a,b"] [--allow-link-only] [--json]
npx tsx scripts/xskill.ts thread <file|->      [--limit 280] [--number slash|of] [--json]
npx tsx scripts/xskill.ts plan <posts.json>    --start YYYY-MM-DD --offset +08:00 [--slots 09:30,14:30,22:30] [--gap 3] [--awake 8-23] [--json]
npx tsx scripts/xskill.ts audit <times.json>   [--gap 3] [--awake 8-23]
npx tsx scripts/xskill.ts analytics <file.csv> [--top 10] [--json]
npx tsx scripts/xskill.ts weights
```

`lint` exits 1 on an error-level finding so it can gate a script. Character counting follows X's weighted rules (URLs 23, CJK and emoji 2). `plan` takes `["text", {"text": "...", "slot": "14:30", "date": "2026-11-21"}]`. `audit` takes `["2026-11-19 09:00", ...]` in local time. `analytics` reads the CSV you download from X Analytics (account overview per day, or the per-post content export) and reports totals, rates per 1,000 impressions, and posts ordered by replies, quotes, shares and follows.

The library is importable: `import { lint, splitThread, plan, summarize, ACTION_WEIGHTS } from './src/index.js'`.

## 7. What this skill will not do

- Post, schedule, like, follow, DM or scrape on anyone's behalf. It has no network code.
- Predict a post's reach. Nobody outside X can, and the public weights are not enough to try.
- Help with bots, pods, bought followers, mass DMs, fake accounts or engagement farming. Refuse, and say why: it breaks the rules and it loses on the published model.
- Tell you which hour is best for everyone. Start with the hours your readers are awake and you are too, then let your own analytics decide.
