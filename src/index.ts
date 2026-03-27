#!/usr/bin/env node

import { resolve } from 'path';
import { resolveConfig, printHelp } from './config';
import { resolveCredentials } from './credentials';
import { isDockerRunning, ensureImage, startContainer, stopContainer } from './docker';
import { isGitRepo, isClean, hasRemote, currentBranch, getRecentRalphCommits } from './git';
import { fetchOpenIssues } from './issues';
import { assemblePrompt } from './prompt';
import { runLoop } from './loop';
import { printSummary } from './reporter';

const projectDir = resolve(process.cwd());

const run = async (): Promise<void> => {
  const config = resolveConfig(projectDir);

  if (config.help) {
    printHelp();
    return;
  }

  // Pre-flight: credentials
  const credentials = resolveCredentials(projectDir);

  // Pre-flight: Docker
  if (!isDockerRunning()) {
    console.error('Error: Docker is not running. Start Docker and try again.');
    process.exit(1);
  }

  // Pre-flight: git
  if (!isGitRepo(projectDir)) {
    console.error('Error: Not a git repository. Run ifixit-cli from within a git repo.');
    process.exit(1);
  }

  if (!isClean(projectDir)) {
    console.error('Error: Working tree has uncommitted changes. Commit or stash them before running ifixit-cli.');
    process.exit(1);
  }

  if (!hasRemote(projectDir)) {
    console.error('Error: No remote origin configured. Add a remote origin and try again.');
    process.exit(1);
  }

  const branch = currentBranch(projectDir);
  console.log(`RALPH will commit to branch: ${branch}`);

  // Fetch issues
  const issues = fetchOpenIssues(projectDir);
  if (issues.length === 0) {
    console.log('No open non-PRD issues found. Nothing to do.');
    return;
  }
  console.log(`Found ${issues.length} open issue(s)`);

  // Dry run: show prompt and exit
  if (config.dryRun) {
    const recentCommits = getRecentRalphCommits(projectDir);
    const prompt = assemblePrompt(issues, recentCommits);
    console.log('\n--- DRY RUN: Assembled prompt ---\n');
    console.log(prompt);
    return;
  }

  // Ensure Docker image
  const dockerfilePath = resolve(__dirname, '..', 'Dockerfile');
  ensureImage(config.buildLocal, dockerfilePath);

  // Start container
  console.log('Starting container...');
  startContainer(projectDir, credentials);

  try {
    const result = await runLoop({
      maxIterations: config.maxIterations,
      failureThreshold: config.failureThreshold,
      verbose: config.verbose,
      debug: config.debug,
      interactive: config.interactive,
      projectDir,
    });

    printSummary(result);
  } finally {
    console.log('Stopping container...');
    stopContainer();
  }
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
