import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformIssues, GhIssue } from './issues';

const makeGhIssue = (overrides: Partial<GhIssue> = {}): GhIssue => ({
  number: 1,
  title: 'Test issue',
  body: 'Some body',
  labels: [{ name: 'bug' }],
  comments: [{ body: 'a comment', author: { login: 'alice' }, createdAt: '2026-01-01T00:00:00Z' }],
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('transformIssues', () => {
  it('filters out issues with titles starting with PRD', () => {
    const issues = [
      makeGhIssue({ number: 1, title: 'PRD: Build auth system' }),
      makeGhIssue({ number: 2, title: 'Fix login bug' }),
    ];
    const result = transformIssues(issues);
    assert.equal(result.length, 1);
    assert.equal(result[0].number, 2);
  });

  it('preserves issues with PRD elsewhere in title', () => {
    const issues = [
      makeGhIssue({ number: 1, title: 'Fix PRD rendering' }),
    ];
    const result = transformIssues(issues);
    assert.equal(result.length, 1);
  });

  it('maps labels from objects to strings', () => {
    const issues = [
      makeGhIssue({ labels: [{ name: 'bug' }, { name: 'urgent' }] }),
    ];
    const result = transformIssues(issues);
    assert.deepEqual(result[0].labels, ['bug', 'urgent']);
  });

  it('formats comments as author (date): body', () => {
    const issues = [
      makeGhIssue({
        comments: [
          { body: 'looks good', author: { login: 'bob' }, createdAt: '2026-03-01T12:00:00Z' },
        ],
      }),
    ];
    const result = transformIssues(issues);
    assert.equal(result[0].comments[0], 'bob (2026-03-01T12:00:00Z): looks good');
  });

  it('includes createdAt field', () => {
    const issues = [makeGhIssue({ createdAt: '2026-02-15T00:00:00Z' })];
    const result = transformIssues(issues);
    assert.equal(result[0].createdAt, '2026-02-15T00:00:00Z');
  });

  it('returns empty array when input is empty', () => {
    assert.deepEqual(transformIssues([]), []);
  });

  it('returns empty array when all issues are PRD-titled', () => {
    const issues = [
      makeGhIssue({ title: 'PRD: Feature A' }),
      makeGhIssue({ title: 'PRD Feature B' }),
    ];
    const result = transformIssues(issues);
    assert.equal(result.length, 0);
  });

  it('defaults body to empty string when null', () => {
    const issues = [makeGhIssue({ body: null as any })];
    const result = transformIssues(issues);
    assert.equal(result[0].body, '');
  });
});
