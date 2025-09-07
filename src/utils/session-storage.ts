import { randomUUID } from 'crypto';
import { SessionData } from '../types/session.types';



class SessionStorage {
    private static storage = new Map<string, SessionData>();

    static create(data: Omit<SessionData, 'sessionId'>): string {
        const sessionId = randomUUID();
        const sessionData: SessionData = { ...data, sessionId };
        this.storage.set(sessionId, sessionData);
        
        // Автоочистка через 30 минут
        setTimeout(() => this.delete(sessionId), 30 * 60 * 1000);
        
        return sessionId;
    }

    static get(sessionId: string): SessionData | undefined {
        return this.storage.get(sessionId);
    }

    static delete(sessionId: string): void {
        this.storage.delete(sessionId);
    }
}

export default SessionStorage;