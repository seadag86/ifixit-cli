# Plan: ifixit-cli CLI

> Source PRD: PRD.md

## Architectural decisions

Durable decisions that apply across all phases:

- **Package**: npm package with `bin` entry pointing to the CLI entrypoint
- **Docker image**: `ghcr.io/<owner>/ifixit-cli:latest`, container mounts project at `/home/agent/repos`
- **Auth tokens**: `CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN` — env vars first, `.env` fallback
- **Config precedence**: CLI flags > `.ifixit-cli.json` > `config.json` defaults
- **Prompt structure**: Context sections (issues JSON + commits) prepended before `prompt.md` content
- **Success signal**: New `RALPH:` prefixed commit in `git log`
- **Completion signal**: `<promise>COMPLETE</promise>` in Claude's stdout
- **Issue shape**: `{ number, title, body, labels, comments, createdAt }`

---

## Phase 1: Single-iteration tracer bullet

**User stories**: 1, 4, 6, 7, 14, 15

### What to build

The thinnest possible end-to-end path. The CLI starts a Docker container from a locally-built image, mounts the current project directory as a read-write volume, passes auth tokens as environment variables, assembles a prompt with hardcoded/mock issue data and the contents of `prompt.md`, runs `claude -p` inside the container via `docker exec`, and checks `git log` for a new `RALPH:` prefixed commit. One iteration, then exit. This proves the entire pipeline — from CLI invocation through containerized Claude execution to committed output on the host filesystem.

### Acceptance criteria

- [x] Running `ifixit-cli` in a git repo starts a Docker container with the project mounted at `/home/agent/repos`
- [x] Auth tokens from environment variables or `.env` are passed into the container
- [x] A prompt is assembled with mock issue data prepended before `prompt.md` content
- [x] `claude -p` is invoked inside the container with the assembled prompt
- [x] After Claude exits, the CLI checks `git log` for a `RALPH:` prefixed commit and reports success or failure
- [x] The container is stopped and removed after the iteration completes

---

## Phase 2: Real issue fetching

**User stories**: 9, 10, 11, 12

### What to build

Replace the hardcoded mock data with real GitHub issue fetching. The CLI uses `gh` on the host to fetch all open issues, filters out any whose title starts with "PRD", and serializes each issue to JSON with number, title, body, labels, comments, and created date. It also fetches the last 10 `RALPH:` prefixed commits from `git log`. Both data sources are assembled into the prompt's context sections. Still runs a single iteration.

### Acceptance criteria

- [x] Open issues are fetched from the repo's GitHub remote using `gh`
- [x] Issues with titles starting with "PRD" are excluded
- [x] Each issue includes number, title, body, labels, comments, and created date
- [x] Last 10 `RALPH:` commits (SHA, date, message) are fetched from git log
- [x] Both datasets are prepended as structured sections before `prompt.md` content in the assembled prompt
- [x] The assembled prompt works correctly when passed to `claude -p`

---

## Phase 3: Loop and termination

**User stories**: 13, 16, 17, 18

### What to build

Wrap the single iteration in a loop. Each iteration gets a fresh `claude -p` invocation with freshly-fetched issue data (issues may have been closed by the prior iteration). After each iteration, the CLI checks for a new `RALPH:` commit — if absent, it increments a consecutive failure counter. The loop terminates when: (a) Claude's output contains `<promise>COMPLETE</promise>`, (b) the iteration count reaches 100, or (c) 3 consecutive iterations fail to produce a `RALPH:` commit. The failure counter resets after any successful iteration.

### Acceptance criteria

- [x] The loop runs multiple iterations, each with a fresh `claude -p` invocation
- [x] Issue data is re-fetched each iteration to reflect closed issues
- [x] The loop stops when `<promise>COMPLETE</promise>` is detected in Claude's output
- [x] The loop stops when max iterations (100) is reached
- [x] The loop stops after 3 consecutive failed iterations (no `RALPH:` commit)
- [x] The consecutive failure counter resets to 0 after a successful iteration
- [x] The termination reason is reported when the loop exits

---

## Phase 4: Pre-flight checks

**User stories**: 5, 6, 7, 8

### What to build

Before the loop starts, validate all prerequisites and fail fast with actionable error messages. Check that Docker is running, the current directory is a git repo with a remote origin, the working tree is clean (no uncommitted changes), and both auth tokens (`CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN`) are available. Print the current branch name so the user can confirm RALPH will commit to the right branch.

### Acceptance criteria

- [x] CLI exits with an error if Docker daemon is not running
- [x] CLI exits with an error if the current directory is not a git repo
- [x] CLI exits with an error if no remote origin is configured
- [x] CLI exits with an error if there are uncommitted changes in the working tree
- [x] CLI exits with an error if `CLAUDE_CODE_OAUTH_TOKEN` or `GH_TOKEN` is missing from both env vars and `.env`
- [x] CLI prints the current branch name before starting the loop
- [x] All error messages are actionable (tell the user what to do to fix it)

---

## Phase 5: CLI flags and config

**User stories**: 19, 20, 21, 25, 26

### What to build

Add full argument parsing with all CLI flags: `--max-iterations` / `-n` (default 100), `--failure-threshold` / `-f` (default 3), `--dry-run`, `--verbose` / `-v`, and `--build`. Implement three-layer config resolution: CLI flags override `.ifixit-cli.json` in the project root, which overrides package defaults. `--dry-run` fetches issues, assembles the full prompt, prints it, and exits without starting a container or running Claude. `--build` builds the Docker image locally instead of pulling from GHCR.

### Acceptance criteria

- [x] All flags are parsed: `-n`, `-f`, `--dry-run`, `-v`, `--build`
- [x] `.ifixit-cli.json` in the project root is read if present
- [x] Config precedence works: CLI flags > `.ifixit-cli.json` > package defaults
- [x] `--dry-run` prints the assembled prompt and exits without executing
- [x] `--build` builds the Docker image locally from the bundled Dockerfile
- [x] `-n` and `-f` correctly override the loop's max iterations and failure threshold
- [x] Invalid flag values produce clear error messages

---

## Phase 6: Output and reporting

**User stories**: 22, 23, 24

### What to build

In default (quiet) mode, print a one-line summary per iteration (e.g., `[3/100] Closed #42 — "Add user validation"`). In verbose mode (`-v`), stream Claude Code's full stdout to the terminal in real-time. After the loop completes, print a summary table showing: all closed issues (with numbers and titles), any still-open issues, total commit count, and the termination reason.

### Acceptance criteria

- [x] Default mode shows a single-line summary per iteration with iteration number, issue acted on, and outcome
- [x] Verbose mode streams Claude Code's stdout in real-time
- [x] Post-loop summary lists all issues closed during the run
- [x] Post-loop summary lists any issues still open
- [x] Post-loop summary shows total RALPH commit count
- [x] Post-loop summary shows termination reason (complete, max iterations, or circuit-breaker)

---

## Phase 7: Distribution

**User stories**: 1, 2, 3

### What to build

Publish the Docker image to GHCR via a GitHub Actions workflow. Publish the npm package so `npx ifixit-cli` works globally. The CLI defaults to pulling the pre-built image from GHCR on first run (or when a newer version is available). The `--build` flag remains as an override for local development. Ensure the `prompt.md` and `config.json` are bundled with the npm package.

### Acceptance criteria

- [ ] Docker image is published to GHCR via CI (requires GitHub repo setup)
- [ ] npm package is published and `npx ifixit-cli` works in any project directory (requires npm publish)
- [x] CLI pulls the GHCR image by default if not present locally
- [x] `--build` still works for local image builds
- [x] `prompt.md` and `config.json` are included in the published npm package (via package.json files field)
- [ ] README documents installation and usage
