import { ArchiveFormat } from './utils/archive';
import { PackagedPackage } from './types/manifest';
/**
 * Create packages archives (ZIP format)
 */
export interface PackageOptions {
    packagesDirectory: string;
    outputDirectory: string;
    format?: ArchiveFormat;
}
export interface PackageResult {
    packages: PackagedPackage[];
}
export declare function createPackages(options: PackageOptions): Promise<PackageResult>;
