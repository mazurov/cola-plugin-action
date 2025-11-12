import { PackagedPlugin } from './types/manifest';
/**
 * Package plugins into tar.gz archives
 */
export interface PackageOptions {
    pluginsDirectory: string;
    outputDirectory: string;
}
export interface PackageResult {
    packages: PackagedPlugin[];
}
export declare function packagePlugins(options: PackageOptions): Promise<PackageResult>;
