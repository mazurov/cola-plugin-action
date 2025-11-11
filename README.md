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
          path: releases/*.tar.gz
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

Your plugin must include a `manifest.mf` file with the following structure:

```
Name: My Plugin
Version: 1.0.0
Command-Name: my-plugin
Description: A brief description of what this plugin does
Author: Your Name <email@example.com>
License: MIT
Homepage: https://example.com
Repository: https://github.com/username/repo
```

### Required Fields

- **Name** - Plugin display name
- **Version** - Semantic version (e.g., `1.0.0`, `2.1.0-beta`)
- **Command-Name** - CLI command name (lowercase, alphanumeric with hyphens)

### Optional Fields

- **Description** - Human-readable description
- **Author** - Plugin author/maintainer
- **License** - SPDX license identifier
- **Homepage** - Project homepage URL
- **Repository** - Source repository URL
- **Dependencies** - Comma-separated plugin dependencies
- **Min-Launcher-Version** - Minimum launcher version
- **Max-Launcher-Version** - Maximum launcher version
- **OS** - Target operating systems (linux, darwin, windows)
- **Arch** - Target architectures (amd64, arm64)
- **Tags** - Comma-separated tags for categorization
- **Entry-Point** - Main executable path
- **Config-Schema** - JSON schema for configuration

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

The `make test-docs` command generates documentation locally for preview without pushing to GitHub:

```bash
make test-docs
```

This will:
1. Generate HTML documentation from plugin manifests in `tests/fixtures`
2. Create an `index.html` and individual plugin pages in `build/docs/`
3. Automatically open the documentation in your default browser
4. Show the local file path for manual access

**Manual testing with custom plugins:**

```bash
# Test with your own plugin directory
PLUGINS_DIR="my-plugins" bash scripts/test-docs-locally.sh

# Or modify the default location
export PLUGINS_DIR="my-plugins"
export TEMPLATE_PATH="templates/plugin-page.html"
export OUTPUT_DIR="build/docs-custom"
bash scripts/test-docs-locally.sh
```

**Serve with live reload:**

```bash
cd build/docs
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

# View generated documentation
open build/docs/index.html
```

### Build Directory Structure

All build artifacts are organized in the `build/` directory:

```
build/
├── packages/              # Packaged plugins
│   ├── plugin-1.0.0.tar.gz
│   ├── plugin-1.0.0.json
│   └── plugin-1.0.0.tar.gz.sha256
├── docs/                  # Generated documentation
│   ├── index.html
│   └── plugins/
│       └── plugin-name.html
└── test_output.txt        # Test outputs
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
          files: releases/*.tar.gz
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

**Error: Invalid version format**
```
Version: v1.0.0  # ❌ Wrong
Version: 1.0.0   # ✅ Correct
```

**Error: Missing required field**

Ensure your manifest includes all required fields: `Name`, `Version`, and `Command-Name`.

**Error: Invalid command name**

Command names must be lowercase alphanumeric with hyphens only:
```
Command-Name: My-Plugin  # ❌ Wrong (uppercase)
Command-Name: my_plugin  # ❌ Wrong (underscore)
Command-Name: my-plugin  # ✅ Correct
```

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
