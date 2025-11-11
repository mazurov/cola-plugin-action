#!/usr/bin/env bash

set -euo pipefail

# package-plugin.sh
# Creates tar.gz archives for Command Launcher plugins

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

PLUGINS_DIR="${PLUGINS_DIR:-plugins}"
OUTPUT_DIR="${OUTPUT_DIR:-build/packages}"
PACKAGE_FORMAT="${PACKAGE_FORMAT:-tar.gz}"

log_info "Packaging plugins from: $PLUGINS_DIR"
log_info "Output directory: $OUTPUT_DIR"
log_info "Package format: $PACKAGE_FORMAT"

# Create output directory
ensure_directory "$OUTPUT_DIR"

# Array to store packaged artifacts
packaged_artifacts=()

# Process each plugin
for plugin_dir in "$PLUGINS_DIR"/*/ ; do
    [[ ! -d "$plugin_dir" ]] && continue

    manifest_file="${plugin_dir}manifest.mf"

    # Skip if no manifest
    if [[ ! -f "$manifest_file" ]]; then
        log_warning "Skipping $(basename "$plugin_dir") - no manifest"
        continue
    fi

    log_section "Processing Plugin"

    # Extract plugin metadata
    plugin_name=$(get_manifest_field "$manifest_file" "pkgName")
    plugin_version=$(get_manifest_field "$manifest_file" "version")
    command_name=$(get_manifest_field "$manifest_file" "command_name")

    if [[ -z "$plugin_name" || -z "$plugin_version" || -z "$command_name" ]]; then
        log_error "Skipping $(basename "$plugin_dir") - incomplete manifest"
        continue
    fi

    log_info "Packaging: $plugin_name"
    log_info "Version: $plugin_version"
    log_info "Command: $command_name"

    # Sanitize name for filename
    safe_name=$(sanitize_name "$command_name")
    archive_name="${safe_name}-${plugin_version}"

    # Only create tar.gz if format is tar.gz or both
    if [[ "$PACKAGE_FORMAT" == "tar.gz" || "$PACKAGE_FORMAT" == "both" ]]; then
        archive_file="${OUTPUT_DIR}/${archive_name}.tar.gz"

        log_info "Creating archive: $archive_file"

        # Create tar.gz archive
        # Use different approach for macOS vs Linux
        plugin_basename=$(basename "$plugin_dir")

        # Create temporary directory with target name
        temp_dir=$(mktemp -d)
        cp -R "${plugin_dir}" "${temp_dir}/${archive_name}"

        # Create archive from temp directory
        tar -czf "${archive_file}" -C "${temp_dir}" "${archive_name}"

        # Cleanup
        rm -rf "${temp_dir}"

        if [[ ! -f "$archive_file" ]]; then
            log_error "Failed to create archive"
            continue
        fi

        # Generate SHA256 checksum
        checksum_file="${archive_file}.sha256"
        checksum=$(generate_checksum "$archive_file")

        if [[ -n "$checksum" ]]; then
            echo "$checksum" > "$checksum_file"
        fi

        # Create metadata JSON
        metadata_file="${OUTPUT_DIR}/${archive_name}.json"
        cat > "$metadata_file" <<EOF
{
  "name": "$command_name",
  "displayName": "$plugin_name",
  "version": "$plugin_version",
  "archive": "$(basename "$archive_file")",
  "format": "tar.gz",
  "checksum": "$checksum"
}
EOF

        # Get file size
        file_size=$(get_file_size_human "$archive_file")

        log_success "Created: $archive_file ($file_size)"
        if [[ -n "$checksum" ]]; then
            log_success "Checksum: $checksum"
        fi
        log_success "Metadata: $metadata_file"

        # Add to packaged artifacts
        packaged_artifacts+=("$archive_file")
    fi
done

# Summary
log_header "Packaging Summary"
log_info "Total packages created: ${#packaged_artifacts[@]}"

if [[ ${#packaged_artifacts[@]} -gt 0 ]]; then
    echo ""
    log_info "Packaged files:"
    for artifact in "${packaged_artifacts[@]}"; do
        echo "  - $artifact"
    done
fi

# Export artifacts to GitHub output
github_output_json_array "artifacts" "${packaged_artifacts[@]}"
if [[ -n "$GITHUB_OUTPUT" ]]; then
    log_info "Exported packaged artifacts to GITHUB_OUTPUT"
fi

if [[ ${#packaged_artifacts[@]} -eq 0 ]]; then
    log_warning "No packages were created"
    exit 1
fi

echo ""
log_success "Packaging completed successfully"
exit 0
