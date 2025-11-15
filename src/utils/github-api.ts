import * as github from '@actions/github';
import { logger } from './logger';

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

export class GitHubClient {
  private octokit: ReturnType<typeof github.getOctokit>;
  private owner: string;
  private repo: string;

  constructor(token: string, repository: string) {
    this.octokit = github.getOctokit(token);

    const [owner, repo] = repository.split('/');
    if (!owner || !repo) {
      throw new Error(`Invalid repository format: ${repository}. Expected 'owner/repo'`);
    }

    this.owner = owner;
    this.repo = repo;
  }

  async getAllReleases(): Promise<GitHubRelease[]> {
    logger.info(`Fetching releases from ${this.owner}/${this.repo}...`);

    try {
      const releases = await this.octokit.paginate(this.octokit.rest.repos.listReleases, {
        owner: this.owner,
        repo: this.repo,
        per_page: 100,
      });

      logger.success(`Fetched ${releases.length} releases`);

      return releases.map(release => ({
        id: release.id,
        tag_name: release.tag_name,
        name: release.name || release.tag_name,
        created_at: release.created_at,
        assets: release.assets.map(asset => ({
          name: asset.name,
          browser_download_url: asset.browser_download_url,
          size: asset.size,
        })),
      }));
    } catch (error) {
      throw new Error(
        `Failed to fetch releases: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async releaseExists(tag: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.getReleaseByTag({
        owner: this.owner,
        repo: this.repo,
        tag,
      });
      return true;
    } catch (error) {
      // 404 means release doesn't exist
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async assetExistsInRelease(tag: string, assetName: string): Promise<boolean> {
    try {
      const release = await this.octokit.rest.repos.getReleaseByTag({
        owner: this.owner,
        repo: this.repo,
        tag,
      });

      return release.data.assets.some(asset => asset.name === assetName);
    } catch (error) {
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async downloadAsset(url: string, outputPath: string): Promise<void> {
    const fetch = (await import('node-fetch')).default;
    const fs = await import('fs/promises');

    logger.info(`Downloading asset from ${url}...`);

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `token ${this.octokit.auth}`,
          Accept: 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(buffer));

      logger.success(`Downloaded to ${outputPath}`);
    } catch (error) {
      throw new Error(
        `Failed to download asset: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  getPluginAssets(releases: GitHubRelease[]): Map<string, GitHubAsset[]> {
    const pluginAssets = new Map<string, GitHubAsset[]>();

    for (const release of releases) {
      for (const asset of release.assets) {
        // Match plugin archives: {plugin-name}-{version}.pkg (not .sha256 files)
        if (asset.name.endsWith('.pkg') && !asset.name.endsWith('.sha256.pkg')) {
          const match = asset.name.match(/^(.+)-(\d+\.\d+\.\d+.*)\.pkg$/);
          if (match) {
            const pluginName = match[1];
            if (!pluginAssets.has(pluginName)) {
              pluginAssets.set(pluginName, []);
            }
            const assets = pluginAssets.get(pluginName);
            if (assets) {
              assets.push(asset);
            }
          }
        }
      }
    }

    return pluginAssets;
  }
}
