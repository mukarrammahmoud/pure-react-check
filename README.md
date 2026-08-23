# pure-react-check

`pure-react-check` is a static analysis CLI that scans React JavaScript and TypeScript files for render-phase code that can violate component purity or cause React Compiler optimization bailouts.

It parses source code with Babel, reports the exact file and line for each issue, recommends a fix, and calculates a Compiler Readiness Score for the scanned project.

## What It Checks

The ruleset detects:

**Render Purity**
- `no-ref-read-in-render`: reads of `ref.current` during render (breaks React Compiler memoization).
- `no-render-mutation`: assignments and `ref.current` mutations during render.
- `no-impure-calls`: calls such as `Math.random()` and `Date.now()` during render.
- `no-set-state-in-render`: direct `setState`-style or `dispatch(...)` calls during render.
- `no-prop-state-mutation`: mutations of props, state objects, or arrays.
- `no-dom-globals-in-render`: render-time access to `document`, `window`, storage APIs, `fetch`, and similar browser side effects.
- `no-timer-in-render`: calls to `setTimeout`, `setInterval`, `clearTimeout`, `requestAnimationFrame`, and related APIs directly in render.

**Component Structure**
- `no-nested-components`: component definitions inside another component.
- `no-async-component`: component functions declared as `async` (breaks client-side React rendering).

**React Compiler Memoization**
- `no-mutation-after-jsx`: mutating an object or array after it has been passed into a JSX element (defeats compiler memoization).
- `no-unstable-default-props`: object, array, or function literals used as default values in prop destructuring (creates new references on every render).
- `no-ref-as-dependency`: `ref.current` used inside dependency arrays of `useMemo`, `useCallback`, or `useEffect` (refs do not trigger re-renders).

**Rules of Hooks**
- `no-conditional-hooks`: hooks (`use*`) called inside conditionals, loops, switch statements, or nested functions.

**List Rendering**
- `no-unstable-jsx-key`: missing `key` prop on JSX elements inside `.map()`, or impure values (`Math.random()`, `Date.now()`) used as JSX keys.

**Module-Level Side Effects**
- `no-global-variable-mutation`: mutations of module-level `let`/`var` variables inside render functions.

Calls inside event handlers, effects, and nested callbacks are excluded where appropriate. Lazy ref initialization patterns (`if (ref.current === null) ref.current = ...`) are supported.


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

The report contains:

- Compiler Readiness Score
- Total scanned files, clean files count, and total violations
- Violations grouped by source file with rule badges, line numbers, messages, and fix advice
- Parse errors, when present
- A `100% Pure Codebase` state when no violations are found

After creating the report, the CLI prints its absolute path and a local URL:

```text
HTML report written to /my-project/index.html
Open report: file:///my-project/index.html
```

Running HTML mode again overwrites the existing `index.html` report.

## JSON Report

Generate a machine-readable JSON file for use in dashboards, custom CI scripts, or post-processing:

```bash
npx pure-react-check ./src --format json
```

Output file: `pure-react-check-report.json`

```json
{
  "version": "1.0.0",
  "scannedAt": "2025-01-01T00:00:00.000Z",
  "score": 84.6,
  "summary": {
    "scannedFiles": 13,
    "cleanFiles": 11,
    "totalViolations": 4,
    "totalErrors": 0
  },
  "violations": [
    {
      "rule": "no-impure-calls",
      "filePath": "src/components/Header.tsx",
      "line": 12,
      "message": "Calls Math.random() directly during render.",
      "recommendation": "Move the call into an event handler or memoization boundary."
    }
  ],
  "errors": []
}
```

## SARIF Report

Generate a [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) report for GitHub Code Scanning and PR inline annotations:

```bash
npx pure-react-check ./src --format sarif
```

Output file: `pure-react-check-report.sarif`

Upload the file to GitHub Code Scanning to see violations as inline annotations directly on pull requests:

```yaml
- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: pure-react-check-report.sarif
```

## Configuration File

Create a `.purereactrc.json` file in your project root to store settings permanently instead of passing flags every time:

```json
{
  "target": "./src",
  "format": "terminal",
  "threshold": 90,
  "ignore": [
    "**/*.test.tsx",
    "**/*.spec.tsx",
    "**/*.stories.tsx"
  ],
  "rules": {
    "no-async-component": "warn",
    "no-dom-globals-in-render": "error"
  }
}
```

Supported config file names (searched in project root):

```text
.purereactrc.json
.purereactrc
purereact.config.json
```

CLI flags always override config file values when both are present.

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

Combine a threshold with any output format:

```bash
npx pure-react-check ./src --format html --threshold 90
npx pure-react-check ./src --format sarif --threshold 100
```

When the actual score is below the threshold, the CLI prints a failure message and exits with code `1`:

```text
FAILED: Score (84.6%) is below threshold (90%).
```

Without a threshold, any violation or parse error results in exit code `1`. A passing scan exits with code `0`.

Example `package.json` script:

```json
{
  "scripts": {
    "check:react-purity": "pure-react-check ./src --threshold 90"
  }
}
```

## GitHub Actions

### Terminal Check

Add a basic check to any workflow:

```yaml
name: React Purity Check
on: [push, pull_request]

jobs:
  purity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: npx pure-react-check ./src --threshold 90
```

### PR Inline Annotations with SARIF

Get violations as inline comments on every pull request via GitHub Code Scanning:

```yaml
name: React Purity Check
on: [push, pull_request]

permissions:
  security-events: write  # Required for uploading SARIF

jobs:
  purity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - name: Run pure-react-check (SARIF)
        run: npx pure-react-check ./src --format sarif --threshold 90
        continue-on-error: true

      - name: Upload SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: pure-react-check-report.sarif
```

## Programmatic Node.js API

Use `pure-react-check/api` to call the scanner from your own Node.js scripts, build tools, or test runners:

```ts
import { scan, getScore, generateJsonReport } from 'pure-react-check/api';

const result = await scan('./src');
const score  = getScore(result);

console.log(`Compiler Readiness: ${score.toFixed(1)}%`);
console.log(`Violations: ${result.violations.length}`);

// Generate a JSON report file
generateJsonReport(result, score, 'reports/purity.json');

// Inspect violations directly
for (const v of result.violations) {
  console.log(`[${v.rule}] ${v.filePath}:${v.line} — ${v.message}`);
}
```

Available exports from `pure-react-check/api`:

| Export | Description |
| :--- | :--- |
| `scan(target)` | Scans a file, directory, or glob and returns a `ScanResult` |
| `getScore(result)` | Computes the Compiler Readiness Score (0–100) |
| `allRules` | Array of all built-in `AnalysisRule` objects |
| `loadConfig()` | Reads `.purereactrc.json` from the current working directory |
| `generateHtmlReport(result, score, path?)` | Writes an HTML report and returns the absolute path |
| `generateJsonReport(result, score, path?)` | Writes a JSON report and returns the absolute path |
| `generateSarifReport(result, score, path?)` | Writes a SARIF 2.1.0 report and returns the absolute path |
| `ScanResult`, `Violation`, `AnalysisRule` | TypeScript types |

## CLI Options

```text
pure-react-check [target] [options]

Options:
  --format terminal     Print findings in the terminal (default)
  --format html         Generate index.html and open it in a browser
  --format json         Generate pure-react-check-report.json
  --format sarif        Generate pure-react-check-report.sarif (GitHub Code Scanning)
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

Build the npm distribution (includes type declarations):

```bash
pnpm build
```

Run strict TypeScript checking:

```bash
pnpm typecheck
```

## License

ISC
