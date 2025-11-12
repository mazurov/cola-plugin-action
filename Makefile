.PHONY: help install build test test-validate test-package test-docs serve-docs test-docs-github lint format clean dev all

# Default target
help:
	@echo "Cola Plugin Action - Development Makefile (Node.js/TypeScript)"
	@echo ""
	@echo "Available targets:"
	@echo "  make install          - Install NPM dependencies"
	@echo "  make build            - Build TypeScript to JavaScript"
	@echo "  make test             - Run Jest test suite"
	@echo "  make test-validate    - Test validation with fixtures"
	@echo "  make test-package     - Test packaging with fixtures"
	@echo "  make test-docs        - Generate & serve docs locally (auto-opens browser)"
	@echo "  make serve-docs       - Serve existing docs (PORT=3000)"
	@echo "  make test-docs-github - Test docs with real GitHub releases"
	@echo "  make lint             - Run ESLint"
	@echo "  make format           - Format code with Prettier"
	@echo "  make package          - Package for distribution (dist/)"
	@echo "  make all              - Build, lint, format, test, and package"
	@echo "  make clean            - Clean up build artifacts"
	@echo "  make dev              - Quick development cycle"

# Install NPM dependencies
install:
	@echo "Installing NPM dependencies..."
	@npm install
	@echo "✓ Dependencies installed"

# Build TypeScript to JavaScript
build:
	@echo "Building TypeScript..."
	@npm run build
	@echo "✓ Build complete"

# Run Jest test suite
test:
	@echo "Running tests..."
	@npm test
	@echo "✓ Tests complete"

# Test validation with valid/invalid fixtures
test-validate:
	@echo "================================"
	@echo "Testing Validation (Node.js)"
	@echo "================================"
	@mkdir -p build
	@touch build/test_output_valid.txt build/test_output_invalid.txt
	@echo "Testing valid plugins..."
	@env "INPUT_PLUGINS-DIRECTORY=tests/valid" "INPUT_VALIDATE-ONLY=true" "GITHUB_OUTPUT=build/test_output_valid.txt" node lib/main.js
	@echo ""
	@echo "✅ Valid plugins passed validation"
	@echo ""
	@echo "Testing invalid plugins (should fail)..."
	@if env "INPUT_PLUGINS-DIRECTORY=tests/invalid" "INPUT_VALIDATE-ONLY=true" "GITHUB_OUTPUT=build/test_output_invalid.txt" node lib/main.js 2>&1; then \
		echo "❌ ERROR: Invalid plugins should have failed validation!"; \
		exit 1; \
	else \
		echo "✅ Invalid plugins correctly failed validation"; \
	fi

# Test plugin packaging
test-package:
	@echo "================================"
	@echo "Testing Plugin Packaging (Node.js)"
	@echo "================================"
	@mkdir -p build/packages
	@touch build/test_output.txt
	@env "INPUT_PLUGINS-DIRECTORY=tests/valid" "INPUT_PACKAGE-FORMAT=tar.gz" "INPUT_VALIDATE-ONLY=false" "GITHUB_OUTPUT=build/test_output.txt" node lib/main.js
	@echo ""
	@echo "Created archives:"
	@ls -lh build/packages/*.tar.gz 2>/dev/null || echo "No archives created"
	@echo ""
	@echo "Archive contents:"
	@for archive in build/packages/*.tar.gz; do \
		if [ -f "$$archive" ]; then \
			echo ""; \
			echo "Contents of $$archive:"; \
			tar -tzf "$$archive" | head -10; \
		fi \
	done

# Test documentation generation locally (no GitHub required)
test-docs:
	@echo "================================"
	@echo "Local Documentation Testing"
	@echo "================================"
	@npm run test:docs

# Serve documentation with custom port
# Usage: make serve-docs PORT=8080
serve-docs:
	@if [ -d "build/docs-local-test/docs" ]; then \
		node scripts/serve-docs.js build/docs-local-test/docs $(or $(PORT),3000); \
	else \
		echo "Error: Documentation not found. Run 'make test-docs' first."; \
		exit 1; \
	fi

# Test documentation generation with real GitHub releases
# Requires: GITHUB_TOKEN and GITHUB_REPOSITORY environment variables
# Example: GITHUB_TOKEN=ghp_xxx GITHUB_REPOSITORY=owner/repo make test-docs-github
test-docs-github:
	@echo "================================"
	@echo "Testing Documentation with GitHub"
	@echo "================================"
	@if [ -z "$$GITHUB_TOKEN" ]; then \
		echo "❌ ERROR: GITHUB_TOKEN environment variable is required"; \
		echo "   Export your GitHub token: export GITHUB_TOKEN=ghp_xxxxx"; \
		exit 1; \
	fi
	@if [ -z "$$GITHUB_REPOSITORY" ]; then \
		echo "❌ ERROR: GITHUB_REPOSITORY environment variable is required"; \
		echo "   Format: owner/repo (e.g., criteo/cola-plugins)"; \
		exit 1; \
	fi
	@mkdir -p build/docs-test
	@touch build/test_docs_output.txt
	@echo "Testing documentation generation for: $$GITHUB_REPOSITORY"
	@env \
		"INPUT_PLUGINS-DIRECTORY=tests/valid" \
		"INPUT_GENERATE-DOCS=true" \
		"INPUT_DOCS-BRANCH=gh-pages-test" \
		"INPUT_KEEP-VERSIONS=5" \
		"INPUT_GITHUB-TOKEN=$$GITHUB_TOKEN" \
		"GITHUB_REPOSITORY=$$GITHUB_REPOSITORY" \
		"GITHUB_OUTPUT=build/test_docs_output.txt" \
		node lib/main.js
	@echo ""
	@echo "✅ Documentation generation test complete"
	@echo "Check build/docs-test/ for generated files"

# Run ESLint
lint:
	@echo "Running ESLint..."
	@npm run lint
	@echo "✓ Linting complete"

# Format code with Prettier
format:
	@echo "Formatting code..."
	@npm run format
	@echo "✓ Formatting complete"

# Package for distribution
package: build
	@echo "Packaging for distribution..."
	@npm run package
	@echo "✓ Package created at dist/index.js"

# Run all checks
all: install build lint format test package
	@echo ""
	@echo "================================"
	@echo "✓ All checks passed"
	@echo "================================"

# Quick development cycle
dev: clean build test-validate
	@echo ""
	@echo "✓ Quick development check complete"

# Clean up build artifacts
clean:
	@echo "Cleaning up build artifacts..."
	@rm -rf build/ lib/ dist/ coverage/ node_modules/.cache
	@echo "✓ Cleanup complete"
