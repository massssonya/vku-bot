import { Context, NarrowedContext } from 'telegraf';
import { Message, Update } from 'telegraf/types';

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

export interface DocumentMessage extends Message.DocumentMessage {
  document: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
}

export type DocumentContext = NarrowedContext<Context<Update>, Update.MessageUpdate<DocumentMessage>>;

export interface ReportFiles {
  diagnostics: string;
  paths: string;
  unreachable?: string;
  summary: string;
  conflicts?: string;
  contradictions?: string;
}
