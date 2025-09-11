import { JSONStructure, Diagnostic, PathResult } from './index';

export interface SessionData {
    sessionId: string;
    chatId: number;
    tempDir: string;

    json?: JSONStructure;
    diagnostics?: Diagnostic[];
    unreachable?: Array<{ screen: string; name?: string }>;
    paths?: PathResult[];

    awaitingJsonLogic?: boolean
}