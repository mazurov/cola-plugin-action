# Cola Plugin Action

A comprehensive GitHub Action for Command Launcher plugin lifecycle management. Automates validation and packaging for plugin repositories.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- ✅ **Manifest Validation** - Validates plugin manifests against Command Launcher specification
- 📦 **Multi-format Packaging** - Creates ZIP archives for releases and/or pushes to OCI registries
- 🔧 **Local Testing** - Full support for local testing without GitHub infrastructure
- 🚀 **Easy Integration** - Simple YAML configuration for any plugin repository

## 📚 Ready-to-Use Workflow Template

Check out the complete CI/CD workflow example:

- **[Full CI/CD Pipeline](examples/workflows/plugins-ci.yml)** - Complete automation with validation, testing, and releases

This example includes:
- ✅ Manifest validation on every push and PR
- 📦 Test packaging on PRs
- 🚀 Automated releases to GitHub and OCI registry
- 🧹 Artifact cleanup

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
          packages-directory: 'packages'
          validate-only: 'true'
```

### Package Plugins

```yaml
name: Package Plugins

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  package:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: criteo/cola-plugin-action@v1
        with:
          packages-directory: 'packages'
          package-format: 'zip'

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: plugins
          path: build/packages/*.pkg
```

### OCI Registry Push

```yaml
- uses: criteo/cola-plugin-action@v1
  with:
    packages-directory: 'packages'
    package-format: 'oci'
    oci-registry: 'ghcr.io/${{ github.repository_owner }}'
    oci-username: ${{ github.actor }}
    oci-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `packages-directory` | Yes | `packages` | Root directory containing plugin subdirectories |
| `validate-only` | No | `false` | Only validate manifests without packaging |
| `package-format` | No | `zip` | Package format: `zip`, `oci`, or `both` |
| `oci-registry` | No | - | OCI registry URL (e.g., `ghcr.io/username`) |
| `oci-username` | No | - | OCI registry username |
| `oci-token` | No | - | OCI registry token/password |

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

# Test packaging (creates .pkg files)
make test-package

# Test package verification (.pkg files)
make test-verify

# Run all tests
make test-all

# Clean up
make clean
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

# Verify package (.pkg file)
bash scripts/verify-package.sh build/packages/valid-test-1.0.0.pkg
```

### Build Directory Structure

All build artifacts are organized in the `build/` directory:

```
build/
├── packages/                      # Packaged plugins
│   ├── plugin-1.0.0.pkg
│   └── plugin-1.0.0.json
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
          packages-directory: 'packages'
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
          packages-directory: 'packages'
          package-format: 'both'
          oci-registry: 'ghcr.io/${{ github.repository_owner }}'
          oci-username: ${{ github.actor }}
          oci-token: ${{ secrets.GITHUB_TOKEN }}

      - uses: softprops/action-gh-release@v1
        with:
          files: build/packages/*.pkg
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

## Required Permissions

```yaml
permissions:
  contents: write    # For creating releases
  packages: write    # For OCI registry push
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
