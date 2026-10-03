// Illustrative call sites in a made-up app.
const S5 = "claude-sonnet-5", S55 = "claude-sonnet-5-5";
const callSites: CallSite[] = [
  { site: "invoice-extractor", from: S5, to: S55, params: {} },
  { site: "ticket-classifier", from: S5, to: S55, params: { "tool_choice.type": ["tool"] } },
  { site: "fast-summary", from: S5, to: S55, params: { "thinking.type": ["disabled"] } },
  { site: "code-agent", from: "gpt-6-sol", to: "gpt-6.1-sol", params: { "reasoning.effort": ["none"] } },
  { site: "file-agent", from: "antigravity-preview-05-2026", to: "antigravity-preview-09-2026", params: { tools: ["write_file"] } },
];

const today = "2026-10-03";
console.log(`Upgrade gate, ${today}`);

const breaks = checkKnownBreaks(callSites, today);
const broke = contractDiff(mockClaude(S5), mockClaude(S55));

const blocked = breaks > 0 || broke.length > 0;
console.log(blocked ? `\nGATE: BLOCKED (${breaks} known breaks, ${broke.length} contract regressions)` : "\nGATE: OPEN");
process.exitCode = blocked ? 1 : 0;
