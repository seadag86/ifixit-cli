# QA Plan — Interactive Mode & Issue Auto-Close

## 1. Unit tests (automated)

Run `npm run build && npm test` to verify all 54 tests pass. These cover:
- `parseClosedIssues`: single, multiple, none, case-insensitive, extra whitespace
- Loop `closeIssue`: called with correct issue numbers, no-op when no `closes #N`
- All prior loop termination and tracking tests

---

## 2. Config flag parsing

| Test | Command | Expected |
|------|---------|----------|
| `-i` short form | `ifixit-cli -i` | Runs with interactive mode |
| `--interactive` long form | `ifixit-cli --interactive` | Runs with interactive mode |
| Conflict detection | `ifixit-cli -i -v` | Exits with: `--interactive and --verbose are mutually exclusive` |
| Help text | `ifixit-cli --help` | Shows `-i, --interactive` with description |
| Dry run with `-i` | `ifixit-cli -i --dry-run` | Prints prompt, no interactive status (dry run exits before loop) |

---

## 3. Interactive mode — terminal output

Run against a real repo with open issues and a working Docker setup.

**Status line**
- [ ] Status line appears and overwrites in place (no new lines per phase)
- [ ] Shows correct format: `[1/100] ◐ fetching issues  (iter: 0:00:00 | total: 0:00:00 | failures: 0)`
- [ ] Phase label advances through: `fetching issues` → `assembling prompt` → `running claude` → `checking commits`
- [ ] Iteration counter increments each loop
- [ ] Total elapsed increases monotonically
- [ ] Failures counter increments on no-commit iterations, resets to 0 after a success
- [ ] On success, prints permanent line: `[N/M] Success — commit <sha7>` followed by newline
- [ ] On circuit breaker, prints `Circuit breaker: ...` on its own line
- [ ] On completion, prints `[N/M] RALPH reports all issues complete` or `No open issues remaining`
- [ ] After loop ends, cursor is on a fresh line (no truncated status line)

**No bleed from Claude output**
- [ ] With `-i` (non-verbose), Claude's stdout is NOT printed to terminal — only status line updates appear

---

## 4. Issue auto-close — host-side

**Commit message parsing**

Run against a repo where Claude produces RALPH commits:

- [ ] After a RALPH commit containing `closes #<N>`, `gh issue view <N>` shows state: `closed`
- [ ] If commit message contains `closes #1 closes #2`, both issues are closed
- [ ] If commit message has no `closes #N`, no issue is closed and loop continues normally
- [ ] On the next iteration after a close, the closed issue does NOT appear in fetched issues

**Commit message convention**

Verify the prompt is being followed:
- [ ] A RALPH commit message starts with `RALPH:`
- [ ] Commit message contains `closes #<N>` for the targeted issue
- [ ] Partial-work commits (task not done) do NOT include `closes #N` (Claude leaves a comment instead)

**Prompt.md change — Docker no longer closes**

- [ ] Confirm Claude does not call `gh issue close` from inside the container (check `git log` output and verify close only happens on host side)

---

## 5. Regression — existing behavior unchanged

- [ ] Default run (no `-i`) still prints `[N/M] Running RALPH iteration...` and `[N/M] Success — commit <sha>` via `console.log`
- [ ] `--verbose` still streams Claude output to terminal
- [ ] `--debug` still prints exit code, stdout, stderr
- [ ] `--dry-run` still prints prompt and exits before Docker
- [ ] Circuit breaker still fires at `failureThreshold` consecutive failures
- [ ] `<promise>COMPLETE</promise>` still terminates the loop cleanly

---

## 6. Edge cases

| Scenario | Expected |
|----------|----------|
| Issue already closed before loop runs | `fetchOpenIssues` doesn't return it; no `closeIssue` call |
| `gh issue close` fails (network error, bad token) | Should surface the `execFileSync` exception — verify it's not silently swallowed |
| RALPH commit with malformed `closes` (e.g. `closes 42` without `#`) | Not parsed — no close attempt, issue stays open |
| maxIterations=1 with `-i` | Single iteration, then clean newline, then summary |
| No issues on first fetch | Loop exits immediately; `[1/N] No open issues remaining` printed cleanly in interactive mode |
