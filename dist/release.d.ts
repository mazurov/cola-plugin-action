import { PackagedPackage } from './types/manifest';
/**
 * GitHub Release Management
 * Creates individual releases for each plugin version
 * Each release tag contains only the plugin directory content (orphan commit)
 */
export interface ReleaseOptions {
    packages: PackagedPackage[];
    githubToken: string;
    repository: string;
}
export interface ReleaseResult {
    createdReleases: string[];
    skippedReleases: string[];
}
export declare function createPluginReleases(options: ReleaseOptions): Promise<ReleaseResult>;
