import { allRules } from './rules/index.js';
import type { AnalysisRule, Violation } from './rules/types.js';

export interface ScanError {
  filePath: string;
  message: string;
}

export interface ScanResult {
  files: string[];
  violations: Violation[];
  errors: ScanError[];
}

export type RuleSeverity = 'error' | 'warn' | 'off';

export interface ScanOptions {
  /** Additional glob patterns to ignore (merged with defaults) */
  ignore?: string[];
  /** Per-rule severity overrides. Rules set to 'off' are skipped entirely. */
  rules?: Record<string, RuleSeverity>;
}

const SOURCE_PATTERN = '**/*.{js,jsx,ts,tsx}';
const DEFAULT_IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**'];

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveActiveRules(options?: ScanOptions): AnalysisRule[] {
  if (!options?.rules) return allRules;

  return allRules.filter((rule) => {
    const severity = options.rules![rule.name];
    // If no override is provided, the rule runs by default
    if (severity === undefined) return true;
    // If explicitly disabled, skip the rule
    return severity !== 'off';
  });
}

function resolveIgnorePatterns(options?: ScanOptions): string[] {
  if (!options?.ignore || options.ignore.length === 0) return DEFAULT_IGNORE;
  return [...DEFAULT_IGNORE, ...options.ignore];
}

export async function scanDirectory(
  targetDir: string,
  options?: ScanOptions,
): Promise<ScanResult> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const parser = await import('@babel/parser');
  const traverseModule = await import('@babel/traverse');
  const fastGlobModule = await import('fast-glob');

  const traverse = traverseModule.default;
  const fastGlob = fastGlobModule.default;
  const absoluteTarget = path.resolve(targetDir);
  const targetStats = fs.existsSync(absoluteTarget) ? fs.statSync(absoluteTarget) : null;

  const ignorePatterns = resolveIgnorePatterns(options);
  const rules = resolveActiveRules(options);

  let absoluteFiles: string[];
  if (targetStats?.isFile()) {
    absoluteFiles = [absoluteTarget];
  } else if (targetStats?.isDirectory()) {
    absoluteFiles = await fastGlob(SOURCE_PATTERN, {
      absolute: true,
      cwd: absoluteTarget,
      ignore: ignorePatterns,
      onlyFiles: true,
    });
  } else {
    absoluteFiles = await fastGlob(targetDir, {
      absolute: true,
      cwd: process.cwd(),
      ignore: ignorePatterns,
      onlyFiles: true,
    });
  }

  absoluteFiles.sort((left, right) => left.localeCompare(right));
  const files = absoluteFiles.map((filePath) => normalizePath(path.relative(process.cwd(), filePath)));
  const violations: Violation[] = [];
  const errors: ScanError[] = [];

  for (const [index, absoluteFile] of absoluteFiles.entries()) {
    const filePath = files[index];

    try {
      const code = fs.readFileSync(absoluteFile, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript'],
      });

      for (const rule of rules) {
        traverse(ast, rule.visitors({
          filePath,
          report(nodePath, violation) {
            violations.push({
              ...violation,
              filePath,
              line: nodePath.node.loc?.start.line ?? 0,
            });
          },
        }));
      }
    } catch (error: unknown) {
      errors.push({ filePath, message: getErrorMessage(error) });
    }
  }

  return { files, violations, errors };
}
