# Plan: Async Output Streaming, Orthogonal Flags, and Issue Pre-fetching

PRD: seadag86/ifixit-cli#1

## Issues

| # | Title | Status | Blocked by |
|---|-------|--------|------------|
| #2 | Async tee execution in Docker layer | ✅ Done | — |
| #3 | Async loop engine | ✅ Done | #2 |
| #4 | Orthogonal flags | ✅ Done | #2 |
| #5 | Issue pre-fetching | ✅ Done | #3 |

## Changes Made

### docker.ts
- Replaced `spawnSync` with async `spawn` + tee pattern
- `execInContainer` now returns `Promise<{ stdout, stderr, exitCode }>`
- `stream` option controls whether output is piped to terminal in real-time
- Output is always captured into buffers regardless of stream setting

### loop.ts
- `runLoop` is now async, returns `Promise<LoopResult>`
- `LoopDeps.execInContainer` returns `Promise<ExecResult>`
- Pre-fetches issues for next iteration during Claude Code execution
- Recent commits fetched after post-iteration processing (not pre-fetched)
- First iteration fetches issues directly; subsequent iterations use pre-fetched results

### config.ts
- Removed `--interactive` / `--verbose` mutual exclusion check
- Flags are now orthogonal: `--interactive` = UI chrome, `--verbose` = stream output

### index.ts
- `runLoop` call now awaited

### loop.test.ts
- All tests updated to async/await
- Added test for pre-fetch behavior
