import { execInContainer as defaultExecInContainer } from './docker';
import { getLatestRalphCommit as defaultGetLatestRalphCommit, getRecentRalphCommits as defaultGetRecentRalphCommits } from './git';
import { assemblePrompt as defaultAssemblePrompt, Issue } from './prompt';
import { fetchOpenIssues as defaultFetchOpenIssues } from './issues';

export interface LoopConfig {
  maxIterations: number;
  failureThreshold: number;
  verbose: boolean;
  projectDir: string;
}

export interface LoopDeps {
  fetchOpenIssues: (dir: string) => Issue[];
  execInContainer: (cmd: string[], verbose: boolean) => { stdout: string; exitCode: number };
  getLatestRalphCommit: (dir: string) => string | null;
  getRecentRalphCommits: (dir: string) => string;
  assemblePrompt: (issues: Issue[], commits: string) => string;
}

export interface LoopResult {
  iterations: number;
  successCount: number;
  reason: 'complete' | 'max_iterations' | 'circuit_breaker';
  closedIssues: Issue[];
  openIssues: Issue[];
}

const defaultDeps: LoopDeps = {
  fetchOpenIssues: defaultFetchOpenIssues,
  execInContainer: defaultExecInContainer,
  getLatestRalphCommit: defaultGetLatestRalphCommit,
  getRecentRalphCommits: defaultGetRecentRalphCommits,
  assemblePrompt: defaultAssemblePrompt,
};

const COMPLETE_SIGNAL = '<promise>COMPLETE</promise>';

export const runLoop = (config: LoopConfig, deps: LoopDeps = defaultDeps): LoopResult => {
  const { maxIterations, failureThreshold, verbose, projectDir } = config;

  let consecutiveFailures = 0;
  let successCount = 0;
  const initialIssues = deps.fetchOpenIssues(projectDir);

  const finish = (
    iterations: number,
    reason: LoopResult['reason'],
  ): LoopResult => {
    const remainingIssues = deps.fetchOpenIssues(projectDir);
    const remainingNumbers = new Set(remainingIssues.map((i) => i.number));
    const closedIssues = initialIssues.filter((i) => !remainingNumbers.has(i.number));
    return { iterations, successCount, reason, closedIssues, openIssues: remainingIssues };
  };

  for (let i = 1; i <= maxIterations; i++) {
    const issues = deps.fetchOpenIssues(projectDir);
    if (issues.length === 0) {
      console.log(`[${i}/${maxIterations}] No open issues remaining`);
      return finish(i, 'complete');
    }

    const recentCommits = deps.getRecentRalphCommits(projectDir);
    const prompt = deps.assemblePrompt(issues, recentCommits);
    const commitBefore = deps.getLatestRalphCommit(projectDir);

    console.log(`[${i}/${maxIterations}] Running RALPH iteration...`);
    const { stdout } = deps.execInContainer(
      ['claude', '-p', '--output-format', 'text', prompt],
      verbose,
    );

    if (stdout.includes(COMPLETE_SIGNAL)) {
      console.log(`[${i}/${maxIterations}] RALPH reports all issues complete`);
      return finish(i, 'complete');
    }

    const commitAfter = deps.getLatestRalphCommit(projectDir);
    const committed = commitAfter !== null && commitAfter !== commitBefore;

    if (committed) {
      consecutiveFailures = 0;
      successCount++;
      console.log(`[${i}/${maxIterations}] Success — commit ${commitAfter!.slice(0, 7)}`);
    } else {
      consecutiveFailures++;
      console.log(`[${i}/${maxIterations}] No RALPH commit produced (${consecutiveFailures}/${failureThreshold} consecutive failures)`);

      if (consecutiveFailures >= failureThreshold) {
        console.log(`Circuit breaker: ${failureThreshold} consecutive failures. Stopping.`);
        return finish(i, 'circuit_breaker');
      }
    }
  }

  return finish(maxIterations, 'max_iterations');
};
