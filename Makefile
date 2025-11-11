.PHONY: help test-validate test-validate-valid test-validate-invalid test-package test-verify test-docs test-all clean install-deps dev

# Default target
help:
	@echo "Cola Plugin Action - Development Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  make install-deps          - Install required dependencies"
	@echo "  make test-validate         - Test validation (both valid & invalid)"
	@echo "  make test-validate-valid   - Test validation with valid plugins"
	@echo "  make test-validate-invalid - Test validation with invalid plugins"
	@echo "  make test-package          - Test plugin packaging"
	@echo "  make test-verify           - Test package verification"
	@echo "  make test-docs             - Test documentation generation"
	@echo "  make test-all              - Run all tests"
	@echo "  make clean                 - Clean up test artifacts"
	@echo "  make dev                   - Quick validation for development"

# Install dependencies (Ubuntu/Debian)
install-deps:
	@echo "Installing dependencies..."
	@if command -v apt-get &> /dev/null; then \
		sudo apt-get update -qq; \
		sudo apt-get install -y yq git pandoc bc; \
	elif command -v brew &> /dev/null; then \
		brew install yq git pandoc bc; \
	else \
		echo "Neither apt-get nor brew found. Please install yq, git, pandoc, and bc manually."; \
		exit 1; \
	fi
	@echo "✓ Dependencies installed"

# Test manifest validation with valid plugins (should succeed)
test-validate-valid:
	@echo "================================"
	@echo "Testing Validation (Valid Plugins)"
	@echo "================================"
	@mkdir -p build
	@PLUGINS_DIR=tests/valid \
	 GITHUB_OUTPUT=build/test_output_valid.txt \
	 bash scripts/validate-manifest.sh
	@echo ""
	@echo "✅ Valid plugins passed validation"

# Test manifest validation with invalid plugins (should fail)
test-validate-invalid:
	@echo "================================"
	@echo "Testing Validation (Invalid Plugins - Expected Failure)"
	@echo "================================"
	@mkdir -p build
	@if PLUGINS_DIR=tests/invalid \
	    GITHUB_OUTPUT=build/test_output_invalid.txt \
	    bash scripts/validate-manifest.sh 2>&1; then \
		echo "❌ ERROR: Invalid plugins should have failed validation!"; \
		exit 1; \
	else \
		echo "✅ Invalid plugins correctly failed validation"; \
	fi

# Test both valid and invalid validation
test-validate: test-validate-valid test-validate-invalid
	@echo ""
	@echo "✅ All validation tests passed"

# Test plugin packaging (only with valid plugins)
test-package:
	@echo "================================"
	@echo "Testing Plugin Packaging"
	@echo "================================"
	@mkdir -p build/packages
	@PLUGINS_DIR=tests/valid \
	 OUTPUT_DIR=build/packages \
	 GITHUB_OUTPUT=build/test_output.txt \
	 bash scripts/package-plugin.sh
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

# Test package verification
test-verify:
	@echo "================================"
	@echo "Testing Package Verification"
	@echo "================================"
	@for archive in build/packages/*.tar.gz; do \
		if [ -f "$$archive" ]; then \
			echo ""; \
			echo "Verifying $$archive:"; \
			bash scripts/verify-package.sh "$$archive"; \
		fi \
	done

# Test documentation generation
test-docs:
	@echo "================================"
	@echo "Testing Documentation Generation"
	@echo "================================"
	@bash scripts/test-docs-locally.sh
	@echo ""
	@echo "✓ Documentation test complete"
	@echo "  Open: file://$(PWD)/build/docs/index.html"

# Run all tests
test-all: test-validate test-package test-verify test-docs
	@echo ""
	@echo "================================"
	@echo "✓ All tests completed"
	@echo "================================"

# Quick development validation
dev: clean test-validate
	@echo ""
	@echo "✓ Quick validation complete"

# Clean up test artifacts
clean:
	@echo "Cleaning up build artifacts..."
	@rm -rf build/
	@echo "✓ Cleanup complete"
