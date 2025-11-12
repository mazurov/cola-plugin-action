/* eslint-disable */
// This is a test file and will be run by Jest, not TypeScript compiler
import { validateManifest, sanitizeName, parsePluginArchiveName } from './manifest';
import { PluginManifest } from '../types/manifest';

describe('validateManifest', () => {
  it('should validate a correct manifest', () => {
    const manifest: PluginManifest = {
      pkgName: 'test-plugin',
      version: '1.0.0',
      cmds: [
        {
          name: 'test',
          type: 'executable',
        },
      ],
    };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject manifest with missing pkgName', () => {
    const manifest = {
      version: '1.0.0',
      cmds: [{ name: 'test', type: 'executable' as const }],
    } as PluginManifest;

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: pkgName');
  });

  it('should reject manifest with invalid version format', () => {
    const manifest: PluginManifest = {
      pkgName: 'test-plugin',
      version: 'v1.0.0', // Invalid - should not have 'v' prefix
      cmds: [{ name: 'test', type: 'executable' }],
    };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid version format'))).toBe(true);
  });

  it('should reject manifest with empty cmds array', () => {
    const manifest: PluginManifest = {
      pkgName: 'test-plugin',
      version: '1.0.0',
      cmds: [],
    };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Missing required field: cmds (must have at least one command)'
    );
  });

  it('should reject command with invalid characters in name', () => {
    const manifest: PluginManifest = {
      pkgName: 'test-plugin',
      version: '1.0.0',
      cmds: [
        {
          name: 'Test_Command', // Invalid - uppercase and underscore
          type: 'executable',
        },
      ],
    };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('invalid characters'))).toBe(true);
  });

  it('should warn about missing recommended metadata', () => {
    const manifest: PluginManifest = {
      pkgName: 'test-plugin',
      version: '1.0.0',
      cmds: [{ name: 'test', type: 'executable' }],
      // No _metadata field
    };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('author'))).toBe(true);
  });
});

describe('sanitizeName', () => {
  it('should convert to lowercase', () => {
    expect(sanitizeName('TestPlugin')).toBe('testplugin');
  });

  it('should replace invalid characters with hyphens', () => {
    expect(sanitizeName('test_plugin')).toBe('test-plugin');
    expect(sanitizeName('test plugin')).toBe('test-plugin');
    expect(sanitizeName('test@plugin')).toBe('test-plugin');
  });

  it('should preserve valid characters', () => {
    expect(sanitizeName('test-plugin-123')).toBe('test-plugin-123');
  });
});

describe('parsePluginArchiveName', () => {
  it('should parse valid archive name', () => {
    const result = parsePluginArchiveName('test-plugin-1.0.0.tar.gz');

    expect(result).toEqual({
      name: 'test-plugin',
      version: '1.0.0',
    });
  });

  it('should parse archive with pre-release version', () => {
    const result = parsePluginArchiveName('test-plugin-1.0.0-beta.1.tar.gz');

    expect(result).toEqual({
      name: 'test-plugin',
      version: '1.0.0-beta.1',
    });
  });

  it('should handle plugin names with hyphens', () => {
    const result = parsePluginArchiveName('my-test-plugin-2.1.3.tar.gz');

    expect(result).toEqual({
      name: 'my-test-plugin',
      version: '2.1.3',
    });
  });

  it('should return null for invalid format', () => {
    expect(parsePluginArchiveName('invalid.tar.gz')).toBeNull();
    expect(parsePluginArchiveName('no-version.tar.gz')).toBeNull();
  });
});
