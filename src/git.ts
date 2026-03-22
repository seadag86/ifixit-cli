import { execFileSync } from 'child_process';

const git = (args: string[], cwd: string): string => {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  }).trim();
};

export const isGitRepo = (dir: string): boolean => {
  try {
    git(['rev-parse', '--is-inside-work-tree'], dir);
    return true;
  } catch {
    return false;
  }
};

export const isClean = (dir: string): boolean => {
  const status = git(['status', '--porcelain'], dir);
  return status === '';
};

export const hasRemote = (dir: string): boolean => {
  try {
    git(['remote', 'get-url', 'origin'], dir);
    return true;
  } catch {
    return false;
  }
};

export const currentBranch = (dir: string): string => {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], dir);
};

export const getLatestRalphCommit = (dir: string): string | null => {
  try {
    const log = git(['log', '-1', '--format=%H', '--grep=^RALPH:', '--regexp-ignore-case'], dir);
    return log || null;
  } catch {
    return null;
  }
};

export const getRecentRalphCommits = (dir: string, count: number = 10): string => {
  try {
    return git([
      'log', `--max-count=${count}`,
      '--grep=^RALPH:',
      '--regexp-ignore-case',
      '--format=%H %ai %s',
    ], dir);
  } catch {
    return '';
  }
};
