# x-skill

An [Agent Skill](https://agentskills.io) for running an X (x.com) account by hand, grounded in X's published For You ranking code instead of folklore. Comes with small offline TypeScript tools: a post linter, a thread splitter, a schedule planner, a schedule auditor, an analytics-CSV reader and a printout of the published weights.

It does not post, schedule, like, follow, DM or scrape. It has no network code and asks for no credentials. You read its output and act on your own account.

## Why

X open-sourced the code behind the For You feed ([xai-org/x-algorithm](https://github.com/xai-org/x-algorithm), Apache-2.0). The scoring is a weighted sum of predicted actions, and the default weights are in the repository: a reply is weighted 5.0, a like 0.708, a reader copying the link 20.0, a mute −58.8, a report −234.0. Most "algorithm tips" on X ignore this. This skill turns the published numbers into working habits and checks drafts against them.

The full fact sheet with file paths and the retrieval date is in [`references/x-algorithm.md`](references/x-algorithm.md). The weights are repository defaults that scale per-viewer probabilities; they are not a formula you can run on your own counts, and the skill says so wherever it matters.

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

Requires Node 22 or newer. `npm run xskill -- <command>` works too; the `--` keeps npm from eating the flags.

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
length 231/280 (49 left), 1 url
WARN  link-only: The post is a link with fewer than 40 characters of text.
      why: A link-only post invites one low-weight action (open_link 0.2). Say what the reader will find and why it matters, or put the link in a reply.
ERROR bait: Engagement bait detected ("like if", "follow for", "tag a friend", "comment below" and similar).
      why: Bait trades a 0.708 like for the risk of a -53.07 "not interested" or a -234 report, and X's rules name engagement farming as manipulation.
```

Every finding says why, with the number from the published model it rests on. `lint` exits 1 on an error so you can use it as a gate. Character counting follows X's weighted rules: URLs count 23, CJK and emoji count 2.

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
| `src/plan.ts` | slot planner with a minimum gap (author diversity) and awake hours (reply window); schedule auditor |
| `src/analytics.ts` | CSV parser and summary for X's analytics exports |
| `src/value-model.ts` | the published weights as data |
| `scripts/xskill.ts` | the CLI |
| `test/` | 31 tests, `node:test` |

## Principles

- Facts from primary pages, with path and date. If a number is not in the repository, the skill says it is not.
- Human in the loop for every action on the account.
- No manipulation: no pods, bots, bought engagement, mass mentions or fake accounts. It breaks X's rules and it loses under the published weights.
- Honest limits over confident guesses.

## Contributing

Open an issue with the source for any factual change (file path in the x-algorithm repository and the date you read it). Pull requests need `npm run check` green. Tooling changes that add network calls or credential handling will not be merged.

## Licence

MIT. The ranking facts are from xai-org/x-algorithm, Apache-2.0; see its licence for that code.
