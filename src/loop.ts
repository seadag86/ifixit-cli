import { execInContainer as defaultExecInContainer } from './docker';
import {
  getLatestRalphCommit as defaultGetLatestRalphCommit,
  getRecentRalphCommits as defaultGetRecentRalphCommits,
  getCommitMessage as defaultGetCommitMessage,
  parseClosedIssues,
} from './git';
import { assemblePrompt as defaultAssemblePrompt, Issue } from './prompt';
import { fetchOpenIssues as defaultFetchOpenIssues, closeIssue as defaultCloseIssue } from './issues';

export interface LoopConfig {
  maxIterations: number;
  failureThreshold: number;
  verbose: boolean;
  debug: boolean;
  interactive: boolean;
  projectDir: string;
}

export interface LoopDeps {
  fetchOpenIssues: (dir: string) => Issue[];
  execInContainer: (cmd: string[], verbose: boolean) => { stdout: string; stderr: string; exitCode: number };
  getLatestRalphCommit: (dir: string) => string | null;
  getRecentRalphCommits: (dir: string) => string;
  getCommitMessage: (sha: string, dir: string) => string;
  assemblePrompt: (issues: Issue[], commits: string) => string;
  closeIssue: (issueNumber: number, dir: string) => void;
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
  getCommitMessage: defaultGetCommitMessage,
  assemblePrompt: defaultAssemblePrompt,
  closeIssue: defaultCloseIssue,
};

const COMPLETE_SIGNAL = '<promise>COMPLETE</promise>';
const SPINNER = ['◐', '◓', '◑', '◒'];

type Phase = 'fetching issues' | 'assembling prompt' | 'running claude' | 'checking commits';

const formatDuration = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const renderStatus = (
  frame: number,
  i: number,
  maxIterations: number,
  phase: Phase,
  iterStart: number,
  loopStart: number,
  failures: number,
): void => {
  const now = Date.now();
  const spinner = SPINNER[frame % SPINNER.length];
  const line = `[${i}/${maxIterations}] ${spinner} ${phase}  (iter: ${formatDuration(now - iterStart)} | total: ${formatDuration(now - loopStart)} | failures: ${failures})`;
  process.stdout.write(`\r${line.padEnd(100)}`);
};

const log = (interactive: boolean, msg: string): void => {
  if (interactive) {
    process.stdout.write(`\r${msg.padEnd(100)}\n`);
  } else {
    console.log(msg);
  }
};

export const runLoop = (config: LoopConfig, deps: LoopDeps = defaultDeps): LoopResult => {
  const { maxIterations, failureThreshold, verbose, debug, interactive, projectDir } = config;

  let consecutiveFailures = 0;
  let successCount = 0;
  let frame = 0;
  const loopStart = Date.now();
  const initialIssues = deps.fetchOpenIssues(projectDir);

  const finish = (iterations: number, reason: LoopResult['reason']): LoopResult => {
    if (interactive) process.stdout.write('\n');
    const remainingIssues = deps.fetchOpenIssues(projectDir);
    const remainingNumbers = new Set(remainingIssues.map((i) => i.number));
    const closedIssues = initialIssues.filter((i) => !remainingNumbers.has(i.number));
    return { iterations, successCount, reason, closedIssues, openIssues: remainingIssues };
  };

  for (let i = 1; i <= maxIterations; i++) {
    const iterStart = Date.now();

    if (interactive) renderStatus(frame++, i, maxIterations, 'fetching issues', iterStart, loopStart, consecutiveFailures);
    const issues = deps.fetchOpenIssues(projectDir);
    if (issues.length === 0) {
      log(interactive, `[${i}/${maxIterations}] No open issues remaining`);
      return finish(i, 'complete');
    }

    if (interactive) renderStatus(frame++, i, maxIterations, 'assembling prompt', iterStart, loopStart, consecutiveFailures);
    const recentCommits = deps.getRecentRalphCommits(projectDir);
    const prompt = deps.assemblePrompt(issues, recentCommits);
    const commitBefore = deps.getLatestRalphCommit(projectDir);

    if (interactive) {
      renderStatus(frame++, i, maxIterations, 'running claude', iterStart, loopStart, consecutiveFailures);
    } else {
      console.log(`[${i}/${maxIterations}] Running RALPH iteration...`);
    }
    const { stdout, stderr, exitCode } = deps.execInContainer(
      ['claude', '-p', '--dangerously-skip-permissions', '--output-format', 'text', prompt],
      verbose,
    );

    if (debug) {
      console.log(`[DEBUG] exit code: ${exitCode}`);
      if (stdout) console.log(`[DEBUG] stdout:\n${stdout}`);
      if (stderr) console.log(`[DEBUG] stderr:\n${stderr}`);
    }

    if (stdout.includes(COMPLETE_SIGNAL)) {
      log(interactive, `[${i}/${maxIterations}] RALPH reports all issues complete`);
      return finish(i, 'complete');
    }

    if (interactive) renderStatus(frame++, i, maxIterations, 'checking commits', iterStart, loopStart, consecutiveFailures);
    const commitAfter = deps.getLatestRalphCommit(projectDir);
    const committed = commitAfter !== null && commitAfter !== commitBefore;

    if (committed) {
      consecutiveFailures = 0;
      successCount++;
      log(interactive, `[${i}/${maxIterations}] Success — commit ${commitAfter!.slice(0, 7)}`);

      const message = deps.getCommitMessage(commitAfter!, projectDir);
      const issueNumbers = parseClosedIssues(message);
      for (const n of issueNumbers) {
        deps.closeIssue(n, projectDir);
      }
    } else {
      consecutiveFailures++;
      log(interactive, `[${i}/${maxIterations}] No RALPH commit produced (${consecutiveFailures}/${failureThreshold} consecutive failures)`);

      if (consecutiveFailures >= failureThreshold) {
        log(interactive, `Circuit breaker: ${failureThreshold} consecutive failures. Stopping.`);
        return finish(i, 'circuit_breaker');
      }
    }
  }

  return finish(maxIterations, 'max_iterations');
};
