# Task Board — Tuturuuu (`ttr`)

The team's planning/task board is **Tuturuuu**, driven by the `ttr` CLI. Referred to informally as **"ttr"**. The CLI is already installed (`~/.bun/bin/ttr`) and logged in.

## Setup

- **Workspace**: **Kallo** (Kallo's internal name) — `86f5dd41-8305-42ba-a93d-820afaa81c41`
- **Auth check**: `ttr whoami`
- Task markdown lives in `.tuturuuu/tasks/`; reusable templates in `.tuturuuu/task-templates/`.
- Upgrade the CLI with `ttr upgrade` when it flags a new version.

## Boards

| Board | Id | Purpose |
|-------|----|---------|
| **Planning** | `5d6e17ca-40ea-4d82-98d8-fba232654e54` | Roadmap, goals, backlog. Log new roadmap/feature items here (→ **Backlog** list). |
| **Dev** | `fcdee18e-9402-4dfc-84ac-19283e3e6f3b` | Per-work-item tasks (In Progress, Bugs, Code Review, Doc, …). |

Board/list ids drift — confirm before use:

```bash
ttr boards list
ttr lists list --board <board-id>
```

Planning → **Backlog** is `442ea3ec-0d34-4fb7-9c14-fab547148512`.

## Templates

Templates live in **two places, kept in sync**: local `.tuturuuu/task-templates/*.md` (versioned in the repo) and the Tuturuuu workspace registry (`ttr task-templates list`, visible to teammates without the repo). Local files work standalone — no import required — via `ttr task-templates use <file> --list <id>` or `ttr tasks create --template <path>`.

| Slug | Name | Local file | In workspace | Use for |
|------|------|:---:|:---:|---------|
| `feature` | Feature / Work Item | ✅ | ✅ | Any feature / refactor / chore, ticket-style (what · why · scope · done-when) |
| `bug-report` | Bug Report | ✅ | ✅ | Bug with repro / expected / actual / impact |
| `data-curation` | Data Curation | ✅ | ✅ | Wrong nutrition data row — lean, fillable by non-engineers |
| `ai-pipeline-eval` | AI Pipeline Eval | ✅ | ✅ | One timestamped eval per run (summary · numbers · verdict · follow-ups) |
| `meeting-minutes` | Meeting Minutes | ✅ | ✅ | Meeting notes → Planning → Doc |
| `scheduled-item` | Scheduled item entry | — | ✅ (private) | Recurring scheduled item, appended to DEV-64 |

Keeping them in sync: author/edit the local `.md`, then `ttr task-templates import <file>` (create or update the workspace copy). `scheduled-item` is workspace-only (no local file).

## Common commands

```bash
ttr tasks list                              # open personal + assigned tasks
ttr tasks list --all                        # include done/closed
ttr tasks create "<title>" \
  --board <board-id> --list <list-id> \
  --priority <low|normal|high|critical> \
  --description-file <path.md> --description-format markdown
ttr tasks create --template <key> --list <list-id>   # from .tuturuuu/task-templates/
```

Scoped help: `ttr tasks --help`, `ttr tasks create --help`, `ttr boards --help`.

## After creating: always output the link

The `ttr` CLI does **not** print a task URL. **Whenever you create a task (or anything with a shareable board view), construct and surface its web link so the user can click straight to it.** Get the task id from the create output (or `ttr tasks get <id> --json`), then:

```text
https://tasks.tuturuuu.com/<workspace-id>/tasks/boards/<board-id>?task=<task-id>
```

Example (the `/docs` task):

```text
https://tasks.tuturuuu.com/86f5dd41-8305-42ba-a93d-820afaa81c41/tasks/boards/5d6e17ca-40ea-4d82-98d8-fba232654e54?task=5ad70561-2432-4848-94a8-fd5b42856c89
```

Note the host is `tasks.tuturuuu.com` (not `tuturuuu.com`).
