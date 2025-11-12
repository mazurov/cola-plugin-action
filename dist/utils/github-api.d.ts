/**
 * GitHub API utilities using @actions/github
 */
export interface GitHubRelease {
    id: number;
    tag_name: string;
    name: string;
    created_at: string;
    assets: GitHubAsset[];
}
export interface GitHubAsset {
    name: string;
    browser_download_url: string;
    size: number;
}
export declare class GitHubClient {
    private octokit;
    private owner;
    private repo;
    constructor(token: string, repository: string);
    getAllReleases(): Promise<GitHubRelease[]>;
    releaseExists(tag: string): Promise<boolean>;
    assetExistsInRelease(tag: string, assetName: string): Promise<boolean>;
    downloadAsset(url: string, outputPath: string): Promise<void>;
    getPluginAssets(releases: GitHubRelease[]): Map<string, GitHubAsset[]>;
}
//# sourceMappingURL=github-api.d.ts.map