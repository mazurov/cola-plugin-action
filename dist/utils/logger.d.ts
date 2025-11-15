/**
 * Logger utility wrapping @actions/core
 * Provides consistent logging throughout the action
 */
export declare class Logger {
    info(message: string): void;
    success(message: string): void;
    warning(message: string): void;
    error(message: string | Error): void;
    header(message: string): void;
    section(message: string): void;
    debug(message: string): void;
    startGroup(name: string): void;
    endGroup(): void;
}
export declare const logger: Logger;
