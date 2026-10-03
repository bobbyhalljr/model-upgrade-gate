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
