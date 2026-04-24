export function parseStagingDispatchInput(input) {
  const rawInput = input.trim();

  if (/^\d+$/.test(rawInput)) {
    return {
      kind: 'pull_request',
      prNumber: Number.parseInt(rawInput, 10),
      rawInput,
    };
  }

  return {
    kind: 'git_ref',
    rawInput,
  };
}
