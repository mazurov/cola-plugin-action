# Example Workflow

This directory contains a complete CI/CD workflow example for plugin repositories using Cola Plugin Action.

> **⚠️ Testing Notice:** This example currently uses `mazurov/cola-plugin-action@master` for testing purposes.
> When using in production, update to `criteo/cola-plugin-action@v1` (or latest version).

## 📁 Available Workflow

- **[plugins-ci.yml](workflows/plugins-ci.yml)** - Full CI/CD pipeline with validation, testing, and releases

## 🚀 Quick Setup

1. **Copy the workflow to your plugin repository:**

   ```bash
   mkdir -p .github/workflows
   cp examples/workflows/plugins-ci.yml .github/workflows/plugins-ci.yml
   ```

2. **Update the action reference for production use:**

   Replace all instances of:
   ```yaml
   uses: mazurov/cola-plugin-action@master
   ```

   With:
   ```yaml
   uses: criteo/cola-plugin-action@v1  # or latest stable version
   ```

3. **Customize the workflow for your needs:**
   - Change `packages-directory` if your plugins are not in `packages/`
   - Modify `package-format` based on your distribution strategy:
     - `'zip'` - GitHub Releases only
     - `'oci'` - OCI registry only
     - `'both'` - Both GitHub Releases and OCI registry

4. **Ensure your repository has the required structure:**

   ```
   your-plugin-repo/
   ├── packages/
   │   ├── plugin-one/
   │   │   ├── manifest.mf
   │   │   └── README.md
   │   └── plugin-two/
   │       ├── manifest.mf
   │       └── README.md
   └── .github/
       └── workflows/
           └── plugins-ci.yml
   ```

5. **Configure GitHub repository settings:**
   - Go to Settings → Actions → General
   - Under "Workflow permissions", ensure:
     - ✅ Read and write permissions
     - ✅ Allow GitHub Actions to create and approve pull requests (if using)

## 📦 What the Workflow Does

### On Pull Requests:
- ✅ Validates all plugin manifests
- 📦 Tests package generation (creates ZIP files)
- 📤 Uploads test packages as artifacts

### On Push to Main/Develop:
- ✅ Validates all plugin manifests
- 📦 Creates ZIP packages
- 🚀 Pushes to GitHub Container Registry (OCI)
- 📝 Creates GitHub Release with packages
- 🧹 Cleans up old workflow artifacts

## 🔧 Customization

### Change Target Branches

```yaml
if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop')
```

Change `main` and `develop` to your branch names.

### Package Format Options

```yaml
# ZIP only (GitHub Releases)
package-format: 'zip'

# OCI registry only
package-format: 'oci'

# Both ZIP and OCI
package-format: 'both'
```

### OCI Registry Configuration

By default, uses GitHub Container Registry:

```yaml
oci-registry: 'ghcr.io/${{ github.repository_owner }}'
oci-username: ${{ github.actor }}
oci-token: ${{ secrets.GITHUB_TOKEN }}
```

For other registries (Docker Hub, AWS ECR, etc.):

```yaml
oci-registry: 'docker.io/yourusername'
oci-username: ${{ secrets.DOCKER_USERNAME }}
oci-token: ${{ secrets.DOCKER_TOKEN }}
```

## 📚 Documentation

For more details, see the main [README.md](../README.md).
