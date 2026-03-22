import { execFileSync, spawnSync, ExecSyncOptions } from 'child_process';
import { Credentials } from './credentials';

const IMAGE_NAME = 'ifixit-cli';
const GHCR_IMAGE = 'ghcr.io/ifixit-cli/ifixit-cli:latest';
const CONTAINER_NAME = 'ifixit-cli-ralph';

const execOpts: ExecSyncOptions = { stdio: 'pipe', encoding: 'utf-8' };

export const isDockerRunning = (): boolean => {
  try {
    execFileSync('docker', ['info'], { ...execOpts, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const imageExists = (): boolean => {
  try {
    const result = execFileSync('docker', ['images', '-q', IMAGE_NAME], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return result.trim().length > 0;
  } catch {
    return false;
  }
};

export const pullImage = (): void => {
  console.log(`Pulling image ${GHCR_IMAGE}...`);
  execFileSync('docker', ['pull', GHCR_IMAGE], { stdio: 'inherit' });
  execFileSync('docker', ['tag', GHCR_IMAGE, IMAGE_NAME], execOpts);
};

export const buildImage = (dockerfilePath: string): void => {
  execFileSync('docker', ['build', '-t', IMAGE_NAME, '-f', dockerfilePath, '.'], {
    stdio: 'inherit',
    cwd: dockerfilePath.replace(/\/Dockerfile$/, ''),
  });
};

export const ensureImage = (buildLocal: boolean, dockerfilePath: string): void => {
  if (buildLocal) {
    console.log('Building Docker image locally...');
    buildImage(dockerfilePath);
    return;
  }

  if (imageExists()) {
    return;
  }

  try {
    pullImage();
  } catch {
    console.log('Failed to pull image, building locally...');
    buildImage(dockerfilePath);
  }
};

export const startContainer = (
  projectDir: string,
  credentials: Credentials,
): void => {
  try {
    execFileSync('docker', ['rm', '-f', CONTAINER_NAME], execOpts);
  } catch {
    // container didn't exist
  }

  execFileSync('docker', [
    'run', '-d',
    '--name', CONTAINER_NAME,
    '-v', `${projectDir}:/home/agent/repos`,
    '-e', `CLAUDE_CODE_OAUTH_TOKEN=${credentials.claudeToken}`,
    '-e', `GH_TOKEN=${credentials.ghToken}`,
    '-w', '/home/agent/repos',
    IMAGE_NAME,
  ], execOpts);
};

export const execInContainer = (
  command: string[],
  verbose: boolean = false,
): { stdout: string; stderr: string; exitCode: number } => {
  if (verbose) {
    const result = spawnSync('docker', [
      'exec', '-w', '/home/agent/repos', CONTAINER_NAME, ...command,
    ], {
      encoding: 'utf-8',
      stdio: ['pipe', 'inherit', 'inherit'],
      maxBuffer: 50 * 1024 * 1024,
    });
    return { stdout: '', stderr: '', exitCode: result.status ?? 1 };
  }

  const result = spawnSync('docker', [
    'exec', '-w', '/home/agent/repos', CONTAINER_NAME, ...command,
  ], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 50 * 1024 * 1024,
  });

  return {
    stdout: (result.stdout ?? '').toString(),
    stderr: (result.stderr ?? '').toString(),
    exitCode: result.status ?? 1,
  };
};

export const stopContainer = (): void => {
  try {
    execFileSync('docker', ['rm', '-f', CONTAINER_NAME], execOpts);
  } catch {
    // already gone
  }
};
