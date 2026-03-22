import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { runLoop, LoopDeps, LoopConfig } from './loop';
import { Issue } from './prompt';

const makeIssue = (n: number): Issue => ({
  number: n,
  title: `Issue #${n}`,
  body: '',
  labels: [],
  comments: [],
  createdAt: '2026-01-01T00:00:00Z',
});

const baseConfig: LoopConfig = {
  maxIterations: 10,
  failureThreshold: 3,
  verbose: false,
  projectDir: '/tmp/fake',
};

describe('runLoop', () => {
  let logs: string[];
  const originalLog = console.log;

  beforeEach(() => {
    logs = [];
    console.log = (...args: any[]) => logs.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('stops with complete when COMPLETE signal is in output', () => {
    let callCount = 0;
    const deps: LoopDeps = {
      fetchOpenIssues: () => [makeIssue(1)],
      getRecentRalphCommits: () => '',
      assemblePrompt: () => 'prompt',
      getLatestRalphCommit: () => null,
      execInContainer: () => {
        callCount++;
        return { stdout: '<promise>COMPLETE</promise>', exitCode: 0 };
      },
    };

    const result = runLoop(baseConfig, deps);
    assert.equal(result.reason, 'complete');
    assert.equal(callCount, 1);
  });

  it('stops at max iterations', () => {
    let commitSha = 0;
    const deps: LoopDeps = {
      fetchOpenIssues: () => [makeIssue(1)],
      getRecentRalphCommits: () => '',
      assemblePrompt: () => 'prompt',
      getLatestRalphCommit: () => `sha${++commitSha}`.padEnd(40, '0'),
      execInContainer: () => ({ stdout: '', exitCode: 0 }),
    };

    const config = { ...baseConfig, maxIterations: 3 };
    const result = runLoop(config, deps);
    assert.equal(result.reason, 'max_iterations');
    assert.equal(result.iterations, 3);
  });

  it('stops after consecutive failures hit threshold', () => {
    const deps: LoopDeps = {
      fetchOpenIssues: () => [makeIssue(1)],
      getRecentRalphCommits: () => '',
      assemblePrompt: () => 'prompt',
      getLatestRalphCommit: () => null,
      execInContainer: () => ({ stdout: '', exitCode: 0 }),
    };

    const config = { ...baseConfig, failureThreshold: 3 };
    const result = runLoop(config, deps);
    assert.equal(result.reason, 'circuit_breaker');
    assert.equal(result.iterations, 3);
    assert.equal(result.successCount, 0);
  });

  it('resets failure counter after a success', () => {
    let iteration = 0;
    const deps: LoopDeps = {
      fetchOpenIssues: () => [makeIssue(1)],
      getRecentRalphCommits: () => '',
      assemblePrompt: () => 'prompt',
      getLatestRalphCommit: () => {
        iteration++;
        // Iterations 1,2 fail (null), 3 succeeds, 4,5,6 fail
        // getLatestRalphCommit is called twice per iteration (before and after)
        const iter = Math.ceil(iteration / 2);
        const isAfter = iteration % 2 === 0;
        if (iter === 3 && isAfter) return 'a'.repeat(40);
        return null;
      },
      execInContainer: () => ({ stdout: '', exitCode: 0 }),
    };

    const config = { ...baseConfig, maxIterations: 10, failureThreshold: 3 };
    const result = runLoop(config, deps);
    assert.equal(result.reason, 'circuit_breaker');
    assert.equal(result.iterations, 6);
    assert.equal(result.successCount, 1);
  });

  it('stops with complete when no issues remain', () => {
    let fetchCount = 0;
    const deps: LoopDeps = {
      fetchOpenIssues: () => {
        fetchCount++;
        // First call (initialIssues in constructor): return issues
        // Second call (iteration 1): return issues
        // Third call (iteration 2): return empty
        if (fetchCount <= 2) return [makeIssue(1)];
        return [];
      },
      getRecentRalphCommits: () => '',
      assemblePrompt: () => 'prompt',
      getLatestRalphCommit: (() => {
        let sha = 0;
        return () => `sha${++sha}`.padEnd(40, '0');
      })(),
      execInContainer: () => ({ stdout: '', exitCode: 0 }),
    };

    const result = runLoop(baseConfig, deps);
    assert.equal(result.reason, 'complete');
  });

  it('tracks closed issues correctly', () => {
    let fetchCount = 0;
    const allIssues = [makeIssue(1), makeIssue(2), makeIssue(3)];
    const deps: LoopDeps = {
      fetchOpenIssues: () => {
        fetchCount++;
        // Initial fetch + iteration 1: all 3
        // Iteration 2 + finish fetch: only issue 2 and 3 (issue 1 closed)
        if (fetchCount <= 2) return [...allIssues];
        return [makeIssue(2), makeIssue(3)];
      },
      getRecentRalphCommits: () => '',
      assemblePrompt: () => 'prompt',
      getLatestRalphCommit: (() => {
        let sha = 0;
        return () => `sha${++sha}`.padEnd(40, '0');
      })(),
      execInContainer: () => ({ stdout: '', exitCode: 0 }),
    };

    const config = { ...baseConfig, maxIterations: 2 };
    const result = runLoop(config, deps);
    assert.equal(result.closedIssues.length, 1);
    assert.equal(result.closedIssues[0].number, 1);
    assert.equal(result.openIssues.length, 2);
  });

  it('calls fetchOpenIssues each iteration (fresh context)', () => {
    let fetchCount = 0;
    const deps: LoopDeps = {
      fetchOpenIssues: () => {
        fetchCount++;
        return [makeIssue(1)];
      },
      getRecentRalphCommits: () => '',
      assemblePrompt: () => 'prompt',
      getLatestRalphCommit: (() => {
        let sha = 0;
        return () => `sha${++sha}`.padEnd(40, '0');
      })(),
      execInContainer: () => ({ stdout: '', exitCode: 0 }),
    };

    const config = { ...baseConfig, maxIterations: 3 };
    runLoop(config, deps);
    // 1 initial + 3 iterations + 1 finish = 5
    assert.equal(fetchCount, 5);
  });
});
