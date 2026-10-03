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
