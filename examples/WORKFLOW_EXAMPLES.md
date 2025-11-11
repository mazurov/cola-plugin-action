# GitHub Workflow Examples for Plugin Repositories

This document provides ready-to-use GitHub workflow examples for Command Launcher plugin repositories.

## Table of Contents

- [Quick Start](#quick-start)
- [Workflow Options](#workflow-options)
- [Setup Instructions](#setup-instructions)
- [Workflow Examples](#workflow-examples)
- [Customization Guide](#customization-guide)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Choose Your Workflow

We provide four workflow templates based on your needs:

| Workflow | Use Case | Features |
|----------|----------|----------|
| **Simple** | Basic validation + releases | Validation, tar.gz packages, GitHub Pages |
| **CI/CD Pipeline** | Full automation | All features, OCI registry, PR previews |
| **Tag-Based Release** | Semantic versioning | Release on git tags (v1.0.0) |
| **Scheduled** | Maintenance | Weekly validation, doc updates |

### 2. Copy Workflow to Your Repository

Copy the appropriate workflow file from `.github/workflows/` to your plugin repository:

```bash
# Example: Copy the simple workflow
cp .github/workflows/plugins-simple.yml YOUR_REPO/.github/workflows/release.yml
```

### 3. Configure Repository Settings

Enable GitHub Pages and set required permissions (see [Setup Instructions](#setup-instructions) below).

---

## Workflow Options

### Option 1: Simple Workflow (`plugins-simple.yml`)

**Best for:** Small repositories, getting started quickly

**Features:**
- ✅ Validates plugin manifests on PRs
- ✅ Creates GitHub Releases with tar.gz packages
- ✅ Generates documentation on GitHub Pages

**Triggers:**
- On push to `main` branch
- On pull requests to `main`

**Usage:**

```yaml
# .github/workflows/release.yml
name: Simple Plugin Release

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    paths: ['plugins/**']

permissions:
  contents: write
  pages: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          validate-only: 'true'

  release:
    runs-on: ubuntu-latest
    needs: validate
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          package-format: 'tar.gz'
          generate-docs: 'true'
          docs-branch: 'gh-pages'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

### Option 2: Full CI/CD Pipeline (`plugins-ci.yml`)

**Best for:** Production repositories, teams, advanced features

**Features:**
- ✅ Comprehensive validation on every PR
- ✅ Test package generation for PRs
- ✅ Documentation preview on PRs
- ✅ GitHub Releases with tar.gz packages
- ✅ OCI registry publishing (GitHub Container Registry)
- ✅ Automated PR comments with results
- ✅ Cleanup of old artifacts

**Triggers:**
- On push to `main` and `develop`
- On pull requests
- Manual workflow dispatch

**Key Jobs:**

1. **validate** - Validates all plugin manifests
2. **test-package** - Tests package generation (PRs only)
3. **docs-preview** - Generates documentation preview (PRs only)
4. **release** - Publishes to GitHub Releases + OCI registry (main only)
5. **cleanup** - Removes old workflow artifacts

**Repository Structure:**

```
your-plugin-repo/
├── plugins/
│   ├── plugin-one/
│   │   ├── manifest.mf       # JSON or YAML
│   │   ├── README.md
│   │   └── bin/
│   └── plugin-two/
│       ├── manifest.mf
│       └── README.md
└── .github/
    └── workflows/
        └── plugins-ci.yml
```

---

### Option 3: Tag-Based Release (`plugins-tag-release.yml`)

**Best for:** Repositories using semantic versioning with git tags

**Features:**
- ✅ Triggers on version tags (v1.0.0, v2.1.0, etc.)
- ✅ Automatic changelog generation
- ✅ GitHub Releases with detailed release notes
- ✅ OCI registry with version tags
- ✅ SHA256 checksums for verification

**Triggers:**
- On pushing tags matching `v*.*.*` pattern
- Manual workflow dispatch

**Usage Example:**

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# The workflow automatically:
# 1. Validates all plugins
# 2. Packages them as tar.gz
# 3. Publishes to OCI registry with version tag
# 4. Creates GitHub Release
# 5. Generates documentation
```

---

### Option 4: Scheduled Maintenance (`plugins-scheduled.yml`)

**Best for:** Keeping documentation fresh, automated health checks

**Features:**
- ✅ Weekly validation of all plugins
- ✅ Automatic issue creation on validation failures
- ✅ Documentation regeneration
- ✅ Manual trigger support

**Triggers:**
- Every Monday at 9:00 AM UTC (customizable)
- Manual workflow dispatch

**Benefits:**
- Catches outdated or broken manifests early
- Keeps documentation in sync with README changes
- No action needed unless validation fails

---

## Setup Instructions

### 1. Enable GitHub Pages

1. Go to your repository **Settings** → **Pages**
2. Under **Source**, select:
   - **Branch:** `gh-pages`
   - **Folder:** `/ (root)`
3. Click **Save**

Your documentation will be available at:
```
https://<username>.github.io/<repository-name>/
```

### 2. Configure Repository Permissions

Go to **Settings** → **Actions** → **General** → **Workflow permissions**:

Enable the following permissions:

```yaml
permissions:
  contents: write      # For creating releases and pushing to gh-pages
  packages: write      # For publishing to GitHub Container Registry
  pages: write         # For deploying GitHub Pages
  id-token: write      # For GitHub Pages authentication
  issues: write        # For creating issues (scheduled workflow)
```

Or set in your workflow file:

```yaml
permissions:
  contents: write
  packages: write
  pages: write
  id-token: write
```

### 3. Enable GitHub Container Registry (Optional)

For OCI registry publishing:

1. Go to your profile **Settings** → **Developer settings** → **Personal access tokens**
2. Token permissions are automatically granted via `GITHUB_TOKEN` in workflows
3. Make repository packages public (optional):
   - Go to package settings
   - Change visibility to **Public**

### 4. Repository Structure

Ensure your repository follows this structure:

```
your-plugin-repo/
├── plugins/                    # Required: plugin directory
│   ├── my-plugin/
│   │   ├── manifest.mf        # Required: JSON or YAML format
│   │   ├── README.md          # Recommended: plugin documentation
│   │   ├── bin/               # Optional: executables
│   │   └── lib/               # Optional: libraries
│   └── another-plugin/
│       ├── manifest.mf
│       └── README.md
├── .github/
│   └── workflows/
│       └── release.yml        # Your chosen workflow
└── README.md                  # Repository documentation
```

---

## Workflow Examples

### Example 1: Basic Validation on PR

```yaml
name: Validate on PR

on:
  pull_request:
    paths:
      - 'plugins/**'

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

### Example 2: Release with OCI Registry

```yaml
name: Release to OCI

on:
  push:
    branches: [main]

permissions:
  contents: write
  packages: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Package and publish
        uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          package-format: 'both'
          oci-registry: 'ghcr.io/${{ github.repository_owner }}'
          oci-username: ${{ github.actor }}
          oci-token: ${{ secrets.GITHUB_TOKEN }}
```

### Example 3: Documentation Only

```yaml
name: Update Documentation

on:
  push:
    branches: [main]
    paths:
      - 'plugins/**/README.md'
      - 'plugins/**/manifest.mf'

permissions:
  contents: write
  pages: write

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install pandoc
        run: sudo apt-get update && sudo apt-get install -y pandoc

      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          validate-only: 'false'
          generate-docs: 'true'
          docs-branch: 'gh-pages'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Example 4: Multi-Directory Support

```yaml
name: Multi-Directory Release

on:
  push:
    branches: [main]

jobs:
  release-stable:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins/stable'
          package-format: 'tar.gz'

  release-experimental:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins/experimental'
          package-format: 'tar.gz'
```

---

## Customization Guide

### Change Plugin Directory

Default is `plugins/`. To use a different directory:

```yaml
- uses: criteo/cola-plugin-action@v1
  with:
    plugins-directory: 'my-plugins'  # Custom directory
```

### Skip Documentation Generation

```yaml
- uses: criteo/cola-plugin-action@v1
  with:
    plugins-directory: 'plugins'
    package-format: 'tar.gz'
    generate-docs: 'false'  # Skip docs
```

### Custom OCI Registry

Use a different registry (not GitHub Container Registry):

```yaml
- uses: criteo/cola-plugin-action@v1
  with:
    plugins-directory: 'plugins'
    package-format: 'oci'
    oci-registry: 'docker.io/myusername'
    oci-username: ${{ secrets.DOCKER_USERNAME }}
    oci-token: ${{ secrets.DOCKER_TOKEN }}
```

### Custom Documentation Branch

```yaml
- uses: criteo/cola-plugin-action@v1
  with:
    plugins-directory: 'plugins'
    generate-docs: 'true'
    docs-branch: 'documentation'  # Custom branch name
```

### Add Notification on Failure

```yaml
- uses: criteo/cola-plugin-action@v1
  id: release
  continue-on-error: true
  with:
    plugins-directory: 'plugins'

- name: Notify on failure
  if: steps.release.outcome == 'failure'
  uses: actions/github-script@v7
  with:
    script: |
      await github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: '❌ Release Failed',
        body: 'Release workflow failed. Check logs.',
        labels: ['release', 'automated']
      });
```

---

## Troubleshooting

### Issue: GitHub Pages Not Publishing

**Solution:**

1. Check GitHub Pages settings are correct
2. Ensure `gh-pages` branch exists
3. Verify `pages: write` permission is set
4. Check workflow logs for push errors

### Issue: OCI Registry Authentication Failed

**Solution:**

1. Verify `packages: write` permission
2. Check token is passed correctly: `oci-token: ${{ secrets.GITHUB_TOKEN }}`
3. Ensure registry URL format: `ghcr.io/<owner>` (no `https://`)

### Issue: Validation Fails on Valid Manifests

**Solution:**

1. Check manifest format is JSON or YAML
2. Verify required fields: `pkgName`, `version`, `cmds`
3. Ensure version follows semantic versioning (1.0.0)
4. Validate JSON/YAML syntax with online validator

### Issue: Documentation Not Generated

**Solution:**

1. Install pandoc in workflow:
   ```yaml
   - run: sudo apt-get install -y pandoc
   ```
2. Check template path exists: `templates/plugin-page.html`
3. Verify `generate-docs: 'true'` is set

### Issue: Artifacts Not Uploaded

**Solution:**

1. Check build directory exists: `build/packages/`
2. Verify files were created with `ls -la build/packages/`
3. Ensure `contents: write` permission is set

---

## Advanced Examples

### Matrix Build for Multiple Platforms

```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          package-format: 'tar.gz'
```

### Conditional Release Based on Commit Message

```yaml
jobs:
  release:
    if: contains(github.event.head_commit.message, '[release]')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          plugins-directory: 'plugins'
          package-format: 'both'
```

### Parallel Jobs for Speed

```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          validate-only: 'true'

  package:
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          package-format: 'tar.gz'

  docs:
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4
      - uses: criteo/cola-plugin-action@v1
        with:
          generate-docs: 'true'
```

---

## Getting Help

- **Documentation:** [Cola Plugin Action README](../README.md)
- **Issues:** [GitHub Issues](https://github.com/criteo/cola-plugin-action/issues)
- **Examples:** See `.github/workflows/` directory for complete examples

---

**Last Updated:** 2025-01-11
**Action Version:** v1.0.0
