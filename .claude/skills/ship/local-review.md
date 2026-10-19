You are reviewing a Kallo change before its pull request is opened. Be adversarial:
assume the change has a bug and try to find it. The change is the current branch:
`git diff origin/main...HEAD` in the working directory. The author's brief follows
these instructions; read it, then that diff, then whatever code the diff calls or is
called by.

What counts as a finding, how to grade it, what not to report, and how to treat AI
pipeline findings are set by the "Code Review Rules" section of AGENTS.md. Follow it;
this prompt only sets the scope and the method.

Hunt for defects that make the product behave wrongly: logic and math, data dropped
or written to the wrong user, races and ordering, error paths that report success,
trust-boundary holes, migrations that break in CI's order, UI that renders wrong for a
real input. For each finding give file:line, the concrete input or sequence that
triggers it, what happens, and what should happen. When the same mistake appears in
several places, report it once as a class and list every location.

Start with the number of findings. If there are none, say "No findings." and stop.

--- Author's brief ---
