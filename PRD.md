# PRD: ifixit-cli CLI

## Problem Statement

Developers using Claude Code want to automate iterative development loops against their GitHub issues. Today, this requires manually invoking Claude Code for each issue, assembling context by hand, and tracking progress across iterations. There's no way to "set it and forget it" — point an AI agent at your backlog and let it work through issues autonomously while maintaining clean git history.

## Solution

A CLI tool called `ifixit-cli` that orchestrates a RALPH (Resolve And Loop Progressively Heuristically) loop. The user runs `ifixit-cli` in any project directory. The CLI spins up a Docker container with Claude Code pre-installed, mounts the project directory, fetches open GitHub issues, and runs Claude Code in a loop — one issue per iteration. Each iteration produces a committed, reviewable unit of work. The loop runs until all issues are resolved, a max iteration count is reached, or Claude gets stuck.

## User Stories

1. As a developer, I want to run `npx ifixit-cli` in my project directory, so that I can start an automated development loop without any setup beyond having Docker and credentials.
2. As a developer, I want the CLI to pull a pre-built Docker image from GHCR on first run, so that I don't wait for a local image build.
3. As a developer, I want to use `--build` to rebuild the Docker image locally, so that I can test Dockerfile changes during development of ifixit-cli itself.
4. As a developer, I want the CLI to read `CLAUDE_CODE_OAUTH_TOKEN` and `GH_TOKEN` from environment variables or a `.env` file, so that I can authenticate without manual steps each run.
5. As a developer, I want the CLI to fail fast with a clear error if Docker is not running, so that I don't get a cryptic failure mid-loop.
6. As a developer, I want the CLI to fail fast if my working tree has uncommitted changes, so that RALPH's commits don't get tangled with my in-progress work.
7. As a developer, I want the CLI to fail fast if the directory is not a git repo with a remote origin, so that GitHub issue fetching and commit tracking work correctly.
8. As a developer, I want the CLI to print which branch RALPH will commit to before starting, so that I can bail out if it's the wrong branch.
9. As a developer, I want the CLI to fetch all open GitHub issues whose titles do not start with "PRD", so that PRD planning issues are excluded from the work loop.
10. As a developer, I want each issue's number, title, body, labels, comments, and created date passed to Claude, so that Claude has full context for task selection and execution.
11. As a developer, I want the last 10 RALPH commits passed to Claude each iteration, so that Claude understands what work has already been done.
12. As a developer, I want Claude to pick the next task each iteration based on the prioritization rules in `prompt.md`, so that critical bugfixes are addressed before polish work.
13. As a developer, I want each iteration to run as a fresh Claude Code invocation (no stale context), so that each task gets a clean reasoning slate.
14. As a developer, I want all iterations to run in the same Docker container, so that I don't pay container startup overhead per iteration.
15. As a developer, I want the CLI to detect iteration success by checking for a new `RALPH:` prefixed commit in git log, so that success is measured by actual committed output.
16. As a developer, I want the loop to stop when Claude outputs `<promise>COMPLETE</promise>`, so that the loop ends when all issues are resolved.
17. As a developer, I want the loop to stop after a configurable max iterations (default 100), so that the loop doesn't run forever.
18. As a developer, I want the loop to stop after 3 consecutive failed iterations (no `RALPH:` commit), so that I don't waste API credits when Claude is stuck.
19. As a developer, I want to configure max iterations via `-n` / `--max-iterations` flag, so that I can limit runs for testing or budget reasons.
20. As a developer, I want to configure the failure threshold via `-f` / `--failure-threshold` flag, so that I can adjust tolerance for stuck iterations.
21. As a developer, I want a `--dry-run` flag that fetches issues and shows the assembled prompt without executing, so that I can verify what Claude will see.
22. As a developer, I want quiet output by default with a one-line summary per iteration, so that long-running loops are readable.
23. As a developer, I want a `--verbose` / `-v` flag to stream full Claude Code output in real-time, so that I can debug issues with specific iterations.
24. As a developer, I want a post-loop summary showing closed issues, still-open issues, commit count, and termination reason, so that I know what happened without digging through git log.
25. As a developer, I want to place a `.ifixit-cli.json` in my project to set per-project defaults for max iterations and failure threshold, so that my team shares consistent settings.
26. As a developer, I want CLI flags to override `.ifixit-cli.json`, which overrides package defaults, so that I always have an escape hatch.

## Implementation Decisions

### Modules

- **CLI Parser**: Argument parsing using a TypeScript CLI framework. Resolves config with three-layer precedence: CLI flags > `.ifixit-cli.json` in project root > package defaults (`config.json`). Validates all inputs before proceeding.
- **Pre-flight Checker**: Validates prerequisites before the loop starts. Checks: Docker daemon running, git repo with remote origin, clean working tree, both auth tokens present. Fails fast with actionable error messages.
- **Docker Manager**: Handles image lifecycle (pull from GHCR or local build) and container lifecycle (start, exec, stop). Mounts the current directory as a read-write volume. Passes auth tokens as environment variables into the container.
- **Issue Fetcher**: Uses `gh` CLI on the host to fetch open issues. Filters out issues whose titles start with "PRD". Serializes each issue to JSON with fields: number, title, body, labels, comments, created date.
- **Prompt Assembler**: Reads `prompt.md` template from the package. Prepends structured context sections (issues JSON, last 10 RALPH commits) above the template content. Outputs a single prompt string for `claude -p`.
- **Loop Controller**: Core orchestrator. For each iteration: assembles the prompt, runs `claude -p` inside the container via `docker exec`, checks git log for a new `RALPH:` commit, tracks consecutive failures, evaluates all three termination conditions. Emits events for the reporter.
- **Output Reporter**: Consumes loop events. In default mode, prints one-line iteration summaries. In verbose mode, streams Claude's stdout. After loop completion, prints summary table with closed issues, open issues, total commits, and termination reason.

### Architecture

- The Docker container runs with `sleep infinity` as entrypoint (already in Dockerfile). The CLI starts it once, then uses `docker exec` for each Claude Code invocation.
- The project directory is mounted read-write at `/home/agent/repos` inside the container. Git operations inside the container are immediately visible on the host.
- The `prompt.md` is bundled with the npm package, not read from the user's project.
- Issue fetching happens on the host (not inside the container) since `GH_TOKEN` is available and `gh` may already be installed. The CLI handles this directly.

### Schema

- `.ifixit-cli.json` (optional, in project root):
  ```json
  {
    "maxIterations": 100,
    "failureThreshold": 3
  }
  ```

## Testing Decisions

Good tests verify external behavior through the module's public interface, not implementation details. Tests should remain valid even if the internal implementation changes completely.

### Modules to test

- **Issue Fetcher**: Given mock `gh` CLI output, verify correct filtering (PRD exclusion) and serialization (all required fields present, correct types). Test edge cases: no open issues, all issues are PRDs, issues with no comments, issues with special characters in titles.
- **Prompt Assembler**: Given known issues JSON and commit history, verify the output prompt contains all sections in the correct order and the `prompt.md` content is included verbatim.
- **Loop Controller**: Test termination conditions in isolation: max iterations reached, consecutive failure threshold hit, COMPLETE signal received. Test iteration success detection against mock git log output. Test that consecutive failure counter resets after a successful iteration.

## Out of Scope

- **Local mode (no Docker)**: Running Claude Code directly on the host without containerization.
- **Parallel issue execution**: Running multiple Claude Code instances on different issues simultaneously.
- **PR creation**: Automatically creating pull requests from RALPH's work.
- **Branch management**: Creating feature branches per issue or per run.
- **Custom prompt overrides**: Letting users supply their own `prompt.md`.
- **Web UI or dashboard**: Visualizing loop progress beyond terminal output.
- **Non-GitHub issue trackers**: Linear, Jira, etc.

## Further Notes

- The name RALPH stands for "Resolve And Loop Progressively Heuristically."
- The `prompt.md` includes a task prioritization scheme (critical bugfixes > tracer bullets > polish > refactors) that Claude follows autonomously.
- Claude closes GitHub issues it considers complete and leaves comments on issues it made partial progress on.
- The `<promise>COMPLETE</promise>` signal in Claude's output is the canonical way to detect "no more work to do."
