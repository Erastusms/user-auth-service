import pino from 'pino';
export declare const logger: import("pino").Logger<never>;
export declare function createLogger(module: string): pino.Logger<never>;
export type Logger = typeof logger;
export default logger;
