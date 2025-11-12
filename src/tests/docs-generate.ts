#!/usr/bin/env tsx
/**
 * Local documentation testing - Generate docs from mock releases
 * Uses shared utilities to generate documentation without GitHub API
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import semver from 'semver';
import { extractArchiveFiles, parsePluginArchiveName } from '../utils/archive';
import { readManifest } from '../utils/manifest';
import { renderMarkdown } from '../utils/markdown';
import { renderTemplate, generateIndexHtml } from '../utils/template';
import {
  generateVersionSelector,
  generateTemplateVariables,
  generateVersionIndexPage,
} from '../utils/docs-generator';
import { PluginManifest } from '../types/manifest';

const TEST_DIR = 'build/docs-local-test';
const RELEASES_DIR = path.join(TEST_DIR, 'releases');
const DOCS_DIR = path.join(TEST_DIR, 'docs');

interface PluginDoc {
  pluginName: string;
  version: string;
  manifest: PluginManifest;
  readmeHtml: string;
}

async function processPluginVersions(
  pluginName: string,
  archivePaths: string[],
  workDir: string
): Promise<PluginDoc[]> {
  const docs: PluginDoc[] = [];

  for (const archivePath of archivePaths) {
    console.log(`  Processing: ${path.basename(archivePath)}`);

    const parsedName = parsePluginArchiveName(path.basename(archivePath));
    if (!parsedName) {
      console.warn(`  Could not parse version from: ${path.basename(archivePath)}`);
      continue;
    }

    try {
      const extractDir = path.join(workDir, `extract-${parsedName.version}`);
      await fs.mkdir(extractDir, { recursive: true });

      await extractArchiveFiles(archivePath, extractDir, [
        `${pluginName}/manifest.mf`,
        `${pluginName}/README.md`,
      ]);

      const manifest = await readManifest(path.join(extractDir, pluginName));

      let readmeHtml = '';
      try {
        const readmePath = path.join(extractDir, pluginName, 'README.md');
        const readmeContent = await fs.readFile(readmePath, 'utf-8');
        readmeHtml = renderMarkdown(readmeContent);
      } catch {
        console.warn('  No README.md found, using default');
        readmeHtml = renderMarkdown(`# ${manifest.pkgName}\n\nNo documentation available.`);
      }

      docs.push({
        pluginName,
        version: manifest.version,
        manifest,
        readmeHtml,
      });

      await fs.rm(extractDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`  Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  docs.sort((a, b) => semver.rcompare(a.version, b.version));
  return docs;
}

async function generateDocumentation(
  docsDir: string,
  pluginDocs: Map<string, PluginDoc[]>
): Promise<void> {
  // Template is at project root: ./templates/plugin-page.html
  const templatePath = path.join(__dirname, '../../templates/plugin-page.html');
  let template: string | null = null;

  try {
    template = await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    console.warn('Template not found, using fallback HTML');
    console.warn(`  Looked at: ${templatePath}`);
  }

  // Generate plugin pages
  for (const [pluginName, docs] of pluginDocs.entries()) {
    const pluginDir = path.join(docsDir, pluginName);
    const versions = docs.map(d => d.version);

    console.log(`Plugin: ${pluginName} (${versions.length} versions)`);

    // Ensure plugin directory exists
    await fs.mkdir(pluginDir, { recursive: true });

    // Generate version index page (listing all versions)
    const versionIndexTemplatePath = path.join(__dirname, '../../templates/version-index.html');
    await generateVersionIndexPage(
      path.join(pluginDir, 'index.html'),
      pluginName,
      versions,
      versionIndexTemplatePath
    );
    console.log(`  ✓ Version index: ${versions.length} versions listed`);

    // Generate version pages
    for (const doc of docs) {
      const versionDir = path.join(pluginDir, `v${doc.version}`);
      await fs.mkdir(versionDir, { recursive: true });

      const versionSelector = generateVersionSelector(versions, doc.version);
      const variables = generateTemplateVariables(
        doc.manifest,
        doc.version,
        doc.readmeHtml,
        versionSelector
      );

      let html: string;
      if (template) {
        html = renderTemplate(template, variables);
      } else {
        html = generateFallbackHtml(doc, versionSelector);
      }

      await fs.writeFile(path.join(versionDir, 'index.html'), html);
      console.log(`    ✓ v${doc.version}/index.html`);
    }
  }

  // Generate root index
  const pluginsArray = Array.from(pluginDocs.entries()).map(([pluginName, docs]) => {
    const latest = docs[0];
    return {
      name: pluginName,
      version: latest.version,
      description: latest.manifest.cmds[0]?.short,
      tags: latest.manifest._metadata?.tags,
    };
  });

  const indexHtml = generateIndexHtml(pluginsArray);
  await fs.writeFile(path.join(docsDir, 'index.html'), indexHtml);
  console.log('\n✓ Generated: index.html');
}

function generateFallbackHtml(doc: PluginDoc, versionSelector: string): string {
  const manifest = doc.manifest;
  const repoLink = manifest._metadata?.repository
    ? `<a href="${manifest._metadata.repository}">${manifest._metadata.repository}</a>`
    : 'Not specified';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${manifest.pkgName} v${doc.version}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .nav { margin-bottom: 20px; }
    .nav a { color: #0366d6; text-decoration: none; font-weight: 600; }
    .nav a:hover { text-decoration: underline; }
    .header { border-bottom: 1px solid #e1e4e8; padding-bottom: 20px; margin-bottom: 30px; }
    .metadata { display: grid; grid-template-columns: auto 1fr; gap: 10px; padding: 15px; background: #f6f8fa; border-radius: 6px; margin-bottom: 20px; }
    .metadata dt { font-weight: 600; }
    pre { background: #f6f8fa; padding: 15px; border-radius: 6px; overflow-x: auto; }
    code { background: #f6f8fa; padding: 2px 6px; border-radius: 3px; }
    a { color: #0366d6; }
  </style>
</head>
<body>
  <div class="nav">
    <a href="../../index.html">← Back to Plugin Index</a>
  </div>
  <div class="header">
    <h1>${manifest.pkgName}</h1>
    <p>${manifest.cmds[0]?.short || 'No description'}</p>
    ${versionSelector}
  </div>
  <div class="metadata">
    <dt>Version:</dt><dd>${doc.version}</dd>
    <dt>Author:</dt><dd>${manifest._metadata?.author || 'Unknown'}</dd>
    <dt>License:</dt><dd>${manifest._metadata?.license || 'Unknown'}</dd>
    <dt>Repository:</dt><dd>${repoLink}</dd>
  </div>
  <div class="content">
    ${doc.readmeHtml}
  </div>
</body>
</html>`;
}

async function main() {
  console.log('================================');
  console.log('Documentation Generator');
  console.log('Uses shared utilities from src/');
  console.log('================================\n');

  const files = await fs.readdir(RELEASES_DIR);
  const archives = files.filter(f => f.endsWith('.tar.gz'));

  const pluginArchives = new Map<string, string[]>();
  for (const archive of archives) {
    const parsed = parsePluginArchiveName(archive);
    if (parsed) {
      if (!pluginArchives.has(parsed.name)) {
        pluginArchives.set(parsed.name, []);
      }
      pluginArchives.get(parsed.name)!.push(path.join(RELEASES_DIR, archive));
    }
  }

  console.log(`Found ${archives.length} archive(s) for ${pluginArchives.size} plugin(s)\n`);

  const workDir = path.join(TEST_DIR, 'work');
  await fs.mkdir(workDir, { recursive: true });

  const pluginDocs = new Map<string, PluginDoc[]>();
  for (const [pluginName, archivePaths] of pluginArchives.entries()) {
    const docs = await processPluginVersions(pluginName, archivePaths, workDir);
    if (docs.length > 0) {
      pluginDocs.set(pluginName, docs);
    }
  }

  console.log('\nGenerating documentation...\n');
  await generateDocumentation(DOCS_DIR, pluginDocs);

  console.log('\n================================');
  console.log('✓ Success!');
  console.log('================================\n');
  console.log('View at: http://localhost:3000');
  console.log('Run: npm run test:docs-serve\n');
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
