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
