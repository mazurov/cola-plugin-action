import * as fs from 'fs/promises';
import { PluginManifest } from '../types/manifest';

/**
 * Shared documentation generation utilities
 * Used by both production (src/docs.ts) and testing (scripts/test-docs-standalone.js)
 */

export function escapeHtml(text: string | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateMetadataItems(manifest: PluginManifest): string {
  const items: string[] = [];

  if (manifest._metadata?.author) {
    items.push(`
            <div class="metadata-item">
                <div class="metadata-label">Author</div>
                <div class="metadata-value">${escapeHtml(manifest._metadata.author)}</div>
            </div>`);
  }

  if (manifest._metadata?.license) {
    items.push(`
            <div class="metadata-item">
                <div class="metadata-label">License</div>
                <div class="metadata-value">${escapeHtml(manifest._metadata.license)}</div>
            </div>`);
  }

  if (manifest._metadata?.repository) {
    items.push(`
            <div class="metadata-item">
                <div class="metadata-label">Repository</div>
                <div class="metadata-value"><a href="${escapeHtml(manifest._metadata.repository)}" target="_blank">${escapeHtml(manifest._metadata.repository)}</a></div>
            </div>`);
  }

  if (manifest._metadata?.homepage) {
    items.push(`
            <div class="metadata-item">
                <div class="metadata-label">Homepage</div>
                <div class="metadata-value"><a href="${escapeHtml(manifest._metadata.homepage)}" target="_blank">${escapeHtml(manifest._metadata.homepage)}</a></div>
            </div>`);
  }

  if (manifest.cmds && manifest.cmds.length > 0) {
    items.push(`
            <div class="metadata-item">
                <div class="metadata-label">Commands</div>
                <div class="metadata-value">${manifest.cmds.length}</div>
            </div>`);
  }

  if (manifest._metadata?.tags && manifest._metadata.tags.length > 0) {
    const tagsHtml = manifest._metadata.tags
      .map(tag => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join('');
    items.push(`
            <div class="metadata-item">
                <div class="metadata-label">Tags</div>
                <div class="metadata-value">
                    <div class="tags">${tagsHtml}</div>
                </div>
            </div>`);
  }

  return items.join('\n');
}

export function generateCommandsSection(manifest: PluginManifest): string {
  if (!manifest.cmds || manifest.cmds.length === 0) {
    return '';
  }

  const commandCards = manifest.cmds
    .map(cmd => {
      const detailsHtml: string[] = [];

      if (cmd.executable) {
        detailsHtml.push(`
                        <div class="command-detail-label">Executable:</div>
                        <div class="command-detail-value">${escapeHtml(cmd.executable)}</div>`);
      }

      // Group is an optional field not in the type definition but may exist in manifests
      const group = (cmd as { group?: string }).group;
      if (group) {
        detailsHtml.push(`
                        <div class="command-detail-label">Group:</div>
                        <div class="command-detail-value">${escapeHtml(group)}</div>`);
      }

      return `
            <div class="command-card">
                <div class="command-header">
                    <span class="command-code">${escapeHtml(cmd.name)}</span>
                    <span class="command-type">${escapeHtml(cmd.type || 'executable')}</span>
                </div>
                ${cmd.short ? `<div class="command-description">${escapeHtml(cmd.short)}</div>` : ''}
                ${cmd.long ? `<div class="command-description" style="margin-top: 0.5rem; font-size: 0.9rem;">${escapeHtml(cmd.long)}</div>` : ''}
                ${detailsHtml.length > 0 ? `<div class="command-details">${detailsHtml.join('')}</div>` : ''}
            </div>`;
    })
    .join('\n');

  return `
        <div class="commands-section">
            <h2>Available Commands</h2>
            <div class="command-list">
${commandCards}
            </div>
        </div>`;
}

export function generateVersionSelector(
  versions: string[],
  currentVersion: string,
  style?: string
): string {
  const versionOptions = versions
    .map(v => {
      const selected = v === currentVersion ? ' selected' : '';
      return `<option value="v${v}"${selected}>v${v}</option>`;
    })
    .join('\n          ');

  const defaultStyle =
    style ||
    'padding: 0.5rem 1rem; border-radius: 6px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; font-size: 0.9rem; cursor: pointer; font-weight: 600;';

  return `<div class="version-selector" style="margin-top: 1rem;">
        <label for="version-select" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: white; opacity: 0.9;">Version:</label>
        <select id="version-select" onchange="window.location.href='../' + this.value + '/index.html'" style="${defaultStyle}">
          ${versionOptions}
        </select>
      </div>`;
}

export interface TemplateVariables {
  PLUGIN_NAME: string;
  VERSION: string;
  PLUGIN_VERSION: string;
  COMMAND_NAME: string;
  VERSION_SELECTOR: string;
  METADATA_ITEMS: string;
  COMMANDS_SECTION: string;
  README_CONTENT: string;
  [key: string]: string;
}

export function generateTemplateVariables(
  manifest: PluginManifest,
  version: string,
  readmeHtml: string,
  versionSelector: string
): TemplateVariables {
  const primaryCommand =
    manifest.cmds && manifest.cmds.length > 0 ? manifest.cmds[0].name : manifest.pkgName;

  return {
    PLUGIN_NAME: manifest.pkgName,
    VERSION: version,
    PLUGIN_VERSION: version,
    COMMAND_NAME: primaryCommand,
    VERSION_SELECTOR: versionSelector,
    METADATA_ITEMS: generateMetadataItems(manifest),
    COMMANDS_SECTION: generateCommandsSection(manifest),
    README_CONTENT: readmeHtml,
  };
}

export async function generateVersionIndexPage(
  outputPath: string,
  pluginName: string,
  versions: string[],
  templatePath?: string
): Promise<void> {
  let template: string;

  // Try to load template
  if (templatePath) {
    try {
      template = await fs.readFile(templatePath, 'utf-8');
    } catch {
      template = await generateFallbackVersionIndex();
    }
  } else {
    template = await generateFallbackVersionIndex();
  }

  // Generate version items HTML
  const versionItems = versions
    .map((version, index) => {
      const isLatest = index === 0;
      const badge = isLatest ? '<span class="version-badge badge-latest">Latest</span>' : '';

      return `
            <div class="version-item">
                <div class="version-info">
                    <div class="version-number">v${escapeHtml(version)}${badge}</div>
                </div>
                <a href="v${escapeHtml(version)}/index.html" class="version-link">View Documentation →</a>
            </div>`;
    })
    .join('\n');

  // Replace template variables
  const html = template
    .replace(/\{\{PLUGIN_NAME\}\}/g, escapeHtml(pluginName))
    .replace(/\{\{VERSION_ITEMS\}\}/g, versionItems);

  await fs.writeFile(outputPath, html);
}

async function generateFallbackVersionIndex(): Promise<string> {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{PLUGIN_NAME}} - Version History</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 3rem 0; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .subtitle { font-size: 1.2rem; opacity: 0.9; }
        .container { max-width: 900px; margin: 2rem auto; padding: 0 2rem; }
        .back-link { display: inline-block; margin-bottom: 1rem; color: rgba(255, 255, 255, 0.9); text-decoration: none; }
        .back-link:hover { color: white; text-decoration: underline; }
        .version-list { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .version-item { padding: 1.5rem; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s; }
        .version-item:last-child { border-bottom: none; }
        .version-item:hover { background: #f9f9f9; }
        .version-number { font-size: 1.3rem; font-weight: 600; color: #667eea; font-family: 'Monaco', monospace; }
        .version-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin-left: 0.5rem; }
        .badge-latest { background: #4caf50; color: white; }
        .version-link { display: inline-flex; align-items: center; padding: 0.6rem 1.2rem; background: #667eea; color: white; text-decoration: none; border-radius: 6px; transition: background 0.2s; }
        .version-link:hover { background: #5568d3; }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <a href="../index.html" class="back-link">← Back to All Plugins</a>
            <h1>{{PLUGIN_NAME}}</h1>
            <p class="subtitle">Version History</p>
        </div>
    </header>
    <div class="container">
        <div class="version-list">
            {{VERSION_ITEMS}}
        </div>
    </div>
</body>
</html>`;
}

// Deprecated: Use generateVersionIndexPage instead
export async function generateRedirectPage(
  outputPath: string,
  pluginName: string,
  latestVersion: string
): Promise<void> {
  // For backward compatibility, generate a simple redirect
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=v${latestVersion}/index.html">
  <title>Redirecting to ${pluginName} v${latestVersion}</title>
</head>
<body>
  <p>Redirecting to <a href="v${latestVersion}/index.html">${pluginName} v${latestVersion}</a>...</p>
</body>
</html>`;

  await fs.writeFile(outputPath, html);
}
