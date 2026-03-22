import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface Credentials {
  claudeToken: string;
  ghToken: string;
}

const parseEnvFile = (filePath: string): Record<string, string> => {
  const content = readFileSync(filePath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
};

export const resolveCredentials = (projectDir: string): Credentials => {
  let claudeToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  let ghToken = process.env.GH_TOKEN;

  if ((!claudeToken || !ghToken)) {
    const envPath = join(projectDir, '.env');
    if (existsSync(envPath)) {
      const fileEnv = parseEnvFile(envPath);
      claudeToken = claudeToken || fileEnv.CLAUDE_CODE_OAUTH_TOKEN;
      ghToken = ghToken || fileEnv.GH_TOKEN;
    }
  }

  if (!claudeToken) {
    throw new Error(
      'CLAUDE_CODE_OAUTH_TOKEN is not set. Export it as an environment variable or add it to a .env file in the project root.',
    );
  }

  if (!ghToken) {
    throw new Error(
      'GH_TOKEN is not set. Export it as an environment variable or add it to a .env file in the project root.',
    );
  }

  return { claudeToken, ghToken };
};
