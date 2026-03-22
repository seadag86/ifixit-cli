import { execFileSync } from 'child_process';
import { Issue } from './prompt';

export interface GhIssue {
  number: number;
  title: string;
  body: string;
  labels: { name: string }[];
  comments: { body: string; author: { login: string }; createdAt: string }[];
  createdAt: string;
}

export const transformIssues = (ghIssues: GhIssue[]): Issue[] => {
  return ghIssues
    .filter((issue) => !issue.title.startsWith('PRD'))
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      labels: issue.labels.map((l) => l.name),
      comments: issue.comments.map(
        (c) => `${c.author.login} (${c.createdAt}): ${c.body}`,
      ),
      createdAt: issue.createdAt,
    }));
};

export const fetchOpenIssues = (projectDir: string): Issue[] => {
  const raw = execFileSync('gh', [
    'issue', 'list',
    '--state', 'open',
    '--json', 'number,title,body,labels,comments,createdAt',
    '--limit', '200',
  ], {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  return transformIssues(JSON.parse(raw));
};
