/**
 * Validate package manifests
 */
export interface ValidateOptions {
  packagesDirectory: string;
}
export interface ValidateResult {
  validPackages: string[];
  invalidPackages: string[];
  totalErrors: number;
  totalWarnings: number;
}
export declare function validatePackages(options: ValidateOptions): Promise<ValidateResult>;
