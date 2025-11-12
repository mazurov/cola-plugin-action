# Testing Scripts

This directory contains testing utilities for local development.

## Documentation Testing (TypeScript)

Test the documentation generation feature locally without requiring GitHub access.

All documentation test scripts are now written in **TypeScript** and located in `src/tests/`:
- `src/tests/docs-local.ts` - Creates mock plugin releases
- `src/tests/docs-generate.ts` - Generates documentation from releases
- Uses shared utilities from `src/utils/docs-generator.ts` - **zero code duplication**

### Quick Start

```bash
# All-in-one: setup + generate + serve
npm run test:docs
# or
make test-docs

# Individual steps (if needed)
npm run test:docs-setup      # Create mock releases
npm run test:docs-generate   # Generate HTML documentation
npm run test:docs-serve      # Start HTTP server
```

### Why TypeScript?

**Benefits of the TypeScript approach:**
- ✅ **Type safety** - Catch errors at compile time
- ✅ **Code sharing** - Direct imports from `src/utils/` without duplication
- ✅ **Better IDE support** - Autocomplete, refactoring, jump-to-definition
- ✅ **Integration** - Uses same build system as main codebase
- ✅ **Maintainability** - Single source of truth for documentation generation

**Before (Bash/JavaScript):**
- `scripts/test-docs-local.sh` - Bash script with limited type checking
- `scripts/test-docs-standalone.js` - JavaScript with ~150 lines of duplicated code
- Difficult to refactor when production code changes

**After (TypeScript):**
- `src/tests/docs-local.ts` - Fully typed TypeScript
- `src/tests/docs-generate.ts` - Uses shared utilities from `src/utils/docs-generator.ts`
- Changes to production code automatically reflected in tests

### npm Scripts

**Added to package.json:**
```json
{
  "scripts": {
    "test:docs-setup": "tsx src/tests/docs-local.ts",
    "test:docs-generate": "tsx src/tests/docs-generate.ts",
    "test:docs-serve": "node scripts/serve-docs.js build/docs-local-test/docs 3000",
    "test:docs": "npm run test:docs-setup && npm run test:docs-generate && npm run test:docs-serve"
  }
}
```

### What Each Script Does

#### `npm run test:docs-setup`

Runs: `tsx src/tests/docs-local.ts`

**What it does:**
- Creates temporary plugin archives in `build/docs-local-test/releases/`
- Generates 3 versions of `valid-plugin` (1.0.0, 1.1.0, 1.2.0)
- Generates 2 versions of `yaml-plugin` (1.0.0, 2.0.0)
- Supports both JSON and YAML manifest formats
- Uses test fixtures from `tests/valid/`

#### `npm run test:docs-generate`

Runs: `tsx src/tests/docs-generate.ts`

**What it does:**
- Processes plugin archives from local filesystem (not GitHub API)
- Uses **shared utilities** from `src/utils/docs-generator.ts`:
  - `generateVersionSelector()` - Version dropdown HTML
  - `generateTemplateVariables()` - Template variable substitution
  - `generateRedirectPage()` - Plugin index redirects
- Extracts manifests and READMEs from archives
- Renders Markdown to HTML using `marked`
- Generates versioned documentation pages
- Creates browsable site with version selectors
- **Zero code duplication** with production code

**Output:**
- Main index: `build/docs-local-test/docs/index.html`
- Plugin pages: `build/docs-local-test/docs/{plugin-name}/index.html`
- Version pages: `build/docs-local-test/docs/{plugin-name}/v{version}/index.html`

#### `npm run test:docs-serve`

Runs: `node scripts/serve-docs.js`

#### `serve-docs.js`

Simple HTTP server for viewing the generated documentation properly.

**Why you need this:**
- Opening HTML files directly (`file://`) can cause issues with:
  - Relative links not working correctly
  - CSS/JS not loading properly
  - CORS restrictions
- A proper HTTP server (`http://localhost:3000`) ensures everything works as expected

**Usage:**
```bash
# Start server on default port (3000)
node scripts/serve-docs.js

# Custom directory and port
node scripts/serve-docs.js build/docs-local-test/docs 8080

# Disable auto-opening browser
OPEN_BROWSER=false node scripts/serve-docs.js
```

**Features:**
- Auto-opens browser when started
- Serves static files with correct MIME types
- Directory traversal protection
- Shows local and network URLs
- Handles index.html automatically
- Hot reload friendly (no caching)

### Complete Test Workflow

**Recommended (all-in-one):**
```bash
make test-docs
# Generates docs AND starts HTTP server at http://localhost:3000
# Browser opens automatically
```

**Manual steps:**
```bash
# 1. Generate mock releases
bash scripts/test-docs-local.sh

# 2. Generate documentation
node scripts/test-docs-standalone.js

# 3. Serve with HTTP server
node scripts/serve-docs.js
```

**Just serve existing docs:**
```bash
make serve-docs        # Port 3000
make serve-docs PORT=8080  # Custom port
```

## Features Demonstrated

The generated documentation shows:

- **Multi-plugin support**: Multiple plugins in one documentation site
- **Version selectors**: Dropdown to switch between plugin versions
- **Metadata display**: Author, license, repository, commands count
- **Markdown rendering**: README files converted to HTML
- **Responsive design**: Clean, GitHub-style UI
- **Auto-redirect**: Plugin index redirects to latest version

## Directory Structure

After running the test:

```
build/docs-local-test/
├── releases/              # Mock plugin archives
│   ├── valid-plugin-1.0.0.tar.gz
│   ├── valid-plugin-1.1.0.tar.gz
│   ├── valid-plugin-1.2.0.tar.gz
│   ├── yaml-plugin-1.0.0.tar.gz
│   └── yaml-plugin-2.0.0.tar.gz
├── work/                  # Temporary extraction directory
└── docs/                  # Generated documentation site
    ├── index.html         # Main landing page
    ├── valid-plugin/
    │   ├── index.html     # Redirects to latest version
    │   ├── v1.0.0/
    │   │   └── index.html
    │   ├── v1.1.0/
    │   │   └── index.html
    │   └── v1.2.0/
    │       └── index.html
    └── yaml-plugin/
        ├── index.html
        ├── v1.0.0/
        │   └── index.html
        └── v2.0.0/
            └── index.html
```

## Testing with Real GitHub Releases

To test with actual GitHub releases, use:

```bash
export GITHUB_TOKEN=ghp_your_token_here
export GITHUB_REPOSITORY=owner/repo
make test-docs-github
```

This requires:
- A valid GitHub token with repo access
- A repository with releases containing `.tar.gz` plugin archives
- The action will fetch releases via GitHub API

## Alternative HTTP Servers

If you prefer using existing tools instead of our custom server:

### Option 1: Python (Built-in)

```bash
# Python 3
cd build/docs-local-test/docs
python3 -m http.server 3000

# Python 2
python -m SimpleHTTPServer 3000
```

**Pros:** No installation needed (Python is usually pre-installed)  
**Cons:** No auto-open browser, basic features only

### Option 2: npx serve (npm package)

```bash
npx serve build/docs-local-test/docs -p 3000
```

**Pros:** Feature-rich, professional server  
**Cons:** Requires npm/npx, downloads package on first use

### Option 3: PHP (Built-in)

```bash
cd build/docs-local-test/docs
php -S localhost:3000
```

**Pros:** Simple, often pre-installed  
**Cons:** Overkill for static files

### Our Custom Server (`serve-docs.js`)

**Why we included it:**
- ✅ Zero dependencies (pure Node.js)
- ✅ Auto-opens browser
- ✅ Shows local + network URLs
- ✅ Security built-in (path traversal protection)
- ✅ Optimized for our documentation structure
- ✅ Part of the repository (no external tools)

**Best for:** Project contributors and local testing

