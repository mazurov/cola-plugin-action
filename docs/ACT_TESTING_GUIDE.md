# Testing GitHub Actions with act

This guide explains how to test the Cola Plugin Action workflows locally using [act](https://github.com/nektos/act).

## What is act?

act allows you to run your GitHub Actions locally using Docker. This speeds up development by eliminating the need to push code to GitHub to test workflows.

## Installation

### macOS
```bash
brew install act
```

### Linux
```bash
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
```

### Windows
```bash
choco install act-cli
```

### From source
```bash
go install github.com/nektos/act@latest
```

## Quick Start

### 1. Verify Docker is running

```bash
docker ps
```

### 2. List available workflows

```bash
act -l
```

Expected output:
```
Stage  Job ID            Job name          Workflow name  Workflow file  Events
0      test-validation   Test Validation   Test Action    test.yml       push,pull_request
0      test-packaging    Test Packaging    Test Action    test.yml       push,pull_request
```

### 3. Run workflows

```bash
# Run all jobs
act

# Run with push event
act push

# Run with pull_request event
act pull_request

# Run specific job
act -j test-validation
act -j test-packaging
```

## Common Commands

### Dry Run
See what would be executed without actually running:
```bash
act -n
act --dry-run
```

### Verbose Output
Get detailed logging:
```bash
act -v
act --verbose
```

### Specific Workflow
Target a specific workflow file:
```bash
act -W .github/workflows/test.yml
```

### List All Actions
```bash
act -l --verbose
```

## Configuration

### Using .actrc

The project includes a `.actrc` file with recommended settings:

```
-P ubuntu-latest=catthehacker/ubuntu:act-latest
--bind
-v
--detect-event
```

This configures act to:
- Use compatible Docker images
- Bind mount directories for better performance
- Enable verbose output
- Auto-detect git events

### Custom Configuration

Create your own `.actrc.local` (git-ignored):

```bash
# Custom settings
-P ubuntu-latest=my-custom-image
--secret-file .secrets
```

## Docker Images

### Default Images
act uses nektos Docker images by default, which may not include all tools.

### Recommended Images
For better compatibility, use catthehacker images:

```bash
act -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

Available sizes:
- `act-latest` - ~1 GB (recommended)
- `full-latest` - ~17 GB (includes everything)

### Custom Image
If you need specific tools:

```dockerfile
FROM catthehacker/ubuntu:act-latest
RUN apt-get update && apt-get install -y pandoc jq
```

```bash
docker build -t cola-plugin-test .
act -P ubuntu-latest=cola-plugin-test
```

## Environment Variables

### Pass Variables
```bash
act --env PLUGINS_DIR=tests/fixtures
act --env OUTPUT_DIR=test-releases
```

### Use .env File
```bash
echo "PLUGINS_DIR=tests/fixtures" > .env
act --env-file .env
```

## Secrets

### One-time Secret
```bash
act --secret GITHUB_TOKEN=ghp_xxx
```

### Secret File
Create `.secrets` file:
```
GITHUB_TOKEN=ghp_xxx
OCI_TOKEN=xxx
```

Run with secrets:
```bash
act --secret-file .secrets
```

**⚠️ Never commit `.secrets` to git!**

## Troubleshooting

### Docker Not Found
```
Error: Cannot connect to the Docker daemon
```

**Solution**: Start Docker Desktop or Docker daemon

### Permission Denied
```
Error: Got permission denied while trying to connect to Docker
```

**Solution**: Add user to docker group or use sudo
```bash
sudo usermod -aG docker $USER
# Logout and login again
```

### Image Pull Failed
```
Error: failed to pull image
```

**Solution**: Check internet connection or use local image
```bash
docker pull catthehacker/ubuntu:act-latest
```

### Action Not Found
```
Error: unable to get git repo
```

**Solution**: Use relative path for local action
```yaml
uses: ./  # Instead of uses: criteo/cola-plugin-action@v1
```

### Slow Performance
**Solution**:
1. Use `--bind` flag
2. Use smaller Docker images
3. Increase Docker resources (CPU/Memory)

## Testing Our Workflows

### Test Validation Job
```bash
# Quick test
act -j test-validation

# With verbose output
act -j test-validation -v

# Dry run to see steps
act -j test-validation -n
```

### Test Packaging Job
```bash
# Run packaging
act -j test-packaging

# Check created artifacts
ls -lh test-releases/
```

### Test Complete Workflow
```bash
# Run all jobs in sequence
act push

# Check results
cat /tmp/test_output.txt
```

## CI/CD Integration

### Pre-commit Hook
Add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
echo "Testing workflows with act..."
act -j test-validation -q
if [ $? -ne 0 ]; then
    echo "Workflow validation failed!"
    exit 1
fi
```

### Make Target
Already included in Makefile:

```makefile
test-act:
	act -j test-validation
	act -j test-packaging
```

## Limitations

### What Works
✅ Most standard GitHub Actions
✅ Composite actions
✅ Docker actions
✅ Environment variables
✅ Secrets
✅ Matrix builds
✅ Conditional steps

### What Doesn't Work
❌ GitHub-specific contexts (full support)
❌ OIDC tokens
❌ Self-hosted runners
❌ GitHub App authentication
❌ Some marketplace actions

### Workarounds
- Use `if: ${{ !env.ACT }}` to skip steps in act
- Mock GitHub contexts with env vars
- Use local alternatives for unavailable actions

## Best Practices

1. **Use .actrc** for consistent settings
2. **Test locally** before pushing
3. **Use appropriate images** (not too large)
4. **Clean up** Docker images periodically
5. **Document** custom configurations

## Resources

- [act Documentation](https://github.com/nektos/act)
- [Docker Hub - catthehacker](https://hub.docker.com/u/catthehacker)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Quick Reference

| Command | Description |
|---------|-------------|
| `act -l` | List all jobs |
| `act` | Run default event (push) |
| `act push` | Run push event |
| `act -j JOB_NAME` | Run specific job |
| `act -n` | Dry run |
| `act -v` | Verbose output |
| `act --list` | List workflows |
| `act -W FILE` | Use specific workflow |

---

**Last Updated**: 2025-11-11
**Version**: 1.0.0
