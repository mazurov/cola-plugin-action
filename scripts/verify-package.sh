#!/usr/bin/env bash

set -euo pipefail

# verify-package.sh
# Verifies the integrity and contents of a plugin package

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

# Check if package file is provided
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <package-file.tar.gz>"
    exit 1
fi

PACKAGE_FILE="$1"

log_info "Verifying package: $PACKAGE_FILE"
echo ""

# Check if file exists
if [[ ! -f "$PACKAGE_FILE" ]]; then
    die "File not found: $PACKAGE_FILE"
fi

# Check file extension
if [[ ! "$PACKAGE_FILE" =~ \.tar\.gz$ ]]; then
    log_warning "File does not have .tar.gz extension"
fi

# Display file information
log_section "File Information"

# File size
file_size_bytes=$(get_file_size "$PACKAGE_FILE")
file_size_human=$(get_file_size_human "$PACKAGE_FILE")
echo "Size: $file_size_bytes bytes ($file_size_human)"

# Checksum if available
checksum_file="${PACKAGE_FILE}.sha256"
if [[ -f "$checksum_file" ]]; then
    echo "Checksum file: Found"

    expected_checksum=$(cat "$checksum_file")
    calculated_checksum=$(generate_checksum "$PACKAGE_FILE")

    echo "Expected checksum:   $expected_checksum"
    if [[ -n "$calculated_checksum" ]]; then
        echo "Calculated checksum: $calculated_checksum"

        if verify_checksum "$PACKAGE_FILE" "$expected_checksum"; then
            log_success "Checksum verification passed"
        else
            log_error "Checksum verification failed"
            exit 1
        fi
    fi
else
    echo "Checksum file: Not found"
fi

# Archive integrity
log_section "Archive Integrity"

if tar -tzf "$PACKAGE_FILE" > /dev/null 2>&1; then
    log_success "Archive integrity test passed"
else
    log_error "Archive integrity test failed"
    exit 1
fi

# Archive contents
log_section "Archive Contents"

tar -tzf "$PACKAGE_FILE" | head -20

# Count files
file_count=$(tar -tzf "$PACKAGE_FILE" | wc -l | xargs)
echo ""
echo "Total files: $file_count"

# Check for manifest.mf
log_section "Manifest Check"

if tar -tzf "$PACKAGE_FILE" | grep -q "manifest.mf$"; then
    log_success "manifest.mf found"

    # Extract and display manifest
    echo ""
    echo "Manifest Contents:"
    echo "=================="
    tar -xzOf "$PACKAGE_FILE" --wildcards "*/manifest.mf" 2>/dev/null || \
        tar -xzOf "$PACKAGE_FILE" "*/manifest.mf" 2>/dev/null || \
        echo "Could not extract manifest"
else
    log_error "manifest.mf not found"
    exit 1
fi

# Check for README.md
log_section "Documentation"

if tar -tzf "$PACKAGE_FILE" | grep -q "README.md$"; then
    log_success "README.md found"
else
    log_warning "README.md not found (recommended)"
fi

# Metadata JSON if available
metadata_file="${PACKAGE_FILE%.tar.gz}.json"
if [[ -f "$metadata_file" ]]; then
    echo ""
    log_section "Metadata JSON"
    if command -v jq &> /dev/null; then
        cat "$metadata_file" | jq .
    else
        cat "$metadata_file"
    fi
fi

echo ""
log_success "Package verification completed successfully"
exit 0
