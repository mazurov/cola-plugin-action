import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import semver from 'semver';
import { logger } from './utils/logger';
import { GitHubClient } from './utils/github-api';
import { extractArchiveFiles, parsePluginArchiveName, formatBytes } from './utils/archive';
import { readManifest } from './utils/manifest';
import type { PluginManifest } from './types/manifest';
import { renderMarkdown } from './utils/markdown';
import { renderTemplate, generateIndexHtml } from './utils/template';
import {
  generateVersionSelector,
  generateTemplateVariables,
  generateRedirectPage,
} from './utils/docs-generator';
import {
  DocsGenerationOptions,
  DocsGenerationResult,
  PluginDocumentation,
  AllVersionsMetadata,
} from './types/docs';

/**
 * Generate GitHub Pages documentation from releases
 * Replaces generate-docs-from-releases.sh
 */

export async function generateDocs(options: DocsGenerationOptions): Promise<DocsGenerationResult> {
  logger.header('Generating Documentation from GitHub Releases');

  const { repository, githubToken, docsBranch, keepVersions, templatePath } = options;

  logger.info(`Repository: ${repository}`);
  logger.info(`Documentation branch: ${docsBranch}`);
  logger.info(`Keep versions: ${keepVersions} (0 = all)`);

  // Initialize GitHub client
  const github = new GitHubClient(githubToken, repository);

  // Fetch all releases
  const releases = await github.getAllReleases();

  if (releases.length === 0) {
    throw new Error('No releases found in repository');
  }

  logger.info(`Found ${releases.length} release(s)`);

  // Get plugin assets from releases
  const pluginAssets = github.getPluginAssets(releases);

  if (pluginAssets.size === 0) {
    throw new Error('No plugin archives found in releases');
  }

  logger.info(`Found ${pluginAssets.size} plugin(s) in releases`);

  // Create temporary working directory
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-gen-'));
  const docsDir = path.join(workDir, 'docs');
  await fs.mkdir(docsDir, { recursive: true });

  try {
    // Process each plugin
    const pluginDocs: Map<string, PluginDocumentation[]> = new Map();

    for (const [pluginName, assets] of pluginAssets.entries()) {
      logger.startGroup(`Processing: ${pluginName}`);

      try {
        const docs = await processPluginVersions(pluginName, assets, workDir);
        pluginDocs.set(pluginName, docs);

        logger.success(`Processed ${docs.length} version(s) of ${pluginName}`);
      } catch (error) {
        logger.error(
          `Failed to process ${pluginName}: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        logger.endGroup();
      }
    }

    // Apply version cleanup if needed
    if (keepVersions > 0) {
      cleanupOldVersions(pluginDocs, keepVersions);
    }

    // Generate documentation files
    await generateDocumentationFiles(docsDir, pluginDocs, templatePath);

    // Generate versions.json
    const versionsMetadata = generateVersionsMetadata(pluginDocs);
    await fs.writeFile(
      path.join(docsDir, 'versions.json'),
      JSON.stringify(versionsMetadata, null, 2)
    );

    // Clone/checkout gh-pages branch and push
    const docsUrl = await pushToGitHubPages(docsDir, repository, docsBranch, githubToken);

    // Summary
    const totalVersions = Array.from(pluginDocs.values()).reduce(
      (sum, docs) => sum + docs.length,
      0
    );

    logger.header('Documentation Generation Summary');
    logger.info(`Plugins processed: ${pluginDocs.size}`);
    logger.info(`Total versions generated: ${totalVersions}`);
    logger.success(`Documentation URL: ${docsUrl}`);

    // Set outputs
    core.setOutput('docs-url', docsUrl);

    return {
      pluginsProcessed: pluginDocs.size,
      versionsGenerated: totalVersions,
      docsUrl,
    };
  } finally {
    // Cleanup temp directory
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function processPluginVersions(
  pluginName: string,
  assets: { name: string; browser_download_url: string; size: number }[],
  workDir: string
): Promise<PluginDocumentation[]> {
  const docs: PluginDocumentation[] = [];

  for (const asset of assets) {
    logger.info(`Processing: ${asset.name}`);

    const parsedName = parsePluginArchiveName(asset.name);
    if (!parsedName) {
      logger.warning(`Could not parse version from: ${asset.name}`);
      continue;
    }

    try {
      // Download archive
      const archivePath = path.join(workDir, asset.name);
      await downloadFile(asset.browser_download_url, archivePath);

      // Extract manifest and README
      const extractDir = path.join(workDir, `extract-${parsedName.version}`);
      await fs.mkdir(extractDir, { recursive: true });

      await extractArchiveFiles(archivePath, extractDir, [
        `${pluginName}/manifest.mf`,
        `${pluginName}/README.md`,
      ]);

      // Read manifest
      const manifest = await readManifest(path.join(extractDir, pluginName));

      // Read README
      let readmeContent = '';
      let readmeHtml = '';

      try {
        const readmePath = path.join(extractDir, pluginName, 'README.md');
        readmeContent = await fs.readFile(readmePath, 'utf-8');
        readmeHtml = renderMarkdown(readmeContent);
      } catch {
        logger.warning('No README.md found, using default content');
        readmeContent = `# ${manifest.pkgName}\n\nNo documentation available.`;
        readmeHtml = renderMarkdown(readmeContent);
      }

      docs.push({
        pluginName,
        version: manifest.version,
        manifest: {
          pkgName: manifest.pkgName,
          version: manifest.version,
          description: manifest.cmds[0]?.short,
          author: manifest._metadata?.author,
          license: manifest._metadata?.license,
          homepage: manifest._metadata?.homepage,
          repository: manifest._metadata?.repository,
          tags: manifest._metadata?.tags,
          commandName: manifest.cmds[0]?.name,
          commandType: manifest.cmds[0]?.type,
        },
        readme: readmeContent,
        readmeHtml,
        archiveUrl: asset.browser_download_url,
        archiveSize: asset.size,
      });

      // Cleanup extraction
      await fs.rm(extractDir, { recursive: true, force: true });
      await fs.rm(archivePath, { force: true });
    } catch (error) {
      logger.error(
        `Failed to process ${asset.name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Sort by version (newest first)
  docs.sort((a, b) => semver.rcompare(a.version, b.version));

  return docs;
}

function cleanupOldVersions(
  pluginDocs: Map<string, PluginDocumentation[]>,
  keepVersions: number
): void {
  for (const [pluginName, docs] of pluginDocs.entries()) {
    if (docs.length > keepVersions) {
      const removed = docs.length - keepVersions;
      docs.splice(keepVersions);
      logger.info(`Kept ${keepVersions} newest versions of ${pluginName} (removed ${removed})`);
    }
  }
}

async function generateDocumentationFiles(
  docsDir: string,
  pluginDocs: Map<string, PluginDocumentation[]>,
  templatePath: string
): Promise<void> {
  logger.section('Generating Documentation Files');

  const pluginsDir = path.join(docsDir, 'plugins');
  await fs.mkdir(pluginsDir, { recursive: true });

  // Generate plugin documentation
  for (const [pluginName, docs] of pluginDocs.entries()) {
    const pluginDir = path.join(pluginsDir, pluginName);
    await fs.mkdir(pluginDir, { recursive: true });

    const versions = docs.map(d => d.version);
    const latestVersion = versions[0];

    // Generate version index page
    await generateVersionIndexPage(pluginDir, pluginName, latestVersion);

    // Generate each version's documentation
    for (const doc of docs) {
      const versionDir = path.join(pluginDir, `v${doc.version}`);
      await fs.mkdir(versionDir, { recursive: true });

      await generateVersionPage(versionDir, doc, versions, templatePath);
    }

    logger.success(`Generated documentation for ${pluginName} (${versions.length} versions)`);
  }

  // Generate root index page
  await generateRootIndex(docsDir, pluginDocs);
}

async function generateVersionIndexPage(
  pluginDir: string,
  pluginName: string,
  latestVersion: string
): Promise<void> {
  await generateRedirectPage(path.join(pluginDir, 'index.html'), pluginName, latestVersion);
}

async function generateVersionPage(
  versionDir: string,
  doc: PluginDocumentation,
  allVersions: string[],
  templatePath: string
): Promise<void> {
  // Use shared version selector generator
  const versionSelector = generateVersionSelector(allVersions, doc.version);

  // Get full manifest for proper template variable generation
  const manifest = {
    pkgName: doc.manifest.pkgName,
    version: doc.version,
    cmds: doc.manifest.commandName
      ? [
          {
            name: doc.manifest.commandName,
            type: doc.manifest.commandType || 'executable',
            short: doc.manifest.description,
          },
        ]
      : [],
    _metadata: {
      author: doc.manifest.author,
      license: doc.manifest.license,
      homepage: doc.manifest.homepage,
      repository: doc.manifest.repository,
      tags: doc.manifest.tags,
    },
  };

  // Use shared template variables generator
  // Type assertion needed because manifest structure differs slightly
  const variables = generateTemplateVariables(
    manifest as unknown as PluginManifest,
    doc.version,
    doc.readmeHtml,
    versionSelector
  );

  // Add additional variables specific to production
  Object.assign(variables, {
    ARCHIVE_URL: doc.archiveUrl,
    ARCHIVE_SIZE: formatBytes(doc.archiveSize),
  });

  try {
    const template = await fs.readFile(templatePath, 'utf-8');
    const html = renderTemplate(template, variables);
    await fs.writeFile(path.join(versionDir, 'index.html'), html);
  } catch (error) {
    // Fallback to basic HTML if template not found
    logger.warning(`Template not found, using basic HTML: ${templatePath}`);
    const basicHtml = generateBasicHtml(doc, versionSelector);
    await fs.writeFile(path.join(versionDir, 'index.html'), basicHtml);
  }
}

function generateBasicHtml(doc: PluginDocumentation, versionSelector: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${doc.pluginName} v${doc.version}</title>
  <style>
    body { font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; }
    .version-selector { margin: 1rem 0; }
    .metadata { background: #f5f5f5; padding: 1rem; margin: 1rem 0; }
  </style>
</head>
<body>
  ${versionSelector}
  <h1>${doc.pluginName}</h1>
  <p>Version: ${doc.version}</p>
  <div class="metadata">
    ${doc.manifest.description ? `<p><strong>Description:</strong> ${doc.manifest.description}</p>` : ''}
    ${doc.manifest.author ? `<p><strong>Author:</strong> ${doc.manifest.author}</p>` : ''}
    ${doc.manifest.license ? `<p><strong>License:</strong> ${doc.manifest.license}</p>` : ''}
  </div>
  <div class="readme">
    ${doc.readmeHtml}
  </div>
  <hr>
  <p><a href="${doc.archiveUrl}">Download ${doc.pluginName}-${doc.version}.tar.gz</a> (${formatBytes(doc.archiveSize)})</p>
</body>
</html>`;
}

async function generateRootIndex(
  docsDir: string,
  pluginDocs: Map<string, PluginDocumentation[]>
): Promise<void> {
  const plugins = Array.from(pluginDocs.entries()).map(([name, docs]) => ({
    name,
    version: docs[0].version,
    description: docs[0].manifest.description,
    tags: docs[0].manifest.tags,
  }));

  const html = generateIndexHtml(plugins);
  await fs.writeFile(path.join(docsDir, 'index.html'), html);
}

function generateVersionsMetadata(
  pluginDocs: Map<string, PluginDocumentation[]>
): AllVersionsMetadata {
  const plugins: Record<string, string[]> = {};

  for (const [pluginName, docs] of pluginDocs.entries()) {
    plugins[pluginName] = docs.map(d => d.version);
  }

  return {
    plugins,
    generated: new Date().toISOString(),
  };
}

async function pushToGitHubPages(
  docsDir: string,
  repository: string,
  branch: string,
  token: string
): Promise<string> {
  logger.section('Pushing to GitHub Pages');

  const [owner, repo] = repository.split('/');
  const remoteUrl = `https://x-access-token:${token}@github.com/${repository}.git`;

  // Configure git
  await exec.exec('git', ['config', '--global', 'user.name', 'github-actions[bot]']);
  await exec.exec('git', [
    'config',
    '--global',
    'user.email',
    'github-actions[bot]@users.noreply.github.com',
  ]);

  // Initialize or clone gh-pages
  try {
    // Try to clone existing branch
    await exec.exec('git', ['clone', '--depth=1', '--branch', branch, remoteUrl, docsDir]);
    // Remove existing files except .git
    const files = await fs.readdir(docsDir);
    for (const file of files) {
      if (file !== '.git') {
        await fs.rm(path.join(docsDir, file), { recursive: true, force: true });
      }
    }
  } catch {
    // Branch doesn't exist, create new one
    logger.info(`Branch ${branch} doesn't exist, creating new one`);
    await exec.exec('git', ['init'], { cwd: docsDir });
    await exec.exec('git', ['checkout', '-b', branch], { cwd: docsDir });
    await exec.exec('git', ['remote', 'add', 'origin', remoteUrl], { cwd: docsDir });
  }

  // Add all files
  await exec.exec('git', ['add', '.'], { cwd: docsDir });

  // Commit
  const commitMessage = `docs: Update documentation\n\nGenerated on ${new Date().toISOString()}`;
  await exec.exec('git', ['commit', '-m', commitMessage], { cwd: docsDir });

  // Push
  await exec.exec('git', ['push', '-f', 'origin', branch], { cwd: docsDir });

  logger.success(`Documentation pushed to ${branch} branch`);

  return `https://${owner}.github.io/${repo}/`;
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(buffer));
}
