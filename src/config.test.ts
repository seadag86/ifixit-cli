import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { resolveConfig } from './config';

const testDir = join(__dirname, '..');
const ifixitCliJson = join(testDir, '.ifixit-cli.json');

describe('resolveConfig', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
    if (existsSync(ifixitCliJson)) {
      unlinkSync(ifixitCliJson);
    }
  });

  it('returns defaults when no flags or project config', () => {
    process.argv = ['node', 'ifixit-cli'];
    const config = resolveConfig(testDir);
    assert.equal(config.maxIterations, 100);
    assert.equal(config.failureThreshold, 3);
    assert.equal(config.verbose, false);
    assert.equal(config.dryRun, false);
    assert.equal(config.buildLocal, false);
  });

  it('reads .ifixit-cli.json from project dir', () => {
    writeFileSync(ifixitCliJson, JSON.stringify({ maxIterations: 50, failureThreshold: 5 }));
    process.argv = ['node', 'ifixit-cli'];
    const config = resolveConfig(testDir);
    assert.equal(config.maxIterations, 50);
    assert.equal(config.failureThreshold, 5);
  });

  it('CLI flags override .ifixit-cli.json', () => {
    writeFileSync(ifixitCliJson, JSON.stringify({ maxIterations: 50 }));
    process.argv = ['node', 'ifixit-cli', '-n', '10'];
    const config = resolveConfig(testDir);
    assert.equal(config.maxIterations, 10);
  });

  it('parses all flags', () => {
    process.argv = ['node', 'ifixit-cli', '-n', '25', '-f', '5', '-v', '--dry-run', '--build'];
    const config = resolveConfig(testDir);
    assert.equal(config.maxIterations, 25);
    assert.equal(config.failureThreshold, 5);
    assert.equal(config.verbose, true);
    assert.equal(config.dryRun, true);
    assert.equal(config.buildLocal, true);
  });

  it('throws on invalid flag values', () => {
    process.argv = ['node', 'ifixit-cli', '-n', 'abc'];
    assert.throws(() => resolveConfig(testDir), /Invalid value/);
  });

  it('throws on unknown flags', () => {
    process.argv = ['node', 'ifixit-cli', '--unknown'];
    assert.throws(() => resolveConfig(testDir), /Unknown option/);
  });
});
