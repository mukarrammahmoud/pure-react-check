import type { NodePath, Visitor } from '@babel/traverse' with { 'resolution-mode': 'import' };
import type * as t from '@babel/types' with { 'resolution-mode': 'import' };

export interface Violation {
  rule: string;
  filePath: string;
  line: number;
  message: string;
  recommendation: string;
}

export interface RuleContext {
  filePath: string;
  report(path: NodePath<t.Node>, violation: Omit<Violation, 'filePath' | 'line'>): void;
}

export interface AnalysisRule {
  name: string;
  visitors(context: RuleContext): Visitor;
}
