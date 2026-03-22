# ifixit-cli

A CLI that runs RALPH loops — automated, iterative development powered by Claude Code. Point it at a repo with open GitHub issues and let it work through them one by one inside a Docker container, committing progress along the way.

## Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [Docker](https://www.docker.com/) (running)
- [GitHub CLI](https://cli.github.com/) (`gh`) installed and authenticated
- A GitHub repo with open issues

## Installation

Clone the repo and install globally:

```bash
git clone https://github.com/your-org/ifixit-cli.git
cd ifixit-cli
npm install
npm run build
npm link
```

`ifixit-cli` is now available as a terminal command.

## Authentication

ifixit-cli needs two tokens passed as environment variables or in a `.env` file in your project root:

```bash
export CLAUDE_CODE_OAUTH_TOKEN=your-claude-token
export GH_TOKEN=your-github-token
```

Or create a `.env` file in the project where you'll run ifixit-cli:

```
CLAUDE_CODE_OAUTH_TOKEN=your-claude-token
GH_TOKEN=your-github-token
```

Environment variables take precedence over `.env` values.

## Usage

Navigate to any git repo with open GitHub issues and run:

```bash
ifixit-cli
```

ifixit-cli will:

1. Verify prerequisites (Docker running, clean git repo, remote origin, credentials)
2. Fetch open issues (excluding any with titles starting with "PRD")
3. Start a Docker container with Claude Code
4. Loop through issues, letting Claude pick and complete tasks based on priority
5. Check for `RALPH:` prefixed commits after each iteration
6. Stop when all issues are resolved, max iterations reached, or 3 consecutive failures occur
7. Print a summary of what was closed, what's still open, and why the loop stopped

### Options

```
ifixit-cli [options]

  -n, --max-iterations <num>    Max loop iterations (default: 100)
  -f, --failure-threshold <num> Consecutive failures before stopping (default: 3)
  -v, --verbose                 Stream Claude Code output in real-time
  --dry-run                     Show the assembled prompt without executing
  --build                       Build Docker image locally instead of pulling
  -h, --help                    Show help message
```

### Examples

Run with a limit of 5 iterations:

```bash
ifixit-cli -n 5
```

Preview what Claude will see without running anything:

```bash
ifixit-cli --dry-run
```

Watch Claude work in real-time:

```bash
ifixit-cli -v
```

Build the Docker image locally instead of pulling:

```bash
ifixit-cli --build
```

### Project Configuration

Add a `.ifixit-cli.json` to your project root to set per-project defaults:

```json
{
  "maxIterations": 50,
  "failureThreshold": 5
}
```

Config precedence: CLI flags > `.ifixit-cli.json` > package defaults.

## How RALPH Works

Each iteration:

1. Fetches current open issues and recent RALPH commits
2. Assembles a prompt with full issue context (titles, bodies, comments, labels, dates)
3. Runs `claude -p` inside the container with a fresh context
4. Claude picks a task using this priority: critical bugs > tracer bullets > polish > refactors
5. Claude works the task, commits with a `RALPH:` prefix, and closes the issue (or comments if partial)

The loop ends when:
- Claude reports all issues complete
- Max iterations reached (default: 100)
- 3 consecutive iterations produce no commit (circuit breaker)

## Uninstall

```bash
npm unlink ifixit-cli
```

If you installed from a cloned repo, you can also remove the directory:

```bash
rm -rf /path/to/ifixit-cli
```

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run tests (build first)
npm run dev          # Watch mode
```

## License

ISC
