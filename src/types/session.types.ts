import { JSONStructure, Diagnostic, PathResult } from './index';

export interface SessionData {
    json: JSONStructure;
    diagnostics: Diagnostic[];
    unreachable: Array<{ screen: string; name?: string }>;
    tempDir: string;
    sessionId: string;
    paths?: PathResult[];
}