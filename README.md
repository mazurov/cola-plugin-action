# Cola Plugin Action

A comprehensive GitHub Action for Command Launcher plugin lifecycle management. Automates validation, packaging, and documentation generation for plugin repositories.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- ✅ **Manifest Validation** - Validates plugin manifests against Command Launcher specification
- 📦 **Multi-format Packaging** - Creates tar.gz archives and/or pushes to OCI registries
- 📚 **Auto-documentation** - Generates beautiful GitHub Pages documentation
- 🔧 **Local Testing** - Full support for local testing without GitHub infrastructure
- 🚀 **Easy Integration** - Simple YAML configuration for any plugin repository

## 📚 Ready-to-Use Workflow Templates

Check out the [examples/](examples/) directory for complete workflow templates:

- **[Simple Release](examples/workflows/plugins-simple.yml)** - Basic validation and releases
- **[Full CI/CD Pipeline](examples/workflows/plugins-ci.yml)** - Complete automation with PR previews
- **[Tag-Based Release](examples/workflows/plugins-tag-release.yml)** - Semantic versioning with git tags
- **[Scheduled Maintenance](examples/workflows/plugins-scheduled.yml)** - Automated weekly checks

See [examples/WORKFLOW_EXAMPLES.md](examples/WORKFLOW_EXAMPLES.md) for detailed setup instructions and customization guide.

## Quick Start

### Basic Usage (Validation Only)

```yaml
name: Validate Plugins

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          validate-only: 'true'
```

### Full Pipeline (Package + Docs)

```yaml
name: Package and Publish

on:
  push:
    branches: [main]

permissions:
  contents: write
  pages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          package-format: 'tar.gz'
          generate-docs: 'true'

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: plugins
          path: build/packages/*.tar.gz
```

### OCI Registry Push

```yaml
- uses: criteo/cola-plugin-action@v1
  with:
    plugins-directory: 'plugins'
    package-format: 'oci'
    oci-registry: 'ghcr.io/${{ github.repository_owner }}'
    oci-username: ${{ github.actor }}
    oci-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `plugins-directory` | Yes | `plugins` | Root directory containing plugin subdirectories |
| `validate-only` | No | `false` | Only validate manifests without packaging |
| `package-format` | No | `tar.gz` | Package format: `tar.gz`, `oci`, or `both` |
| `oci-registry` | No | - | OCI registry URL (e.g., `ghcr.io/username`) |
| `oci-username` | No | - | OCI registry username |
| `oci-token` | No | - | OCI registry token/password |
| `generate-docs` | No | `true` | Generate documentation pages |
| `docs-branch` | No | `gh-pages` | Branch to push documentation |
| `github-token` | No | `${{ github.token }}` | GitHub token for pushing to gh-pages |

## Outputs

| Output | Description |
|--------|-------------|
| `validated-plugins` | JSON array of validated plugin directories |
| `packaged-artifacts` | JSON array of created artifact paths |
| `docs-url` | URL to generated documentation |

## Manifest Format

Your plugin must include a `manifest.mf` file in **JSON or YAML format** following the Command Launcher specification.

📖 **Full specification**: [Command Launcher Manifest Documentation](https://criteo.github.io/command-launcher/docs/overview/manifest/)

### Quick Example (JSON)

```json
{
  "pkgName": "my-plugin",
  "version": "1.0.0",
  "cmds": [
    {
      "name": "my-plugin",
      "type": "executable",
      "short": "A brief description of what this plugin does",
      "executable": "{{.PackageDir}}/bin/my-plugin"
    }
  ],
  "_metadata": {
    "author": "Your Name <email@example.com>",
    "license": "MIT",
    "homepage": "https://example.com"
  }
}
```

### Quick Example (YAML)

```yaml
pkgName: my-plugin
version: 1.0.0
cmds:
  - name: my-plugin
    type: executable
    short: A brief description of what this plugin does
    executable: "{{.PackageDir}}/bin/my-plugin"
_metadata:
  author: "Your Name <email@example.com>"
  license: MIT
  homepage: https://example.com
```

### Key Fields

- **pkgName** - Package name (required)
- **version** - Semantic version like `1.0.0` (required)
- **cmds** - Array of commands (at least one required)
  - **name** - Command name (required)
  - **type** - Command type: `executable`, `alias`, or `starlark` (required)
  - **short** - Brief description (recommended)
  - **executable** - Path to executable for executable type

See the [official documentation](https://criteo.github.io/command-launcher/docs/overview/manifest/) for all available fields and advanced features.

## Repository Structure

Your plugin repository should follow this structure:

```
my-plugins-repo/
├── plugins/
│   ├── plugin-one/
│   │   ├── manifest.mf       # Required
│   │   ├── README.md         # Recommended
│   │   ├── bin/
│   │   └── lib/
│   ├── plugin-two/
│   │   ├── manifest.mf
│   │   ├── README.md
│   │   └── src/
│   └── plugin-three/
│       ├── manifest.mf
│       └── README.md
└── .github/
    └── workflows/
        └── release.yml
```

## Local Development

### Prerequisites

```bash
# Ubuntu/Debian
sudo apt-get install -y yq git pandoc bc

# macOS
brew install yq git pandoc bc
```

### Testing

```bash
# Quick validation test
make test-validate

# Test packaging
make test-package

# Test package verification
make test-verify

# Test documentation generation
make test-docs

# Run all tests
make test-all

# Clean up
make clean
```

#### Testing Documentation Generation Locally

The `make test-docs` command generates versioned documentation from mock releases locally for preview without pushing to GitHub:

```bash
make test-docs
```

This will:
1. Create mock GitHub Release archives for each plugin version in `tests/valid`
2. Generate versioned HTML documentation from release assets
3. Create version selectors for each plugin
4. Output to `build/docs-from-releases/` with full version history
5. Display the generated structure and version metadata

**Manual testing with custom plugins:**

```bash
# Test with your own plugin directory
PLUGINS_DIR="my-plugins" bash scripts/test-docs-from-releases.sh

# Or modify the default location
export PLUGINS_DIR="my-plugins"
export TEMPLATE_PATH="templates/plugin-page.html"
export OUTPUT_DIR="build/docs-from-releases-custom"
bash scripts/test-docs-from-releases.sh
```

**Generated structure:**
```
build/docs-from-releases/
├── index.html                    # Main landing page
├── versions.json                 # Version metadata for all plugins
└── plugins/
    ├── plugin-one/
    │   ├── index.html           # Version selector page
    │   ├── v1.0.0/
    │   │   └── index.html       # Plugin docs for v1.0.0
    │   ├── v1.1.0/
    │   │   └── index.html       # Plugin docs for v1.1.0
    │   └── v2.0.0/
    │       └── index.html       # Plugin docs for v2.0.0 (latest)
    └── plugin-two/
        └── ...
```

**Serve with live reload:**

```bash
cd build/docs-from-releases
python3 -m http.server 8000
# Open http://localhost:8000 in browser
```

### Manual Testing

```bash
# Set environment variables
export PLUGINS_DIR="tests/fixtures"
export GITHUB_OUTPUT="build/test_output.txt"
export OUTPUT_DIR="build/packages"

# Test validation
bash scripts/validate-manifest.sh

# Test packaging
bash scripts/package-plugin.sh

# Verify package
bash scripts/verify-package.sh build/packages/valid-test-1.0.0.tar.gz

# Generate and view versioned documentation
bash scripts/test-docs-from-releases.sh
open build/docs-from-releases/index.html
```

### Build Directory Structure

All build artifacts are organized in the `build/` directory:

```
build/
├── packages/                      # Packaged plugins
│   ├── plugin-1.0.0.tar.gz
│   ├── plugin-1.0.0.json
│   └── plugin-1.0.0.tar.gz.sha256
├── docs-from-releases/            # Generated versioned documentation
│   ├── index.html                # Main landing page
│   ├── versions.json             # Version metadata
│   └── plugins/
│       ├── plugin-one/
│       │   ├── index.html        # Version selector
│       │   ├── v1.0.0/
│       │   │   └── index.html
│       │   └── v2.0.0/
│       │       └── index.html
│       └── plugin-two/
│           └── ...
└── test_output.txt                # Test outputs
```

**Benefits:**
- ✅ Single directory for all build outputs
- ✅ Easy cleanup: `make clean` or `rm -rf build/`
- ✅ In `.gitignore` - never committed
- ✅ Organized structure for CI/CD pipelines

### Testing with act

[act](https://github.com/nektos/act) allows you to run GitHub Actions locally for faster development and testing.

#### Install act

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows
choco install act-cli
```

#### Run workflows locally

```bash
# List all jobs in workflows
act -l

# Run all jobs with push event
act push

# Run all jobs with pull_request event
act pull_request

# Run specific job
act -j test-validation
act -j test-packaging

# Dry run (show what would be executed)
act -n

# Run with verbose output
act -v
```

#### Advanced usage

```bash
# Use specific workflow file
act -W .github/workflows/test.yml

# Use specific Docker image for better compatibility
act -P ubuntu-latest=catthehacker/ubuntu:act-latest

# With environment variables
act --env PLUGINS_DIR=tests/fixtures

# Bind mount current directory
act --bind
```

#### Create .actrc configuration

Create a `.actrc` file in the project root for default options:

```
-P ubuntu-latest=catthehacker/ubuntu:act-latest
--bind
-v
```

Now you can simply run: `act`

**Note**: act requires Docker to be installed and running.

For more detailed information, see [ACT Testing Guide](docs/ACT_TESTING_GUIDE.md).

## Examples

### Validation on Pull Requests

```yaml
name: Validate Plugins

on:
  pull_request:
    paths: ['plugins/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          validate-only: 'true'
```

### Release on Tag

```yaml
name: Release Plugins

on:
  push:
    tags: ['v*']

permissions:
  contents: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          package-format: 'both'
          oci-registry: 'ghcr.io/${{ github.repository_owner }}'
          oci-username: ${{ github.actor }}
          oci-token: ${{ secrets.GITHUB_TOKEN }}

      - uses: softprops/action-gh-release@v1
        with:
          files: build/packages/*.tar.gz
```

### Documentation Only

```yaml
name: Update Docs

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          validate-only: 'false'
          package-format: 'tar.gz'
          generate-docs: 'true'
```

## Troubleshooting

### Validation Failures

**Error: Invalid manifest format**

Ensure your `manifest.mf` is valid JSON or YAML:
```json
{
  "pkgName": "my-plugin",  // ❌ Wrong - no comments in JSON
  "version": "1.0.0"
}
```

```json
{
  "pkgName": "my-plugin",
  "version": "1.0.0"        // ✅ Correct
}
```

**Error: Invalid version format**

Version must follow semantic versioning (no `v` prefix):
```json
"version": "v1.0.0"  // ❌ Wrong
"version": "1.0.0"   // ✅ Correct
```

**Error: Missing required field**

Ensure your manifest includes: `pkgName`, `version`, and at least one command in `cmds` array.

**Error: Invalid command name**

Command names must be lowercase alphanumeric with hyphens:
```json
"name": "My-Plugin"   // ❌ Wrong (uppercase)
"name": "my_plugin"   // ❌ Wrong (underscore)
"name": "my-plugin"   // ✅ Correct
```

For complete validation rules, see the [manifest specification](https://criteo.github.io/command-launcher/docs/overview/manifest/).

### OCI Push Failures

- Verify registry URL format: `ghcr.io/username` (no `https://`)
- Ensure token has `packages:write` permission
- Check network connectivity to registry

### Documentation Issues

- Ensure GitHub token has `contents:write` permission
- Check gh-pages branch exists or action can create it
- For better formatting, install pandoc in workflow

## Required Permissions

```yaml
permissions:
  contents: write    # For gh-pages push
  packages: write    # For OCI registry push
  pages: write       # For GitHub Pages
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Test locally using `make test-all`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## References

- [Command Launcher Documentation](https://criteo.github.io/command-launcher/)
- [Manifest Specification](https://criteo.github.io/command-launcher/docs/overview/manifest/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [ORAS Documentation](https://oras.land/)

## Support

- 📝 [Report Issues](https://github.com/criteo/cola-plugin-action/issues)
- 💬 [Discussions](https://github.com/criteo/cola-plugin-action/discussions)
- 📖 [Documentation](https://github.com/criteo/cola-plugin-action/wiki)

---

**Maintained by**: Alexander @ Criteo
**License**: MIT
**Version**: 1.0.0
