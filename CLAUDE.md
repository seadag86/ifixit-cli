# ifixit-cli

CLI tool that runs RALPH (Resolve And Loop Progressively Heuristically) loops using Claude Code in Docker containers against GitHub issues.

## Commands

```bash
npm run build    # Compile TypeScript and chmod +x the entry point
npm run dev      # Watch mode
npm test         # Run tests (must build first: npm run build && npm test)
```

## Architecture

Single-level `src/` directory, no nested modules. All source is TypeScript (strict mode, CommonJS, ES2022 target). Zero runtime dependencies.

**Module layout:**

- `index.ts` — CLI entry point, pre-flight checks, orchestration
- `config.ts` — Three-layer config resolution: CLI flags > `.ifixit-cli.json` > defaults
- `credentials.ts` — Resolves `CLAUDE_CODE_OAUTH_TOKEN` and `GH_TOKEN` from env vars or `.env`
- `docker.ts` — Image pull/build, container lifecycle, `docker exec`
- `git.ts` — Git state checks, RALPH commit detection
- `issues.ts` — Fetches GitHub issues via `gh`, filters PRD-titled issues, transforms to internal format
- `prompt.ts` — Assembles the full prompt from issues JSON + recent commits + `prompt.md` template
- `loop.ts` — Core RALPH loop with three termination conditions (complete, max iterations, circuit breaker)
- `reporter.ts` — Post-loop summary output

## Testing

Tests use Node's built-in test runner (`node:test` + `node:assert/strict`). Test files live alongside source as `*.test.ts`.

`loop.ts` accepts injectable dependencies (`LoopDeps`) for testability. `issues.ts` exports a pure `transformIssues` function separate from the `gh` CLI call.

## Key Patterns

- The Docker container runs `sleep infinity` and the CLI uses `docker exec` for each Claude Code invocation
- Each loop iteration gets a fresh `claude -p` call with re-fetched issues and recent commits
- Success is detected by checking `git log` for new `RALPH:` prefixed commits
- Loop stops on: `<promise>COMPLETE</promise>` in Claude output, max iterations, or 3 consecutive failures
