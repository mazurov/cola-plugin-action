import { ArchiveFormat } from './utils/archive';
import { PackagedPlugin } from './types/manifest';
/**
 * Package plugins into archives (ZIP or tar.gz)
 */
export interface PackageOptions {
    pluginsDirectory: string;
    outputDirectory: string;
    format?: ArchiveFormat;
}
export interface PackageResult {
    packages: PackagedPlugin[];
}
export declare function packagePlugins(options: PackageOptions): Promise<PackageResult>;
