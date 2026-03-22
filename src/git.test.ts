import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { isGitRepo, isClean, hasRemote, currentBranch, getLatestRalphCommit, getRecentRalphCommits } from './git';

const gitIn = (dir: string, args: string[]) =>
  execFileSync('git', args, { cwd: dir, encoding: 'utf-8', stdio: 'pipe' });

describe('git', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'ifixit-cli-git-test-'));
    gitIn(repoDir, ['init']);
    gitIn(repoDir, ['config', 'user.email', 'test@test.com']);
    gitIn(repoDir, ['config', 'user.name', 'Test']);
    writeFileSync(join(repoDir, 'file.txt'), 'initial');
    gitIn(repoDir, ['add', '.']);
    gitIn(repoDir, ['commit', '-m', 'initial commit']);
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('isGitRepo returns true inside a git repo', () => {
    assert.equal(isGitRepo(repoDir), true);
  });

  it('isGitRepo returns false outside a git repo', () => {
    const nonRepo = mkdtempSync(join(tmpdir(), 'ifixit-cli-non-repo-'));
    assert.equal(isGitRepo(nonRepo), false);
    rmSync(nonRepo, { recursive: true, force: true });
  });

  it('isClean returns true with no changes', () => {
    assert.equal(isClean(repoDir), true);
  });

  it('isClean returns false with uncommitted changes', () => {
    writeFileSync(join(repoDir, 'file.txt'), 'modified');
    assert.equal(isClean(repoDir), false);
  });

  it('hasRemote returns false when no origin', () => {
    assert.equal(hasRemote(repoDir), false);
  });

  it('hasRemote returns true when origin exists', () => {
    gitIn(repoDir, ['remote', 'add', 'origin', 'https://example.com/repo.git']);
    assert.equal(hasRemote(repoDir), true);
  });

  it('currentBranch returns active branch name', () => {
    const branch = currentBranch(repoDir);
    assert.ok(typeof branch === 'string' && branch.length > 0);
  });

  it('getLatestRalphCommit returns null when no RALPH commits', () => {
    assert.equal(getLatestRalphCommit(repoDir), null);
  });

  it('getLatestRalphCommit returns SHA of RALPH commit', () => {
    writeFileSync(join(repoDir, 'file.txt'), 'ralph change');
    gitIn(repoDir, ['add', '.']);
    gitIn(repoDir, ['commit', '-m', 'RALPH: test commit']);
    const sha = getLatestRalphCommit(repoDir);
    assert.ok(sha !== null && sha.length === 40);
  });

  it('getRecentRalphCommits returns empty string when none', () => {
    assert.equal(getRecentRalphCommits(repoDir), '');
  });

  it('getRecentRalphCommits returns formatted log', () => {
    writeFileSync(join(repoDir, 'file.txt'), 'change1');
    gitIn(repoDir, ['add', '.']);
    gitIn(repoDir, ['commit', '-m', 'RALPH: first task']);
    writeFileSync(join(repoDir, 'file.txt'), 'change2');
    gitIn(repoDir, ['add', '.']);
    gitIn(repoDir, ['commit', '-m', 'RALPH: second task']);
    const log = getRecentRalphCommits(repoDir);
    assert.ok(log.includes('RALPH: first task'));
    assert.ok(log.includes('RALPH: second task'));
  });
});
