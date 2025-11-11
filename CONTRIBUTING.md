# Contributing to Cola Plugin Action

Thank you for your interest in contributing to Cola Plugin Action! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y jq git pandoc bc
```

**macOS:**
```bash
brew install jq git pandoc bc
```

### Clone and Setup

```bash
git clone https://github.com/criteo/cola-plugin-action.git
cd cola-plugin-action
```

## Testing Locally

### Quick Validation Test

```bash
make test-validate
```

### Full Test Suite

```bash
make test-all
```

### Manual Testing

```bash
# Set environment variables
export PLUGINS_DIR="tests/fixtures"
export GITHUB_OUTPUT="/tmp/test_output.txt"
export OUTPUT_DIR="test-releases"

# Test validation
bash scripts/validate-manifest.sh

# Test packaging
bash scripts/package-plugin.sh

# Verify package
bash scripts/verify-package.sh test-releases/*.tar.gz
```

### Clean Up

```bash
make clean
```

## Making Changes

### Branch Naming

- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`

### Commit Messages

Follow conventional commit format:

- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `test: add tests`
- `refactor: code refactoring`
- `chore: maintenance tasks`

### Code Style

**Bash Scripts:**
- Use `set -euo pipefail` at the top
- Add color codes for output (GREEN, RED, YELLOW)
- Include descriptive comments
- Use meaningful variable names
- Quote all variables: `"$VARIABLE"`

**YAML Files:**
- 2-space indentation
- Quote string values when needed
- Add descriptions for all inputs/outputs

## Adding New Features

### Adding New Validation Rules

1. Update `scripts/validate-manifest.sh`
2. Add test fixture in `tests/fixtures/`
3. Update CLAUDE.md with new rule documentation
4. Test with `make test-validate`

### Adding New Package Formats

1. Update `scripts/package-plugin.sh`
2. Update `scripts/verify-package.sh`
3. Add tests and fixtures
4. Update README.md and CLAUDE.md

### Modifying Documentation Generation

1. Update `scripts/generate-docs.sh`
2. Update `templates/plugin-page.html`
3. Test with real plugin examples
4. Update documentation

## Pull Request Process

1. **Create a Branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make Changes**
   - Write your code
   - Add tests if applicable
   - Update documentation

3. **Test Locally**
   ```bash
   make test-all
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add my new feature"
   ```

5. **Push to Fork**
   ```bash
   git push origin feature/my-new-feature
   ```

6. **Create Pull Request**
   - Go to GitHub
   - Create pull request from your fork
   - Fill in the PR template
   - Link any related issues

## Pull Request Checklist

- [ ] Tests pass locally (`make test-all`)
- [ ] Code follows project style guidelines
- [ ] Documentation updated (README.md, CLAUDE.md)
- [ ] Commit messages follow conventional format
- [ ] No hardcoded secrets or credentials
- [ ] Scripts are executable (`chmod +x`)
- [ ] Test fixtures included for new features

## Testing with act

You can test GitHub Actions locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl -L https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow
act -W .github/workflows/test.yml

# Run with verbose output
act -v -W .github/workflows/test.yml
```

## Reporting Issues

### Bug Reports

Include:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, shell version)
- Relevant logs/output

### Feature Requests

Include:
- Description of the feature
- Use case and motivation
- Proposed implementation (optional)
- Examples of usage

## Code Review Process

1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, maintainers will merge

## Release Process

Maintainers handle releases:

1. Update version in README.md and CLAUDE.md
2. Create git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
3. Push tags: `git push origin v1.0.0`
4. Update major version tag: `git tag -fa v1 -m "Update v1"`
5. Force push major tag: `git push origin v1 --force`
6. Create GitHub Release with changelog

## Questions?

- Open a [Discussion](https://github.com/criteo/cola-plugin-action/discussions)
- File an [Issue](https://github.com/criteo/cola-plugin-action/issues)
- Check existing documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Cola Plugin Action!
