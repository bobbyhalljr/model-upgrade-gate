# model-upgrade-gate

Contract tests and an upgrade gate for LLM providers, in one TypeScript file.
It diffs a current model against a candidate, checks known breaks from vendor docs, and blocks the upgrade when either side fails.
The providers are mocks. No API key.

## Why it matters

A model upgrade is a breaking change.
Parameters that worked last month can return a 400. Progress text can disappear into an empty thinking block. A tool choice the old model accepted can be rejected by the new one.

Contract tests catch that before you ship.
The gate turns those failures into a hard stop.

## Run it

You need Node.js 18 or newer.

```bash
npm install
npx tsx upgrade-gate.ts
```

The process exits with code 1 when the gate is BLOCKED. That is by design for this demo. The demo app has known breaks and contract regressions, so the gate should fail.

## Example output

This is real output from `npx tsx upgrade-gate.ts`:

```text
Upgrade gate, 2026-10-03

Known breaks (from release notes)
  BREAK    ticket-classifier: tool_choice.type=tool: returns a 400 error [Claude notes, Sep 28]
  BREAK    fast-summary: thinking.type=disabled: send "between_tools" instead [Claude notes, Sep 28]
  BREAK    code-agent: reasoning.effort=none: not supported [OpenAI model page]
  BREAK    file-agent: tools=write_file: built-in tools changed [Gemini changelog, Sep 17]
  DEADLINE file-agent: antigravity-preview-05-2026 shuts down 2026-10-05 (2 days)

Contract diff (MOCK claude-sonnet-5 -> MOCK claude-sonnet-5-5)
  same   output schema
  same   tool call format
  BROKE  progress text between tools  user sees nothing before the tool call (empty thinking block)
  BROKE  forced tool use              400 tool_choice: type "tool" and "any" are not supported for this model.
  BROKE  thinking off (fast path)     400 invalid_request_error: use "between_tools"
  same   token limit stop reason
  same   refusal behavior

GATE: BLOCKED (4 known breaks, 3 contract regressions)
```

Four known breaks from release notes. Three contract regressions between the mocked Sonnet 5 and Sonnet 5.5. The gate stays closed.

## How it works

```text
call sites ──→ known breaks check ──┐
                                    ├──→ GATE: OPEN or BLOCKED
contracts ──→ run on current        │
           ──→ run on candidate ────┘
                 (BROKE / same / FAIL)
```

| File | What it does |
| --- | --- |
| `upgrade-gate.ts` | The whole gate, in the same order as the post |
| `blocks/` | The six post blocks, one file each |
| `output.txt` | Real output of `npx tsx upgrade-gate.ts` |
| `package.json` | `tsx`, `typescript` and `@types/node` as dev dependencies |
| `tsconfig.json` | Strict settings for `npx tsc --noEmit` |

Inside `upgrade-gate.ts`:

- Types: `Req`, `Block`, `Stop`, `Ok`, `Res`, `Provider`
- `mockClaude`: a MOCK provider. The two Sonnet 5.5 rejections (thinking `"disabled"`, forced `tool_choice` `"any"`/`"tool"`) follow Anthropic's docs. The `tool_choice` error string is quoted from the docs. The other error text and every reply are made up.
- `contracts`: seven checks (output schema, tool call format, progress text, forced tool use, thinking off, token limit, refusal)
- `runSuite` and `contractDiff`: run the suite on current and candidate, mark what BROKE
- `knownBreaks` and `shutdowns`: rows from vendor docs, checked Oct 3, 2026
- `callSites`: a made-up app's upgrade list
- The gate: BLOCKED when any known break or contract regression is present

What is real and what is mocked:

- `mockClaude()` is a MOCK. No network. No API key.
- `knownBreaks` rows come from vendor docs checked Oct 3, 2026 (Claude release notes Sep 22 and Sep 28, OpenAI model page, Gemini changelog Sep 17 and deprecations).
- `callSites` describe a made-up app.

## Limits

This is a teaching gate.

- The providers are scripts. A real model and a real API will surprise you in ways a mock will not.
- The contract suite is seven checks. Your app needs its own.
- `knownBreaks` goes stale the day a vendor ships something new. Re-check the docs.
- `callSites` are made up. Point them at your real call sites.
- Exit code 1 on BLOCKED is intentional. Treat it like a failing CI job.

## Read more

- Dev.to: [Your Model Upgrade Is a Breaking Change: Build Contract Tests for LLM Providers in TypeScript](https://dev.to/bobbyhalljr/your-model-upgrade-is-a-breaking-change-build-contract-tests-for-llm-providers-in-typescript-14d)
- Substack: [Your Model Upgrade Is a Breaking Change: Build Contract Tests for LLM Providers in TypeScript](https://bobbyhalljr.substack.com/p/your-model-upgrade-is-a-breaking)
- Images and more: [bhjr.dev/blog/model-upgrade-breaking-change](https://bhjr.dev/blog/model-upgrade-breaking-change/)

## License

MIT. See [LICENSE](LICENSE).
