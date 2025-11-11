# Test Fixtures

This directory contains test fixtures for the Cola Plugin Action.

## Structure

```
tests/
├── README.md           # This file
├── valid/              # Valid plugin manifests (tests should PASS)
│   ├── valid-plugin/
│   │   ├── manifest.mf
│   │   └── README.md
│   └── yaml-plugin/
│       ├── manifest.mf
│       └── README.md
└── invalid/            # Invalid plugin manifests (tests should FAIL)
    └── invalid-plugin/
        └── manifest.mf
```

## Test Cases

### Valid Plugins (`tests/valid/`)

These plugins have **correct** manifests and should **pass validation**.

- **valid-plugin** - JSON format manifest with all required fields
- **yaml-plugin** - YAML format manifest demonstrating format support

**Expected behavior:**
- ✅ Validation should succeed
- ✅ Packaging should succeed
- ✅ Documentation generation should succeed

### Invalid Plugins (`tests/invalid/`)

These plugins have **incorrect** manifests and should **fail validation**.

- **invalid-plugin** - Has invalid version format (`not-a-valid-version` instead of semantic versioning)

**Expected behavior:**
- ❌ Validation should fail
- ❌ Packaging should not occur
- ❌ Documentation generation should not occur

## Running Tests

### Using Makefile

```bash
# Test validation with valid plugins only
make test-validate-valid

# Test validation with invalid plugins (expects failure)
make test-validate-invalid

# Test both valid and invalid validation
make test-validate

# Test packaging (uses valid plugins only)
make test-package

# Run all tests
make test-all
```

### Using GitHub Actions Workflow

The `.github/workflows/test.yml` workflow automatically tests:

1. **test-validation-valid** - Validates `tests/valid/` (should succeed)
2. **test-validation-invalid** - Validates `tests/invalid/` (should fail, verified with `continue-on-error`)
3. **test-packaging** - Packages `tests/valid/` plugins

### Direct Script Execution

```bash
# Test with valid plugins
PLUGINS_DIR=tests/valid bash scripts/validate-manifest.sh

# Test with invalid plugins (will exit 1)
PLUGINS_DIR=tests/invalid bash scripts/validate-manifest.sh
```

## Adding New Test Cases

### Adding a Valid Plugin

1. Create a new directory under `tests/valid/`:
   ```bash
   mkdir tests/valid/my-new-plugin
   ```

2. Add a valid `manifest.mf` (JSON or YAML):
   ```json
   {
     "pkgName": "my-new-plugin",
     "version": "1.0.0",
     "cmds": [
       {
         "name": "my-cmd",
         "type": "executable",
         "short": "Description",
         "executable": "{{.PackageDir}}/bin/my-cmd"
       }
     ]
   }
   ```

3. Add a `README.md` (optional but recommended)

### Adding an Invalid Plugin

1. Create a new directory under `tests/invalid/`:
   ```bash
   mkdir tests/invalid/my-invalid-plugin
   ```

2. Add an **invalid** `manifest.mf`:
   ```json
   {
     "pkgName": "my-invalid-plugin",
     "version": "v1.0.0",  // ❌ Wrong - has 'v' prefix
     "cmds": []             // ❌ Wrong - empty commands
   }
   ```

3. Document what's invalid in a comment or README

## Test Coverage

The test suite covers:

- ✅ Valid JSON manifests
- ✅ Valid YAML manifests
- ✅ Invalid version formats
- ✅ Missing commands
- ✅ Package creation
- ✅ Package verification
- ✅ Documentation generation

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/test.yml`) runs on:
- Every pull request
- Every push to `main`

It uses `continue-on-error: true` for the invalid plugin test and verifies that the validation correctly failed.

## Troubleshooting

### Test fails with "Invalid plugins should have failed!"

This means validation passed when it should have failed. Check that:
- The manifest in `tests/invalid/` is actually invalid
- The validation script is correctly detecting the error

### Test fails with "No tar.gz packages found"

This means packaging didn't create any files. Check that:
- The `tests/valid/` directory contains valid plugins
- The manifests are correctly formatted
- The `build/packages/` directory exists

### Documentation generation fails

Check that:
- `README.md` files exist in plugin directories
- Manifests have valid metadata fields
- Template file exists at `templates/plugin-page.html`
