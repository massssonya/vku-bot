import { Context } from 'telegraf';
import { SessionData } from './session';

declare module 'telegraf' {
    interface Session {
        sessionData?: SessionData;
    }

    interface Context {
        session: Session;
    }
}

export interface CustomContext extends Context {
    session: Session;
}