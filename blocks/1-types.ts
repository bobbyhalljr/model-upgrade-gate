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
