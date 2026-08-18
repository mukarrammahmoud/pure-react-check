# pure-react-check

`pure-react-check` is a static analysis CLI that scans React JavaScript and TypeScript files for render-phase code that can violate component purity or cause React Compiler optimization bailouts.

It parses source code with Babel, reports the exact file and line for each issue, recommends a fix, and calculates a Compiler Readiness Score for the scanned project.

## What It Checks

The v1 ruleset detects:

- `no-render-mutation`: assignments and `ref.current` mutations during render.
- `no-impure-calls`: calls such as `Math.random()` and `Date.now()` during render.
- `no-set-state-in-render`: direct `setState`-style or `dispatch(...)` calls during render.
- `no-prop-state-mutation`: mutations of props, state objects, or arrays.
- `no-nested-components`: component definitions inside another component.
- `no-dom-globals-in-render`: render-time access to `document`, `window`, storage APIs, `fetch`, and similar browser side effects.

Calls inside event handlers, effects, and nested callbacks are excluded where appropriate.

## Supported Files

The scanner searches for:

```text
*.js
*.jsx
*.ts
*.tsx
```

`node_modules` is excluded automatically.

## Quick Start

Run the package without installing it globally:

```bash
npx pure-react-check
```

When run without arguments in an interactive terminal, the CLI asks for:

```text
Scan target [./]:
Output format (terminal/html) [terminal]:
Minimum readiness threshold (optional):
```

Press Enter to accept a displayed default.

## Install In A Project

With pnpm:

```bash
pnpm add -D pure-react-check
```

Then run:

```bash
pnpm pure-react-check
```

With npm:

```bash
npm install --save-dev pure-react-check
npx pure-react-check
```

## Scan Targets

Scan the current project:

```bash
npx pure-react-check
```

Scan a source directory:

```bash
npx pure-react-check ./src
```

Scan one file:

```bash
npx pure-react-check ./src/App.tsx
```

Scan using a glob pattern:

```bash
npx pure-react-check "src/**/*.{ts,tsx}"
```

Quote glob patterns so the CLI receives the complete pattern consistently across shells.

## Terminal Report

Terminal output is the default:

```bash
npx pure-react-check ./src --format terminal
```

Violations are grouped by file and include:

- Rule ID
- Source line number
- Violation message
- Recommended fix
- Total scanned files
- Total violations and parse errors
- Compiler Readiness Score

## HTML Report

Generate a standalone HTML dashboard:

```bash
npx pure-react-check ./src --format html
```

The command creates this file in the directory where the command was run:

```text
index.html
```

The report contains:

- Compiler Readiness Score
- Total scanned files
- Clean files count
- Total violations
- Violations grouped by source file
- Rule badges, line numbers, messages, and fix advice
- Parse errors, when present
- A `100% Pure Codebase` state when no violations are found

After creating the report, the CLI prints its absolute path and a local URL:

```text
HTML report written to D:\my-project\index.html
Open report: file:///D:/my-project/index.html
```

The CLI also attempts to open the report in the default browser. If automatic opening is unavailable, open the printed `file://` URL manually.

Running HTML mode again overwrites the existing `index.html` report in the current working directory.

## Readiness Score

The score is calculated by file:

```text
((Scanned Files - Files With Violations) / Scanned Files) * 100
```

For example, if 11 of 13 scanned files contain no violations, the score is `84.6% Pure`.

## Thresholds And CI

Set the minimum acceptable readiness score:

```bash
npx pure-react-check ./src --threshold 90
```

The equals syntax is also supported:

```bash
npx pure-react-check ./src --threshold=90
```

Combine a threshold with an HTML report:

```bash
npx pure-react-check ./src --format html --threshold 90
```

When the actual score is below the threshold, the CLI prints a failure message and exits with code `1`:

```text
FAILED: Score (84.6%) is below threshold (90%).
```

Without a threshold, any violation or parse error results in exit code `1`. A passing scan exits with code `0`, making the command suitable for CI pipelines and pull-request checks.

Example `package.json` script:

```json
{
  "scripts": {
    "check:react-purity": "pure-react-check ./src --threshold 90"
  }
}
```

Run it with:

```bash
pnpm check:react-purity
```

## CLI Options

```text
pure-react-check [target] [options]

Options:
  --format terminal     Print findings in the terminal
  --format html         Generate index.html and open it in a browser
  --threshold <number>  Require a readiness score from 0 to 100
```

Both option styles are supported:

```bash
--format html
--format=html
--threshold 90
--threshold=90
```

## Local Development

Install dependencies and run the TypeScript CLI:

```bash
pnpm install
pnpm dev
```

Build the npm distribution:

```bash
pnpm build
```

Run strict TypeScript checking:

```bash
pnpm typecheck
```

## License

ISC
