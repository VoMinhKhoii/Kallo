CLAUDE.md and AGENTS.md compliance. Find the CLAUDE.md and AGENTS.md files at the repo root and
in every directory that holds a changed file or one of its parents (`git ls-files` lists them;
read each with `git show <Base>:<path>`). Audit the changes for compliance. When evaluating a
file, only consider CLAUDE.md and AGENTS.md files that share a file path with the file or its
parents. Flag only clear violations where you can quote the exact rule. If there are no such
files, write "0 findings." and stop.
