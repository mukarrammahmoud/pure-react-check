# React Compiler Ground Truth Layer & Fixture Runner

> **Important**: `pure-react-check` is a **static preflight analyzer**, not an emulator of the React Compiler. It does not compile React code, does not execute intermediate representations, and does not replace the official compiler. The official React Compiler is the **sole authoritative ground truth** for compiler behavior.

---

## 1. What Ground Truth Means

In `pure-react-check`, **Ground Truth** refers to the empirical behavior of the React Compiler when run against React components and hooks. Rather than assuming our static analysis rules match compiler behavior by definition, we treat the React Compiler as an external physical system whose actual behavior must be observed and measured.

The Ground Truth Fixture Runner executes static analysis predictions from `pure-react-check`, executes the React Compiler (via `CompilerAdapter`), compares both outcomes, and produces deterministic compatibility reports.

---

## 2. Why the Real React Compiler is the Observation Source

Static analyzers reason about syntax trees and heuristic patterns. Compilers perform advanced whole-program analysis, dataflow graph construction, alias tracking, and SSA-form reactive scope transformations.

Because compiler internal algorithms evolve across versions:
- Static analysis predictions must **never** be treated as ground truth.
- Hand-crafted "expected outcomes" in test assertions quickly become stale.
- The **actual observed behavior** of the compiler on real source code is the only valid ground truth.

When `babel-plugin-react-compiler` is available in the environment, `ReactCompilerAdapter` runs the official compiler pipeline. When running in environments without the compiler installed, `ReferenceCompilerAdapter` provides a simulated reference model clearly tagged with `observationSource: "reference-model"`.

---

## 3. Difference Between Prediction and Observation

| Concept | Source | Representation | Description |
| :--- | :--- | :--- | :--- |
| **Static Prediction** | `pure-react-check` AST analysis | `StaticPrediction` | Preflight prediction of whether a component will be optimized or bail out based on static heuristics. |
| **Compiler Observation** | React Compiler (`CompilerAdapter`) | `CompilerObservation` | Empirical result observed by executing the compiler pipeline. Tracks `outcome` and `executionStatus` (`success`, `error`, `timeout`). |

---

## 4. Compatibility Classifications

Each fixture comparison is classified into one of four deterministic states:

### 4.1 Agreement
Both the static analyzer and the compiler agreed on the outcome:
- Prediction `optimized` + Observation `optimized` $\rightarrow$ **Agreement**
- Prediction `bailed-out` + Observation `bailed-out` $\rightarrow$ **Agreement**
- Prediction `skipped` + Observation `skipped` (e.g. `"use no memo"`) $\rightarrow$ **Agreement**

### 4.2 False Positive
The static analyzer predicted a bailout, but the compiler was able to optimize the component:
- Prediction `bailed-out` + Observation `optimized` $\rightarrow$ **False Positive**
- *Impact*: Indicates our static rule was too conservative or flagged a pattern that the compiler's dataflow analysis resolved successfully.

### 4.3 False Negative
The static analyzer predicted the component was ready, but the compiler bailed out:
- Prediction `optimized` + Observation `bailed-out` $\rightarrow$ **False Negative**
- *Impact*: Critical gap. A user would expect the component to optimize based on preflight checks, but the compiler failed to optimize it.

### 4.4 Unknown
Unreliable execution or unclassifiable outcomes:
- Compiler threw an unhandled exception or timed out (`executionStatus === 'error' | 'timeout'`).
- The compiler outcome could not be determined with certainty.
- *Rule*: Compiler execution errors are **never** classified as false-positive or false-negative.

---

## 5. How to Add a Fixture

Fixtures live under `tests/fixtures/` organized by category:
- `purity/` — mutations during render, global mutations, ref reads
- `hooks/` — conditional hooks, hook rules
- `memoization/` — clean memoizable components, referential stability
- `directives/` — `"use no memo"`, `"use memo"`
- `edge-cases/` — lazy ref initialization, nested scopes, unusual syntax

### Step-by-Step:
1. Create a subfolder under the appropriate category:
   ```bash
   mkdir -p tests/fixtures/purity/my-custom-case
   ```
2. Create `fixture.json` with metadata:
   ```json
   {
     "id": "my-custom-case",
     "category": "purity",
     "description": "Demonstrates specific render-phase behavior",
     "entry": "input.tsx",
     "tags": ["mutation", "purity"]
   }
   ```
   > **Note**: Do NOT store expected compiler outcomes in `fixture.json`. The runner observes the compiler dynamically.
3. Create the component in `input.tsx`:
   ```tsx
   export function MyCustomCaseComponent({ value }: { value: number }) {
     return <div>Value: {value}</div>;
   }
   ```
4. Run the suite to observe behavior.

---

## 6. How to Run the Ground Truth Suite

### Running via CLI:
```bash
# Run all fixtures
npx pure-react-check ground-truth

# Target specific fixture directory
npx pure-react-check ground-truth --fixtures tests/fixtures

# Run a single fixture by ID
npx pure-react-check ground-truth --fixture render-mutation

# Show only mismatches (false positives & false negatives)
npx pure-react-check ground-truth --mismatches-only

# Output machine-readable JSON to stdout
npx pure-react-check ground-truth --json

# Run with custom concurrency (default: 1 sequential)
npx pure-react-check ground-truth --concurrency 4

# Check for regressions against baseline snapshot in CI
npx pure-react-check ground-truth --ci --baseline tests/baselines/react-compiler/current.json --min-agreement 80
```

### Running in Code:
```typescript
import { runGroundTruthSuite, writeGroundTruthReports } from 'pure-react-check/compiler';

const suiteResult = await runGroundTruthSuite({
  fixturesDir: 'tests/fixtures',
  concurrency: 1,
});

console.log(`Agreement rate: ${suiteResult.summary.agreementRate}%`);
writeGroundTruthReports(suiteResult);
```

---

## 7. How Compatibility Reports are Generated

When the runner executes, it produces three deterministic JSON artifacts in `reports/ground-truth/` (or `--report <path>`):

1. **`latest.json`**: Complete suite run including schema version, analyzer version, compiler version, timestamp, summary metrics, and full per-fixture results with component-level comparisons.
2. **`summary.json`**: Lightweight summary containing high-level agreement rates, false positive counts, and false negative counts.
3. **`mismatches.json`**: Filtered subset containing exclusively fixtures where prediction and observation diverged (`false-positive`, `false-negative`, `unknown`).

---

## 8. How Compiler Versions Affect Results

The React Compiler is under active development. A pattern that triggers a bailout in version `19.0.0-rc.0` might be successfully memoized in `19.0.0-rc.1`.

Because of this:
- Every report records the exact `compilerVersion` and `compilerName`.
- Baselines in `tests/baselines/react-compiler/` track expected agreement rates for specific compiler versions.
- If upgrading the compiler causes an agreement rate drop or new false negatives, CI detects this as a regression.
