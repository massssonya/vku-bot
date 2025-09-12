import { AnalysisResult, JSONStructure } from './json-processor.types';

export interface SessionData {
    sessionId: string;
    chatId: number;
    tempDir: string;

    analysisResult?: AnalysisResult
    json?: JSONStructure;
    // diagnostics?: Diagnostic[];
    // unreachable?: Array<{ screen: string; name?: string }>;
    // paths?: PathResult[];

    awaitingJsonLogic?: boolean
}