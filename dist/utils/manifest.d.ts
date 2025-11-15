import { PackageManifest, ValidationResult } from '../types/manifest';
/**
 * Manifest parsing and validation utilities
 */
export declare function readManifest(packageDir: string): Promise<PackageManifest>;
export declare function validateManifest(manifest: PackageManifest): ValidationResult;
export declare function findPackageDirectories(packagesDir: string): Promise<string[]>;
export declare function sanitizeName(name: string): string;
export declare function parsePackageArchiveName(filename: string): {
  name: string;
  version: string;
} | null;
