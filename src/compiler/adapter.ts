/**
 * Compiler Adapter Layer
 *
 * Provides a unified interface to run or simulate the React Compiler.
 * If `babel-plugin-react-compiler` is installed, it can delegate to it.
 * Otherwise, it uses a reference adapter based on React Compiler documented behavior.
 */

import { performance } from 'node:perf_hooks';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };
import type {
  CompilerObservation,
  CompilerOutcome,
  ComponentObservation,
  ExecutionStatus,
} from './types.js';
import { isLazyRefInit } from '../rules/utils.js';

// Workaround ESM/CJS interop for traverse
const traverse = (typeof _traverse === 'function' ? _traverse : (_traverse as { default: typeof _traverse }).default);

export interface CompilerCompileRequest {
  fixtureId: string;
  source: string;
  filePath?: string;
  options?: Record<string, unknown>;
}

export interface CompilerAdapter {
  readonly name: string;
  readonly version: string;
  readonly isRealCompiler: boolean;
  compile(request: CompilerCompileRequest): Promise<CompilerObservation>;
  analyse(source: string, filePath?: string): Promise<CompilerObservation[]>;
}

const DOM_GLOBALS = new Set([
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
]);

const IMPURE_GLOBALS = new Set(['Math', 'Date']);
const MUTATING_METHODS = new Set(['push', 'pop', 'splice', 'sort', 'reverse', 'shift', 'unshift']);

// ─── Reference Compiler Adapter ───────────────────────────────────────────────

/**
 * Reference implementation modeling documented React Compiler optimization rules.
 * Used when the compiler package is not installed or available locally.
 *
 * IMPORTANT: Observations produced here carry observationSource = "reference-model".
 * They must NOT be represented as official React Compiler ground truth.
 */
export class ReferenceCompilerAdapter implements CompilerAdapter {
  readonly name = 'Reference Compiler Model';
  readonly version = '19.0.0-reference';
  readonly isRealCompiler = false;

  async compile(request: CompilerCompileRequest): Promise<CompilerObservation> {
    const startTime = performance.now();
    try {
      const components = await this.analyse(request.source, request.filePath ?? 'inline.tsx');
      const durationMs = Math.round(performance.now() - startTime);

      let outcome: CompilerOutcome = 'unknown';
      if (components.length > 0) {
        if (components.some((c) => c.outcome === 'bailed-out')) {
          outcome = 'bailed-out';
        } else if (components.some((c) => c.outcome === 'skipped')) {
          outcome = 'skipped';
        } else if (components.every((c) => c.outcome === 'optimized')) {
          outcome = 'optimized';
        }
      }

      return {
        fixtureId: request.fixtureId,
        compilerVersion: this.version,
        outcome,
        executionStatus: 'success',
        observationSource: 'reference-model',
        diagnostics: [],
        components: components.map((c) => ({
          componentName: c.componentName ?? 'Anonymous',
          outcome: c.outcome,
          observationSource: 'reference-model',
          reason: c.reason,
          diagnostics: c.diagnostics,
          compilerVersion: this.version,
        })),
        durationMs,
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      return {
        fixtureId: request.fixtureId,
        compilerVersion: this.version,
        outcome: 'unknown',
        executionStatus: 'error',
        observationSource: 'reference-model',
        diagnostics: [
          {
            message: err instanceof Error ? err.message : String(err),
            severity: 'error',
          },
        ],
        components: [],
        durationMs,
      };
    }
  }

  async analyse(source: string, _filePath = 'inline.tsx'): Promise<CompilerObservation[]> {
    const observations: CompilerObservation[] = [];

    try {
      const ast = parse(source, {
        sourceType: 'unambiguous',
        plugins: ['jsx', 'typescript'],
      });

      const isModuleOptedOut = source.includes('"use no memo"') || source.includes("'use no memo'");

      // Collect module-level let/var bindings (candidates for global mutation)
      const moduleLevelBindings = new Set<string>();
      for (const stmt of ast.program.body) {
        if (stmt.type === 'VariableDeclaration' && (stmt.kind === 'let' || stmt.kind === 'var')) {
          for (const decl of stmt.declarations) {
            if (decl.id.type === 'Identifier') {
              moduleLevelBindings.add(decl.id.name);
            }
          }
        }
      }

      traverse(ast, {
        Function(path: NodePath<t.Function>) {
          let name: string | null = null;
          if ('id' in path.node && path.node.id && 'name' in path.node.id) {
            name = path.node.id.name;
          } else if (path.parentPath?.isVariableDeclarator()) {
            const id = path.parentPath.node.id;
            if (id.type === 'Identifier') name = id.name;
          }

          if (!name || (!/^[A-Z]/.test(name) && !/^use[A-Z]/.test(name))) {
            return;
          }

          // Directives check inside function body
          const fnBodyText = source.slice(path.node.start ?? 0, path.node.end ?? 0);
          const isFnOptedOut =
            isModuleOptedOut ||
            fnBodyText.includes('"use no memo"') ||
            fnBodyText.includes("'use no memo'");

          if (isFnOptedOut) {
            observations.push({
              componentName: name,
              outcome: 'skipped',
              observationSource: 'reference-model',
              reason: 'Skipped due to "use no memo" directive.',
              compilerVersion: '19.0.0-reference',
            });
            return;
          }

          let bailedOut = false;
          let bailoutReason = '';

          const isAsync = path.node.async;
          if (isAsync) {
            bailedOut = true;
            bailoutReason = 'Async component functions are not supported by the compiler.';
          }

          // Collect locally declared variables within this component
          const localBindings = new Set<string>();
          path.traverse({
            VariableDeclarator(declPath: NodePath<t.VariableDeclarator>) {
              if (declPath.node.id.type === 'Identifier') {
                localBindings.add(declPath.node.id.name);
              }
            },
          });

          // Inner AST inspections according to React Compiler specification
          path.traverse({
            Function(innerPath: NodePath<t.Function>) {
              if (innerPath === path) return;
              let innerName: string | null = null;
              if ('id' in innerPath.node && innerPath.node.id && 'name' in innerPath.node.id) {
                innerName = innerPath.node.id.name;
              } else if (innerPath.parentPath?.isVariableDeclarator()) {
                const id = innerPath.parentPath.node.id;
                if (id.type === 'Identifier') innerName = id.name;
              }
              if (innerName && (/^[A-Z]/.test(innerName) || /^use[A-Z]/.test(innerName))) {
                bailedOut = true;
                bailoutReason = `Nested component definition '${innerName}' in render body.`;
              }
            },

            CallExpression(callPath: NodePath<t.CallExpression>) {
              const funcParent = callPath.getFunctionParent();
              if (funcParent !== path) return;

              const callee = callPath.node.callee;

              // 1. Conditional hooks check
              if (callee.type === 'Identifier' && /^use[A-Z]/.test(callee.name)) {
                const ifParent = callPath.findParent((p) => p.isIfStatement() || p.isLoop() || p.isSwitchStatement());
                if (ifParent) {
                  bailedOut = true;
                  bailoutReason = `Conditional call of hook '${callee.name}'.`;
                }
              }

              // 2. Unconditional setState call
              if (callee.type === 'Identifier') {
                if (callee.name === 'setState' || callee.name === 'setCount' || /^set[A-Z]/.test(callee.name)) {
                  bailedOut = true;
                  bailoutReason = `Unconditional state update '${callee.name}' called during render.`;
                }
              }

              // 3. Impure global function calls (Math.random, Date.now)
              if (
                callee.type === 'MemberExpression' &&
                callee.object.type === 'Identifier' &&
                IMPURE_GLOBALS.has(callee.object.name)
              ) {
                bailedOut = true;
                bailoutReason = `Impure call '${callee.object.name}.${callee.property.type === 'Identifier' ? callee.property.name : 'fn'}' during render.`;
              }

              // 4. Prop/State array mutation methods (.push, .splice) — but not on locally created arrays
              if (
                callee.type === 'MemberExpression' &&
                callee.property.type === 'Identifier' &&
                MUTATING_METHODS.has(callee.property.name)
              ) {
                // Check if the object being mutated is a local binding
                const objectName = callee.object.type === 'Identifier' ? callee.object.name : null;
                const isLocalMutation = objectName && localBindings.has(objectName);
                if (!isLocalMutation) {
                  bailedOut = true;
                  bailoutReason = `Mutating method '${callee.property.name}' called during render.`;
                }
              }
            },

            MemberExpression(memPath: NodePath<t.MemberExpression>) {
              const funcParent = memPath.getFunctionParent();
              if (funcParent !== path) return;

              // DOM Globals read
              if (memPath.node.object.type === 'Identifier' && DOM_GLOBALS.has(memPath.node.object.name)) {
                bailedOut = true;
                bailoutReason = `Access to browser DOM global '${memPath.node.object.name}' during render.`;
              }

              // Ref read in render
              if (
                !memPath.node.computed &&
                memPath.node.property.type === 'Identifier' &&
                memPath.node.property.name === 'current'
              ) {
                // Ignore lazy ref init
                if (!isLazyRefInit(memPath)) {
                  bailedOut = true;
                  bailoutReason = 'Read of ref.current during render.';
                }
              }
            },

            AssignmentExpression(assignPath: NodePath<t.AssignmentExpression>) {
              const funcParent = assignPath.getFunctionParent();
              if (funcParent !== path) return;

              // Ignore lazy ref init
              if (isLazyRefInit(assignPath)) {
                return;
              }

              const left = assignPath.node.left;
              if (left.type === 'Identifier') {
                // Only flag mutation of non-local variables (module-level globals)
                if (moduleLevelBindings.has(left.name)) {
                  bailedOut = true;
                  bailoutReason = `Render-phase mutation of module-level variable '${left.name}'.`;
                }
                // Reassignment of local variables is safe and expected
              } else if (left.type === 'MemberExpression') {
                // Property mutation — check if the root object is local
                let rootObj: t.Expression | t.Super = left.object;
                while (rootObj.type === 'MemberExpression') {
                  rootObj = rootObj.object;
                }
                const rootName = rootObj.type === 'Identifier' ? rootObj.name : null;
                const isLocalPropMutation = rootName && localBindings.has(rootName);

                if (!isLocalPropMutation) {
                  bailedOut = true;
                  bailoutReason = 'Render-phase mutation of property/object.';
                }
              }
            },

            UpdateExpression(updatePath: NodePath<t.UpdateExpression>) {
              const funcParent = updatePath.getFunctionParent();
              if (funcParent !== path) return;

              const arg = updatePath.node.argument;
              if (arg.type === 'Identifier' && moduleLevelBindings.has(arg.name)) {
                bailedOut = true;
                bailoutReason = `Render-phase mutation of module-level variable '${arg.name}'.`;
              }
            },
          });

          if (bailedOut) {
            observations.push({
              componentName: name,
              outcome: 'bailed-out',
              observationSource: 'reference-model',
              reason: bailoutReason,
              compilerVersion: '19.0.0-reference',
            });
          } else {
            observations.push({
              componentName: name,
              outcome: 'optimized',
              observationSource: 'reference-model',
              reason: 'Successfully compiled and reactive scopes auto-memoized.',
              compilerVersion: '19.0.0-reference',
            });
          }
        },
      });
    } catch {
      // Parse error or non-code file
    }

    return observations;
  }
}

// ─── Real React Compiler Adapter (Dynamic) ───────────────────────────────────

export class ReactCompilerAdapter implements CompilerAdapter {
  readonly name = 'babel-plugin-react-compiler';
  readonly version: string;
  readonly isRealCompiler = true;

  constructor(version: string) {
    this.version = version;
  }

  async compile(request: CompilerCompileRequest): Promise<CompilerObservation> {
    const startTime = performance.now();
    try {
      const babelCore: any = await import('@babel/core' as string);
      const reactCompilerPlugin: any = await import('babel-plugin-react-compiler' as string);

      const result = await babelCore.transformAsync(request.source, {
        filename: request.filePath ?? 'inline.tsx',
        presets: ['@babel/preset-typescript', '@babel/preset-react'],
        plugins: [reactCompilerPlugin.default ?? reactCompilerPlugin],
      });

      const compiledCode = result?.code ?? '';
      const components = this.extractObservations(request.source, compiledCode);
      const durationMs = Math.round(performance.now() - startTime);

      let outcome: CompilerOutcome = 'unknown';
      if (components.length > 0) {
        if (components.some((c) => c.outcome === 'bailed-out')) {
          outcome = 'bailed-out';
        } else if (components.some((c) => c.outcome === 'skipped')) {
          outcome = 'skipped';
        } else if (components.every((c) => c.outcome === 'optimized')) {
          outcome = 'optimized';
        }
      }

      return {
        fixtureId: request.fixtureId,
        compilerVersion: this.version,
        outcome,
        executionStatus: 'success',
        observationSource: 'react-compiler',
        diagnostics: [],
        components,
        durationMs,
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      return {
        fixtureId: request.fixtureId,
        compilerVersion: this.version,
        outcome: 'unknown',
        executionStatus: 'error',
        observationSource: 'react-compiler',
        diagnostics: [
          {
            message: err instanceof Error ? err.message : String(err),
            severity: 'error',
          },
        ],
        components: [],
        durationMs,
      };
    }
  }

  private extractObservations(source: string, compiledCode: string): ComponentObservation[] {
    const observations: ComponentObservation[] = [];

    // Parse original source to identify components/hooks
    const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', 'typescript'] });

    // Parse compiled output to check per-component memoization
    let compiledAst: ReturnType<typeof parse> | null = null;
    try {
      compiledAst = parse(compiledCode, {
        sourceType: 'unambiguous',
        plugins: ['jsx'],
      });
    } catch {
      // Fallback
    }

    const memoizedFunctions = new Set<string>();
    if (compiledAst) {
      traverse(compiledAst, {
        Function(cPath: NodePath<t.Function>) {
          let fnName: string | null = null;
          if ('id' in cPath.node && cPath.node.id && 'name' in cPath.node.id) {
            fnName = cPath.node.id.name;
          } else if (cPath.parentPath?.isVariableDeclarator()) {
            const id = cPath.parentPath.node.id;
            if (id.type === 'Identifier') fnName = id.name;
          }
          if (!fnName) return;

          const fnCode = compiledCode.slice(cPath.node.start ?? 0, cPath.node.end ?? 0);
          if (fnCode.includes('_c(') || fnCode.includes('useMemoCache')) {
            memoizedFunctions.add(fnName);
          }
        },
      });
    }

    traverse(ast, {
      Function(path: NodePath<t.Function>) {
        let name: string | null = null;
        if ('id' in path.node && path.node.id && 'name' in path.node.id) name = path.node.id.name;
        else if (path.parentPath?.isVariableDeclarator() && path.parentPath.node.id.type === 'Identifier') {
          name = path.parentPath.node.id.name;
        }

        if (!name || (!/^[A-Z]/.test(name) && !/^use[A-Z]/.test(name))) return;

        const isMemoized = compiledAst
          ? memoizedFunctions.has(name)
          : (compiledCode.includes(`_c(`) || compiledCode.includes(`useMemoCache`));

        observations.push({
          componentName: name,
          outcome: isMemoized ? 'optimized' : 'bailed-out',
          observationSource: 'react-compiler',
          compilerVersion: this.version,
        });
      },
    });

    return observations;
  }

  async analyse(source: string, filePath = 'inline.tsx'): Promise<CompilerObservation[]> {
    const res = await this.compile({ fixtureId: 'inline', source, filePath });
    if (res.executionStatus === 'error') {
      const fallback = new ReferenceCompilerAdapter();
      return fallback.analyse(source, filePath);
    }
    return res.components ?? [];
  }
}

// ─── Mock Compiler Adapter (for tests) ────────────────────────────────────────

export interface MockCompilerAdapterOptions {
  name?: string;
  version?: string;
  isRealCompiler?: boolean;
  simulatedOutcome?: CompilerOutcome;
  shouldFail?: boolean;
  shouldTimeout?: boolean;
  customObservations?: Map<string, CompilerObservation>;
}

export class MockCompilerAdapter implements CompilerAdapter {
  readonly name: string;
  readonly version: string;
  readonly isRealCompiler: boolean;
  private simulatedOutcome?: CompilerOutcome;
  private shouldFail?: boolean;
  private shouldTimeout?: boolean;
  private customObservations?: Map<string, CompilerObservation>;

  constructor(options: MockCompilerAdapterOptions = {}) {
    this.name = options.name ?? 'MockCompiler';
    this.version = options.version ?? '0.0.0-mock';
    this.isRealCompiler = options.isRealCompiler ?? false;
    this.simulatedOutcome = options.simulatedOutcome;
    this.shouldFail = options.shouldFail;
    this.shouldTimeout = options.shouldTimeout;
    this.customObservations = options.customObservations;
  }

  async compile(request: CompilerCompileRequest): Promise<CompilerObservation> {
    if (this.shouldTimeout) {
      return {
        fixtureId: request.fixtureId,
        compilerVersion: this.version,
        outcome: 'unknown',
        executionStatus: 'timeout',
        observationSource: 'reference-model',
        diagnostics: [{ message: 'Compilation timed out after limit', severity: 'error' }],
        components: [],
        durationMs: 5000,
      };
    }

    if (this.shouldFail) {
      return {
        fixtureId: request.fixtureId,
        compilerVersion: this.version,
        outcome: 'unknown',
        executionStatus: 'error',
        observationSource: 'reference-model',
        diagnostics: [{ message: 'Simulated compiler crash / internal error', severity: 'error' }],
        components: [],
        durationMs: 1,
      };
    }

    if (this.customObservations && this.customObservations.has(request.fixtureId)) {
      return this.customObservations.get(request.fixtureId)!;
    }

    const outcome = this.simulatedOutcome ?? 'optimized';
    return {
      fixtureId: request.fixtureId,
      compilerVersion: this.version,
      outcome,
      executionStatus: 'success',
      observationSource: 'reference-model',
      diagnostics: [],
      components: [
        {
          componentName: 'MockComponent',
          outcome,
          observationSource: 'reference-model',
          compilerVersion: this.version,
        },
      ],
      durationMs: 2,
    };
  }

  async analyse(source: string, filePath?: string): Promise<CompilerObservation[]> {
    const obs = await this.compile({ fixtureId: 'inline', source, filePath });
    return obs.components ?? [];
  }
}

/**
 * Factory function to create the best available CompilerAdapter.
 */
export async function createCompilerAdapter(): Promise<CompilerAdapter> {
  try {
    const pkg: any = await import('babel-plugin-react-compiler/package.json' as string, {
      with: { type: 'json' },
    }).catch(() => null);

    if (pkg && pkg.default?.version) {
      return new ReactCompilerAdapter(pkg.default.version);
    }
  } catch {
    // Ignore dynamic import error
  }

  return new ReferenceCompilerAdapter();
}
