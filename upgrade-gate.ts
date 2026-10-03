// Model upgrade gate. Companion code for "Your Model Upgrade Is a Breaking Change: Build Contract Tests for LLM Providers in TypeScript".
// MOCKED: providers are scripts. The two Sonnet 5.5 rejections follow Anthropic docs (Sep 28). Other error text and replies are made up.
// knownBreaks rows come from vendor docs (checked Oct 3, 2026). callSites describe a made-up app.
// No API key. No network. Run with: npx tsx upgrade-gate.ts (exits 1 / GATE BLOCKED by design).

type Req = {
  prompt: string;
  maxTokens: number;
  thinking?: { type: "adaptive" | "disabled" | "between_tools" };
  toolChoice?: { type: "auto" | "none" | "any" | "tool" };
  tools?: string[];
};

type Block =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown> };

type Stop = "end_turn" | "tool_use" | "max_tokens" | "refusal";
type Ok = { status: 200; stopReason: Stop; content: Block[] };
type Res = Ok | { status: 400; error: string };

type Provider = { model: string; send: (req: Req) => Res };
// MOCK PROVIDER. No network, no API key. The two Sonnet 5.5 rejections follow
// Anthropic's docs (Sep 28), and the tool_choice error is quoted from them.
// The other error text and every reply are made up.
const reply = (stopReason: Stop, ...content: Block[]): Ok => ({ status: 200, stopReason, content });

function mockClaude(model: "claude-sonnet-5" | "claude-sonnet-5-5"): Provider {
  const v55 = model === "claude-sonnet-5-5";

  const send = (req: Req): Res => {
    if (v55 && req.thinking?.type === "disabled") {
      return { status: 400, error: 'invalid_request_error: use "between_tools"' };
    }
    if (v55 && ["any", "tool"].includes(req.toolChoice?.type ?? "auto")) {
      return { status: 400, error: 'tool_choice: type "tool" and "any" are not supported for this model.' };
    }
    if (req.prompt.startsWith("[refuse]")) return reply("refusal");
    if (req.maxTokens < 50) return reply("max_tokens", { type: "text", text: "Q3 revenue grew" });

    if (req.tools?.includes("get_weather")) {
      const note = "Checking the forecast first. Then I'll compare it with yesterday.";
      const shown = req.thinking?.type === "between_tools" ? note : "";
      const progress: Block = v55 ? { type: "thinking", thinking: shown } : { type: "text", text: note };
      return reply("tool_use", progress, { type: "tool_use", name: "get_weather", input: { city: "Paris" } });
    }
    if (req.tools?.includes("classify_ticket")) {
      return reply("tool_use", { type: "tool_use", name: "classify_ticket", input: { label: "billing" } });
    }
    return reply("end_turn", { type: "text", text: '{"total": 42.5, "currency": "USD"}' });
  };

  return { model, send };
}
type Contract = { name: string; req: Req; check: (res: Ok) => string | null };

const weather: Req = { prompt: "Weather in Paris?", maxTokens: 500, tools: ["get_weather"] };

const contracts: Contract[] = [
  {
    name: "output schema",
    req: { prompt: "Extract the invoice total as JSON", maxTokens: 500 },
    check: ({ content: [first] }) => {
      const data = JSON.parse(first?.type === "text" ? first.text : "null");
      return typeof data?.total === "number" && typeof data?.currency === "string" ? null : "bad JSON shape";
    },
  },
  {
    name: "tool call format",
    req: weather,
    check: (res) => {
      const call = res.content.find((b) => b.type === "tool_use");
      return res.stopReason === "tool_use" && typeof call?.input.city === "string" ? null : "bad tool call";
    },
  },
  {
    name: "progress text between tools",
    req: weather,
    check: ({ content: [first] }) => {
      const shown = first?.type === "text" ? first.text : first?.type === "thinking" ? first.thinking : "";
      return shown ? null : `user sees nothing before the tool call (empty ${first?.type} block)`;
    },
  },
  {
    name: "forced tool use",
    req: { prompt: "Classify this ticket", maxTokens: 200, tools: ["classify_ticket"], toolChoice: { type: "tool" } },
    check: (res) => (res.stopReason === "tool_use" ? null : "no tool call"),
  },
  {
    name: "thinking off (fast path)",
    req: { prompt: "Summarize in one line", maxTokens: 200, thinking: { type: "disabled" } },
    check: () => null, // a 200 is the whole contract
  },
  {
    name: "token limit stop reason",
    req: { prompt: "Write the full quarterly report", maxTokens: 20 },
    check: (res) => (res.stopReason === "max_tokens" ? null : `got ${res.stopReason}`),
  },
  {
    name: "refusal behavior",
    req: { prompt: "[refuse] a request the model declines", maxTokens: 200 },
    check: (res) => (res.stopReason === "refusal" && res.content.length === 0 ? null : "refusal not clean"),
  },
];
type Result = { name: string; pass: boolean; detail: string };

function runSuite(provider: Provider): Result[] {
  return contracts.map(({ name, req, check }) => {
    const res = provider.send(req);
    if (res.status !== 200) return { name, pass: false, detail: `${res.status} ${res.error}` };
    try {
      const failure = check(res);
      return { name, pass: failure === null, detail: failure ?? "" };
    } catch (err) {
      return { name, pass: false, detail: `threw: ${(err as Error).message}` };
    }
  });
}

function contractDiff(current: Provider, candidate: Provider) {
  const before = runSuite(current);
  const after = runSuite(candidate);
  const broke: string[] = [];

  console.log(`\nContract diff (MOCK ${current.model} -> MOCK ${candidate.model})`);
  after.forEach((a, i) => {
    const status = before[i].pass && !a.pass ? "BROKE" : a.pass ? "same" : "FAIL";
    if (status === "BROKE") broke.push(a.name);
    console.log(`  ${status.padEnd(6)} ${a.name.padEnd(28)} ${a.detail}`.trimEnd());
  });
  return broke;
}
type KnownBreak = { model: string; param: string; bad: string[]; docs: string; source: string };

// From the vendors' docs, checked Oct 3, 2026.
const knownBreaks: KnownBreak[] = [
  { model: "claude-sonnet-5-5", param: "thinking.type", bad: ["disabled"], docs: 'send "between_tools" instead', source: "Claude notes, Sep 28" },
  { model: "claude-sonnet-5-5", param: "tool_choice.type", bad: ["any", "tool"], docs: "returns a 400 error", source: "Claude notes, Sep 28" },
  { model: "claude-opus-5-5", param: "thinking.type", bad: ["disabled", "enabled"], docs: "returns a 400 error", source: "Claude notes, Sep 22" },
  { model: "gpt-6.1-sol", param: "reasoning.effort", bad: ["none", "minimal"], docs: "not supported", source: "OpenAI model page" },
  { model: "antigravity-preview-09-2026", param: "tools", bad: ["write_file", "read_file", "list_files"], docs: "built-in tools changed", source: "Gemini changelog, Sep 17" },
];

const shutdowns: Record<string, string> = { "antigravity-preview-05-2026": "2026-10-05" };

type CallSite = { site: string; from: string; to: string; params: Record<string, string[]> };

function checkKnownBreaks(sites: CallSite[], today: string) {
  let count = 0;
  console.log("\nKnown breaks (from release notes)");
  for (const s of sites) {
    for (const rule of knownBreaks.filter((r) => r.model === s.to)) {
      for (const value of (s.params[rule.param] ?? []).filter((v) => rule.bad.includes(v))) {
        count++;
        console.log(`  BREAK    ${s.site}: ${rule.param}=${value}: ${rule.docs} [${rule.source}]`);
      }
    }
    const end = shutdowns[s.from];
    const days = (Date.parse(end) - Date.parse(today)) / 86_400_000;
    if (end) console.log(`  DEADLINE ${s.site}: ${s.from} shuts down ${end} (${days} days)`);
  }
  if (count === 0) console.log("  no known breaks");
  return count;
}
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
