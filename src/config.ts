import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface IfixitCliConfig {
  maxIterations: number;
  failureThreshold: number;
  verbose: boolean;
  debug: boolean;
  dryRun: boolean;
  buildLocal: boolean;
  help: boolean;
  interactive: boolean;
}

interface PartialConfig {
  maxIterations?: number;
  failureThreshold?: number;
}

const DEFAULTS: IfixitCliConfig = {
  maxIterations: 100,
  failureThreshold: 3,
  verbose: false,
  debug: false,
  dryRun: false,
  buildLocal: false,
  help: false,
  interactive: false,
};

const loadProjectConfig = (projectDir: string): PartialConfig => {
  const configPath = join(projectDir, '.ifixit-cli.json');
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
};

const HELP_TEXT = `
ifixit-cli - Run RALPH loops with Claude Code

Usage: ifixit-cli [options]

Options:
  -n, --max-iterations <num>    Max loop iterations (default: 100)
  -f, --failure-threshold <num> Consecutive failures before stopping (default: 3)
  -i, --interactive             Show live status line (phase, elapsed time, failures)
  -v, --verbose                 Stream Claude Code output in real-time
  -d, --debug                   Print stdout, stderr, and exit code after each iteration
  --dry-run                     Show assembled prompt without executing
  --build                       Build Docker image locally instead of pulling
  -h, --help                    Show this help message
`.trim();

export const printHelp = (): void => {
  console.log(HELP_TEXT);
};

const parseArgs = (argv: string[]): PartialConfig & { verbose?: boolean; debug?: boolean; dryRun?: boolean; buildLocal?: boolean; help?: boolean; interactive?: boolean } => {
  const parsed: PartialConfig & { verbose?: boolean; debug?: boolean; dryRun?: boolean; buildLocal?: boolean; help?: boolean; interactive?: boolean } = {};
  const args = argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-h':
      case '--help':
        parsed.help = true;
        return parsed;
      case '-n':
      case '--max-iterations': {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 1) {
          throw new Error(`Invalid value for ${arg}: must be a positive integer`);
        }
        parsed.maxIterations = val;
        break;
      }
      case '-f':
      case '--failure-threshold': {
        const val = parseInt(args[++i], 10);
        if (isNaN(val) || val < 1) {
          throw new Error(`Invalid value for ${arg}: must be a positive integer`);
        }
        parsed.failureThreshold = val;
        break;
      }
      case '-i':
      case '--interactive':
        parsed.interactive = true;
        break;
      case '-v':
      case '--verbose':
        parsed.verbose = true;
        break;
      case '-d':
      case '--debug':
        parsed.debug = true;
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--build':
        parsed.buildLocal = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
};

export const resolveConfig = (projectDir: string): IfixitCliConfig => {
  const projectConfig = loadProjectConfig(projectDir);
  const cliConfig = parseArgs(process.argv);

  return {
    maxIterations: cliConfig.maxIterations ?? projectConfig.maxIterations ?? DEFAULTS.maxIterations,
    failureThreshold: cliConfig.failureThreshold ?? projectConfig.failureThreshold ?? DEFAULTS.failureThreshold,
    verbose: cliConfig.verbose ?? DEFAULTS.verbose,
    debug: cliConfig.debug ?? DEFAULTS.debug,
    dryRun: cliConfig.dryRun ?? DEFAULTS.dryRun,
    buildLocal: cliConfig.buildLocal ?? DEFAULTS.buildLocal,
    help: cliConfig.help ?? DEFAULTS.help,
    interactive: cliConfig.interactive ?? DEFAULTS.interactive,
  };
};
