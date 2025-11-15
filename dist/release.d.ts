import { PackagedPackage } from './types/manifest';
/**
 * GitHub Release Management
 * Creates individual releases for each plugin version
 * Each release tag points to the current commit
 */
export interface ReleaseOptions {
    packages: PackagedPackage[];
    githubToken: string;
    repository: string;
    forceRelease?: boolean;
}
export interface ReleaseResult {
    createdReleases: string[];
    skippedReleases: string[];
    deletedReleases: string[];
}
export declare function createPluginReleases(options: ReleaseOptions): Promise<ReleaseResult>;
