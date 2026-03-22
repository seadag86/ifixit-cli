import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePrompt, Issue } from './prompt';

const sampleIssues: Issue[] = [
  {
    number: 42,
    title: 'Add user validation',
    body: 'We need input validation on the signup form.',
    labels: ['enhancement'],
    comments: ['alice (2026-01-01): +1 on this'],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    number: 7,
    title: 'Fix login redirect',
    body: 'Login redirects to 404.',
    labels: ['bug'],
    comments: [],
    createdAt: '2026-01-02T00:00:00Z',
  },
];

const sampleCommits = 'abc1234 2026-01-15 12:00:00 +0000 RALPH: Fix auth flow\ndef5678 2026-01-14 12:00:00 +0000 RALPH: Add signup page';

describe('assemblePrompt', () => {
  it('includes issues JSON in the output', () => {
    const prompt = assemblePrompt(sampleIssues, sampleCommits);
    assert.ok(prompt.includes('"number": 42'));
    assert.ok(prompt.includes('"title": "Add user validation"'));
    assert.ok(prompt.includes('"number": 7'));
  });

  it('includes recent commits in the output', () => {
    const prompt = assemblePrompt(sampleIssues, sampleCommits);
    assert.ok(prompt.includes('abc1234'));
    assert.ok(prompt.includes('RALPH: Fix auth flow'));
  });

  it('shows (none) when no commits', () => {
    const prompt = assemblePrompt(sampleIssues, '');
    assert.ok(prompt.includes('(none)'));
  });

  it('includes prompt.md content', () => {
    const prompt = assemblePrompt(sampleIssues, sampleCommits);
    assert.ok(prompt.includes('TASK SELECTION'));
    assert.ok(prompt.includes('RALPH:'));
  });

  it('has context sections before prompt template', () => {
    const prompt = assemblePrompt(sampleIssues, sampleCommits);
    const contextIndex = prompt.indexOf('## CONTEXT');
    const taskIndex = prompt.indexOf('# TASK SELECTION');
    assert.ok(contextIndex < taskIndex);
  });
});
