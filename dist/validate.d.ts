/**
 * Validate plugin manifests
 */
export interface ValidateOptions {
    pluginsDirectory: string;
}
export interface ValidateResult {
    validPlugins: string[];
    invalidPlugins: string[];
    totalErrors: number;
    totalWarnings: number;
}
export declare function validatePlugins(options: ValidateOptions): Promise<ValidateResult>;
