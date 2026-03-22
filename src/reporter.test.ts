import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { printSummary } from './reporter';
import { LoopResult } from './loop';

describe('printSummary', () => {
  let output: string[];
  const originalLog = console.log;

  beforeEach(() => {
    output = [];
    console.log = (...args: any[]) => output.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('shows closed issues', () => {
    const result: LoopResult = {
      iterations: 5,
      successCount: 3,
      reason: 'complete',
      closedIssues: [
        { number: 42, title: 'Add validation', body: '', labels: [], comments: [], createdAt: '' },
      ],
      openIssues: [],
    };
    printSummary(result);
    const joined = output.join('\n');
    assert.ok(joined.includes('#42 Add validation'));
    assert.ok(joined.includes('Commits: 3'));
    assert.ok(joined.includes('All non-PRD issues resolved'));
  });

  it('shows open issues', () => {
    const result: LoopResult = {
      iterations: 100,
      successCount: 10,
      reason: 'max_iterations',
      closedIssues: [],
      openIssues: [
        { number: 99, title: 'Still open', body: '', labels: [], comments: [], createdAt: '' },
      ],
    };
    printSummary(result);
    const joined = output.join('\n');
    assert.ok(joined.includes('#99 Still open'));
    assert.ok(joined.includes('Max iterations reached'));
  });

  it('shows circuit breaker reason', () => {
    const result: LoopResult = {
      iterations: 3,
      successCount: 0,
      reason: 'circuit_breaker',
      closedIssues: [],
      openIssues: [],
    };
    printSummary(result);
    const joined = output.join('\n');
    assert.ok(joined.includes('Consecutive failure threshold reached'));
  });
});
