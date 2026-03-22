import { readFileSync } from 'fs';
import { join } from 'path';

export interface Issue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  comments: string[];
  createdAt: string;
}

export const assemblePrompt = (
  issues: Issue[],
  recentCommits: string,
): string => {
  const promptTemplate = readFileSync(
    join(__dirname, '..', 'prompt.md'),
    'utf-8',
  );

  const sections = [
    '## CONTEXT',
    '',
    '### Open Issues',
    '```json',
    JSON.stringify(issues, null, 2),
    '```',
    '',
    '### Recent RALPH Commits',
    '```',
    recentCommits || '(none)',
    '```',
    '',
    '---',
    '',
    promptTemplate,
  ];

  return sections.join('\n');
};

export const mockIssues: Issue[] = [
  {
    number: 1,
    title: 'Sample issue for tracer bullet',
    body: 'This is a mock issue used during Phase 1 development. Claude should attempt to work on this.',
    labels: ['enhancement'],
    comments: [],
    createdAt: new Date().toISOString(),
  },
];
