import { Context } from 'telegraf';

export interface Screen {
  id: string;
  name?: string;
  isTerminal?: boolean;
  isFirstScreen?: boolean;
}

export interface ScreenRule {
  nextDisplay?: string | string[];
}

export interface JSONStructure {
  screens?: Screen[];
  screenRules?: Record<string, ScreenRule[]>;
  cycledScreenRules?: Record<string, ScreenRule[]>;
  init?: string;
}

export interface PathResult {
  path: string[];
  status: 'CYCLE' | 'TERMINAL' | 'DEAD_END';
}

export interface Diagnostic {
  screen: string;
  name?: string;
  terminal: boolean;
  has_rules: boolean;
  out_degree: number;
}

export interface BotContext extends Context {
  // Дополнительные свойства контекста, если нужны
}

export interface ReportFiles {
  diagnostics: string;
  paths: string;
  unreachable?: string;
  summary: string;
}
