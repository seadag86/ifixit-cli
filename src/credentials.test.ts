import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveCredentials } from './credentials';

describe('resolveCredentials', () => {
  const testDir = join(tmpdir(), `ifixit-cli-cred-test-${Date.now()}`);
  const envPath = join(testDir, '.env');
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    savedEnv.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    savedEnv.GH_TOKEN = process.env.GH_TOKEN;
  });

  afterEach(() => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = savedEnv.CLAUDE_CODE_OAUTH_TOKEN;
    process.env.GH_TOKEN = savedEnv.GH_TOKEN;
    if (existsSync(envPath)) unlinkSync(envPath);
  });

  it('returns credentials from env vars', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'token-a';
    process.env.GH_TOKEN = 'token-b';
    const creds = resolveCredentials(testDir);
    assert.equal(creds.claudeToken, 'token-a');
    assert.equal(creds.ghToken, 'token-b');
  });

  it('falls back to .env file when env vars are missing', () => {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.GH_TOKEN;
    writeFileSync(envPath, 'CLAUDE_CODE_OAUTH_TOKEN=file-a\nGH_TOKEN=file-b\n');
    const creds = resolveCredentials(testDir);
    assert.equal(creds.claudeToken, 'file-a');
    assert.equal(creds.ghToken, 'file-b');
  });

  it('env vars take precedence over .env file', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'env-a';
    process.env.GH_TOKEN = 'env-b';
    writeFileSync(envPath, 'CLAUDE_CODE_OAUTH_TOKEN=file-a\nGH_TOKEN=file-b\n');
    const creds = resolveCredentials(testDir);
    assert.equal(creds.claudeToken, 'env-a');
    assert.equal(creds.ghToken, 'env-b');
  });

  it('throws when CLAUDE_CODE_OAUTH_TOKEN is missing', () => {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    process.env.GH_TOKEN = 'token-b';
    assert.throws(
      () => resolveCredentials(testDir),
      /CLAUDE_CODE_OAUTH_TOKEN is not set/,
    );
  });

  it('throws when GH_TOKEN is missing', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'token-a';
    delete process.env.GH_TOKEN;
    assert.throws(
      () => resolveCredentials(testDir),
      /GH_TOKEN is not set/,
    );
  });

  it('handles .env file with comments and blank lines', () => {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.GH_TOKEN;
    writeFileSync(envPath, '# this is a comment\n\nCLAUDE_CODE_OAUTH_TOKEN=val-a\n\n# another comment\nGH_TOKEN=val-b\n');
    const creds = resolveCredentials(testDir);
    assert.equal(creds.claudeToken, 'val-a');
    assert.equal(creds.ghToken, 'val-b');
  });

  it('works when .env file does not exist and env vars are set', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'token-a';
    process.env.GH_TOKEN = 'token-b';
    const creds = resolveCredentials(testDir);
    assert.equal(creds.claudeToken, 'token-a');
    assert.equal(creds.ghToken, 'token-b');
  });
});
