# Workflow Examples for Plugin Repositories

This directory contains **ready-to-use GitHub workflow examples** for plugin repositories that want to use the Cola Plugin Action.

⚠️ **Important:** These workflows are NOT for this repository. They are templates for OTHER repositories that contain Command Launcher plugins.

## 📁 Directory Structure

```
examples/
├── README.md                    # This file
├── WORKFLOW_EXAMPLES.md         # Comprehensive documentation
└── workflows/
    ├── plugins-simple.yml       # Simple workflow (recommended for most)
    ├── plugins-ci.yml           # Full CI/CD pipeline
    ├── plugins-tag-release.yml  # Tag-based releases
    └── plugins-scheduled.yml    # Scheduled maintenance
```

## 🚀 Quick Start

### For Plugin Repository Owners

If you have a repository with Command Launcher plugins and want to set up automated releases:

1. **Choose a workflow** that fits your needs (see comparison below)
2. **Copy it to your plugin repository:**
   ```bash
   cp examples/workflows/plugins-simple.yml YOUR_PLUGIN_REPO/.github/workflows/release.yml
   ```
3. **Configure GitHub Pages** in your repository settings
4. **Push to trigger** the workflow

## 📋 Workflow Comparison

| Workflow | Best For | Complexity | Features |
|----------|----------|------------|----------|
| **plugins-simple.yml** | Getting started | ⭐ Easy | Validation, ZIP packages, docs |
| **plugins-ci.yml** | Production use | ⭐⭐⭐ Advanced | Full CI/CD, ZIP+OCI, PR previews |
| **plugins-tag-release.yml** | Version tags | ⭐⭐ Medium | Semver releases, ZIP+OCI, changelogs |
| **plugins-scheduled.yml** | Maintenance | ⭐ Easy | Weekly checks, auto-docs |

## 📖 Detailed Documentation

See [WORKFLOW_EXAMPLES.md](./WORKFLOW_EXAMPLES.md) for:
- Complete setup instructions
- Detailed feature descriptions
- Customization examples
- Troubleshooting guide
- Advanced usage patterns

## 💡 Example Plugin Repository

Your plugin repository should look like this:

```
your-plugin-repo/
├── plugins/                    # Plugins directory
│   ├── my-plugin/
│   │   ├── manifest.mf        # Required: JSON or YAML
│   │   ├── README.md          # Recommended
│   │   └── bin/
│   └── another-plugin/
│       ├── manifest.mf
│       └── README.md
├── .github/
│   └── workflows/
│       └── release.yml        # Copy from examples/workflows/
└── README.md
```

## 🔗 Links

- **Action Repository:** [criteo/cola-plugin-action](https://github.com/criteo/cola-plugin-action)
- **Action Documentation:** [README.md](../README.md)
- **Command Launcher:** [criteo.github.io/command-launcher](https://criteo.github.io/command-launcher/)

## ❓ Need Help?

- Read [WORKFLOW_EXAMPLES.md](./WORKFLOW_EXAMPLES.md) for detailed documentation
- Check the [main README](../README.md) for action usage
- Open an [issue](https://github.com/criteo/cola-plugin-action/issues) if you need support

---

**Note:** These are templates for plugin repositories, not for this action repository itself.
