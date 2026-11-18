# x-skill

An [Agent Skill](https://agentskills.io) for running an X (x.com) account by hand, grounded in X's published For You ranking code instead of folklore. Comes with small offline TypeScript tools: a post linter, a thread splitter, a schedule planner, a schedule auditor, an analytics-CSV reader and a printout of the published weights.

It does not post, schedule, like, follow, DM or scrape. It has no network code and asks for no credentials. You read its output and act on your own account.

## Why

X open-sourced the code behind the For You feed ([xai-org/x-algorithm](https://github.com/xai-org/x-algorithm), Apache-2.0). The score is a weighted sum of predicted actions and the default weights are in the repository: copy-link 20.0, reply and quote 5.0, follow 4.0, like 0.708, mute −58.8, report −234.0. The same file warns that the weights multiply predicted probabilities, not counts, and that "one report cancels 468 likes" is a misreading. Most "algorithm tips" on X get both halves wrong. This skill turns what the code says, including its caveats, into working habits and checks drafts against them.

The fact sheet with every value, its file path and the retrieval date is [`references/x-algorithm.md`](references/x-algorithm.md). It also records which README adjustments are switched off in the public defaults (author-diversity decay, for one).

## Install the skill

Agent Skills are a folder with a `SKILL.md`. Copy this repository where your agent looks for skills, for example for Claude Code:

```sh
git clone https://github.com/NeyraLabs/x-skill ~/.claude/skills/x-skill
```

Or with the skills CLI, if you use it:

```sh
npx skills add NeyraLabs/x-skill
```

The agent reads [`SKILL.md`](SKILL.md) when a task is about X posts, threads, replies, scheduling or analytics.

## Use the tools

Requires Node 22 or newer. Run from the cloned folder. `npm run xskill -- <command>` works too; the `--` keeps npm from eating the flags.

```sh
npm install
npx tsx scripts/xskill.ts lint draft.txt
npx tsx scripts/xskill.ts thread draft.txt --number of
npx tsx scripts/xskill.ts plan posts.json --start 2026-11-19 --offset +08:00 --slots 09:30,14:30,22:30
npx tsx scripts/xskill.ts audit times.json
npx tsx scripts/xskill.ts analytics account_overview_analytics.csv
npx tsx scripts/xskill.ts weights
```

`lint` output, for example:

```
length 62/280 (218 left), 1 url
WARN  link-only: The post is a link with fewer than 40 characters of text.
      why: There is no link penalty in the public code (open_link has a positive weight), but a link-only post invites one action and no conversation. Say what the reader will find, or put the link in a reply.
ERROR bait: Engagement bait detected ("like if", "follow for more", "tag a friend", "comment below" and similar).
      why: X's rules name engagement farming as platform manipulation. In the model, bait invites the actions with negative weights (not interested, mute, report) from the readers you want to keep.
```

Every finding says why: a published weight, an X rule, or plain reader behaviour, named as such. `lint` exits 1 on an error so you can use it as a gate, 2 on a usage error. Character counting follows X's weighted rules: URLs count 23, CJK and emoji count 2.

As a library:

```ts
import { lint, splitThread, plan, summarize, parseCsv, ACTION_WEIGHTS } from './src/index.js';
```

## What is in the box

| path | what |
| --- | --- |
| `SKILL.md` | the skill: what the code says, ten operator rules, daily workflow, post patterns, reply and repost policy, what the skill refuses |
| `references/x-algorithm.md` | fact sheet with every value and its file path |
| `src/count.ts` | weighted character counting |
| `src/lint.ts` | draft checks, each tied to a weight or a platform rule |
| `src/thread.ts` | paragraph → sentence → word packing, URLs kept whole, optional numbering |
| `src/plan.ts` | slot planner with a minimum gap and awake hours (reply window); schedule auditor |
| `src/args.ts` | argv parsing |
| `src/analytics.ts` | CSV parser and summary for X's analytics exports |
| `src/value-model.ts` | the published weights as data |
| `scripts/xskill.ts` | the CLI |
| `test/` | 41 tests, `node:test` |

## Principles

- Facts from primary pages, with path and date. If a number is not in the repository, the skill says it is not.
- Human in the loop for every action on the account.
- No manipulation: no pods, bots, bought engagement, mass mentions or fake accounts. It breaks X's rules, and the feed is built to predict the mutes and reports it earns.
- Honest limits over confident guesses.

## Contributing

Open an issue with the source for any factual change (file path in the x-algorithm repository and the date you read it). Pull requests need `npm run check` green. Tooling changes that add network calls or credential handling will not be merged.

## Licence

MIT. The ranking facts are from xai-org/x-algorithm, Apache-2.0; see its licence for that code.
