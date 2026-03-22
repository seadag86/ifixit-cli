# PLAN: Interactive Mode + Issue Auto-Close

## Decisions

### Interactive Mode (`-i / --interactive`)
- Distinct from `--verbose` — structured status, not raw Claude output
- Single line rewritten in place: `[3/10] ◐ Iteration 3 — running claude (0:01:23 elapsed | failures: 0)`
- Shows: iteration counter, total elapsed, per-iteration elapsed, current loop phase, consecutive failure count
- Mutually exclusive with `--verbose` — throw on conflict
- Zero new dependencies — raw ANSI escape codes only

### Issue Auto-Close
- Issues left open after a RALPH commit cause thrash — must be closed
- **Host CLI closes issues**, not Docker/Claude — keeps state management in one actor
- After detecting a new RALPH commit, host parses commit message for `closes #N` references and calls `gh issue close <N>`
- Commit message convention enforced via prompt template: `RALPH: closes #42 — <description>`

---

## Phase 1: Interactive Mode

### 1.1 Config (`src/config.ts`)
- Add `-i, --interactive` boolean flag
- Validate: throw if `--interactive` and `--verbose` are both set

### 1.2 Loop status display (`src/loop.ts`)
- Add `interactive` to `LoopDeps` (or pass via config)
- Track: `iterationStartTime`, `loopStartTime`, `phase` (enum: `fetching` | `assembling` | `running` | `checking`)
- On each phase transition, call a `renderStatus(state)` function
- `renderStatus` writes `\r` + status string to `process.stdout` (no newline, overwrites in place)
- On loop exit, write a final newline to leave terminal clean

### 1.3 Status format
```
[3/10] ◐ running claude  (iter: 0:00:47 | total: 0:02:13 | failures: 0)
```
- Spinner cycles through `◐ ◓ ◑ ◒` on each render
- Phases: `fetching issues`, `assembling prompt`, `running claude`, `checking commits`

---

## Phase 2: Issue Auto-Close

### 2.1 Prompt template (`prompt.md`)
- Add instruction: Claude must include `closes #<N>` in every RALPH commit message for the issue being resolved
- Clarify: one issue per RALPH commit

### 2.2 Commit parsing (`src/git.ts`)
- Add `parseClosedIssues(commitMessage: string): number[]`
- Regex: `/closes\s+#(\d+)/gi`
- Return array of issue numbers

### 2.3 Loop integration (`src/loop.ts`)
- After detecting a new RALPH commit, call `parseClosedIssues` on the commit message
- Pass closed issue numbers back through `LoopResult`

### 2.4 Host closes issues (`src/index.ts`)
- After loop completes, for each issue number in `result.closedIssues`, call `gh issue close <N>`
- Log each close: `Closed issue #42`

---

## Phase 3: Tests

- Unit test `parseClosedIssues` — single issue, multiple issues, no issues, malformed
- Update `loop.test.ts` — assert `closedIssues` populated on successful RALPH commit
- Integration smoke test for interactive rendering (assert no throw, terminal left clean)

---

## Unresolved Questions

_None — all branches resolved._

---

## Progress

- [x] Phase 1: Interactive Mode
- [x] Phase 2: Issue Auto-Close
- [x] Phase 3: Tests
