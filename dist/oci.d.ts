/**
 * Push plugins to OCI registry using ORAS
 */
export interface OCIPushOptions {
  outputDirectory: string;
  registry: string;
  username: string;
  token: string;
}
export interface OCIPushResult {
  pushedCount: number;
  skippedCount: number;
}
export declare function pushToOCI(options: OCIPushOptions): Promise<OCIPushResult>;
