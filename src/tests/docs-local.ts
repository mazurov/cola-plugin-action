#!/usr/bin/env tsx
/**
 * Local documentation testing - Setup mock releases
 * Creates test plugin archives for documentation generation testing
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as childProcess from 'child_process';
import { promisify } from 'util';

const exec = promisify(childProcess.exec);

const TEST_DIR = 'build/docs-local-test';
const RELEASES_DIR = path.join(TEST_DIR, 'releases');
const TEMP_DIR = path.join(TEST_DIR, 'temp');

async function createMockRelease(
  pluginName: string,
  version: string,
  baseManifest: string,
  baseReadme: string,
  versionNotes?: string
): Promise<void> {
  const tempPluginDir = path.join(TEMP_DIR, `${pluginName}-${version}`, pluginName);
  await fs.mkdir(tempPluginDir, { recursive: true });

  // Modify manifest version (supports both JSON and YAML formats)
  const manifest = baseManifest
    .replace(/"version":\s*"[^"]*"/, `"version": "${version}"`)  // JSON format
    .replace(/^version:\s*.+$/m, `version: ${version}`);          // YAML format
  await fs.writeFile(path.join(tempPluginDir, 'manifest.mf'), manifest);

  // Create README with version notes
  let readme = baseReadme;
  if (versionNotes) {
    readme += `\n\n## Version ${version}\n${versionNotes}\n`;
  }
  await fs.writeFile(path.join(tempPluginDir, 'README.md'), readme);

  // Create tar.gz
  const archiveName = `${pluginName}-${version}.tar.gz`;
  const archivePath = path.join(RELEASES_DIR, archiveName);
  
  await exec(
    `tar -czf "${archivePath}" -C "${path.join(TEMP_DIR, `${pluginName}-${version}`)}" "${pluginName}"`
  );

  console.log(`  ✓ Created: ${archiveName}`);
}

async function main() {
  console.log('================================');
  console.log('Local Documentation Test Setup');
  console.log('================================\n');

  // Clean and create directories
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(RELEASES_DIR, { recursive: true });

  // Read base fixtures
  const validPluginManifest = await fs.readFile('tests/valid/valid-plugin/manifest.mf', 'utf-8');
  const validPluginReadme = await fs.readFile('tests/valid/valid-plugin/README.md', 'utf-8');
  const yamlPluginManifest = await fs.readFile('tests/valid/yaml-plugin/manifest.mf', 'utf-8');
  const yamlPluginReadme = await fs.readFile('tests/valid/yaml-plugin/README.md', 'utf-8');

  console.log('Creating mock releases...\n');

  // Create valid-plugin versions
  console.log('valid-plugin:');
  await createMockRelease('valid-plugin', '1.0.0', validPluginManifest, validPluginReadme);
  await createMockRelease(
    'valid-plugin',
    '1.1.0',
    validPluginManifest,
    validPluginReadme,
    '- Enhanced functionality\n- Bug fixes'
  );
  await createMockRelease(
    'valid-plugin',
    '1.2.0',
    validPluginManifest,
    validPluginReadme,
    '- New commands\n- Performance improvements\n- Updated documentation'
  );

  // Create yaml-plugin versions
  console.log('\nyaml-plugin:');
  await createMockRelease('yaml-plugin', '1.0.0', yamlPluginManifest, yamlPluginReadme);
  await createMockRelease(
    'yaml-plugin',
    '2.0.0',
    yamlPluginManifest,
    yamlPluginReadme,
    '- Major release\n- Breaking changes'
  );

  console.log('\n================================');
  console.log('✓ Test Environment Ready!');
  console.log('================================\n');

  const stats = await fs.readdir(RELEASES_DIR);
  console.log(`Created ${stats.length} plugin archives\n`);
  console.log('Next step:');
  console.log('  npm run test:docs-generate\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
