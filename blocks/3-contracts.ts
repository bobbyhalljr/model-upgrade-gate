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
