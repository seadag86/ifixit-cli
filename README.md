# ifixit-cli

![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)

> **This project is in early alpha.** It works, but it hasn't been battle-tested across diverse repos and workflows. Expect rough edges, breaking changes, and missing guardrails. Feedback and bug reports are very welcome — see [Contributing](#contributing) below.

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

## Contributing

Contributions are welcome — this is an alpha project and there's plenty to improve.

### Getting Started

1. Fork the repo and clone your fork
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run tests: `npm test`
5. Use `npm run dev` for watch mode during development

### Submitting Changes

1. Create a branch from `main` for your work (`git checkout -b feat/my-change`)
2. Make your changes, keeping commits atomic and focused
3. Ensure `npm run build && npm test` passes before pushing
4. Open a pull request against `main` with a clear description of what and why

### Guidelines

- **Bug reports** — Open an issue with steps to reproduce, expected behavior, and actual behavior
- **Feature requests** — Open an issue describing the use case before starting work, so we can discuss the approach
- **Code style** — TypeScript strict mode, follow existing patterns in the codebase
- **Tests** — Add tests for new functionality; the project uses Node's built-in test runner (`node:test`)
- **Commits** — Use [conventional commit](https://www.conventionalcommits.org/) prefixes (`feat`, `fix`, `refactor`, `test`, `docs`)

### What Could Use Help

- Testing against different repo sizes and issue volumes
- Better error messages and recovery from edge cases
- Documentation improvements

## Acknowledgments

The RALPH loop concept in this project is inspired by [Matt Pocock's sandcastle CLI](https://github.com/mattpocock). Built with AI assistance.

## License

ISC
