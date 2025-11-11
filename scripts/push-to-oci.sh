#!/usr/bin/env bash

set -euo pipefail

# push-to-oci.sh
# Pushes plugin packages to OCI registry using ORAS

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common functions
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

OCI_REGISTRY="${OCI_REGISTRY:-}"
OCI_USERNAME="${OCI_USERNAME:-}"
OCI_TOKEN="${OCI_TOKEN:-}"
PLUGINS_DIR="${PLUGINS_DIR:-plugins}"

log_info "Pushing plugins to OCI registry"

# Validate required environment variables
[[ -z "$OCI_REGISTRY" ]] && die "OCI_REGISTRY is not set"
[[ -z "$OCI_USERNAME" ]] && die "OCI_USERNAME is not set"
[[ -z "$OCI_TOKEN" ]] && die "OCI_TOKEN is not set"

log_info "Registry: $OCI_REGISTRY"
log_info "Username: $OCI_USERNAME"

# Install ORAS if not present
if ! command -v oras &> /dev/null; then
    log_info "ORAS not found, installing..."

    # Detect OS and architecture
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)

    case "$ARCH" in
        x86_64) ARCH="amd64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        *) die "Unsupported architecture: $ARCH" ;;
    esac

    # Download and install ORAS
    ORAS_VERSION="1.1.0"
    ORAS_URL="https://github.com/oras-project/oras/releases/download/v${ORAS_VERSION}/oras_${ORAS_VERSION}_${OS}_${ARCH}.tar.gz"

    log_info "Downloading ORAS from: $ORAS_URL"

    curl -sLO "$ORAS_URL"
    mkdir -p oras-install
    tar -xzf "oras_${ORAS_VERSION}_${OS}_${ARCH}.tar.gz" -C oras-install
    sudo mv oras-install/oras /usr/local/bin/
    rm -rf oras-install "oras_${ORAS_VERSION}_${OS}_${ARCH}.tar.gz"

    log_success "ORAS installed successfully"
fi

# Verify ORAS installation
oras version

# Login to OCI registry
echo ""
log_info "Authenticating to OCI registry..."
echo "$OCI_TOKEN" | oras login "$OCI_REGISTRY" -u "$OCI_USERNAME" --password-stdin

if [[ $? -ne 0 ]]; then
    die "Failed to authenticate to OCI registry"
fi

log_success "Authentication successful"

# Initialize counter
pushed_count=0

# Process each plugin
for plugin_dir in "$PLUGINS_DIR"/*/ ; do
    [[ ! -d "$plugin_dir" ]] && continue

    manifest_file="${plugin_dir}manifest.mf"

    if [[ ! -f "$manifest_file" ]]; then
        log_warning "Skipping $(basename "$plugin_dir") - no manifest"
        continue
    fi

    log_section "Processing Plugin"

    # Extract plugin metadata
    plugin_name=$(get_manifest_field "$manifest_file" "Name")
    plugin_version=$(get_manifest_field "$manifest_file" "Version")
    command_name=$(get_manifest_field "$manifest_file" "Command-Name")
    description=$(get_manifest_field "$manifest_file" "Description")

    if [[ -z "$plugin_name" || -z "$plugin_version" || -z "$command_name" ]]; then
        log_error "Skipping $(basename "$plugin_dir") - incomplete manifest"
        continue
    fi

    echo "Pushing: $plugin_name"
    echo "Version: $plugin_version"
    echo "Command: $command_name"

    # Sanitize name for OCI reference
    safe_name=$(sanitize_name "$command_name")
    oci_ref="${OCI_REGISTRY}/${safe_name}"

    # Check if this version already exists
    if check_oci_tag_exists "$oci_ref" "$plugin_version"; then
        log_warning "Version ${plugin_version} already exists in OCI registry: ${oci_ref}:${plugin_version}"
        log_warning "Skipping push (already published)"
        ((pushed_count++))  # Count as success since it exists
        continue
    fi

    log_info "Version ${plugin_version} not found in registry, will push..."

    # Create temporary tar.gz for OCI push
    temp_dir=$(mktemp -d)
    temp_archive="${temp_dir}/plugin.tar.gz"

    (
        cd "$PLUGINS_DIR"
        plugin_basename=$(basename "$plugin_dir")
        tar -czf "$temp_archive" "${plugin_basename}/"
    )

    if [[ ! -f "$temp_archive" ]]; then
        log_error "Failed to create temporary archive"
        continue
    fi

    # Push to OCI registry with annotations
    log_info "Pushing to: ${oci_ref}:${plugin_version}"

    push_cmd=(
        oras push "${oci_ref}:${plugin_version}"
        "$temp_archive:application/vnd.oci.image.layer.v1.tar+gzip"
        --annotation "org.opencontainers.image.title=${plugin_name}"
        --annotation "org.opencontainers.image.version=${plugin_version}"
    )

    if [[ -n "$description" ]]; then
        push_cmd+=(--annotation "org.opencontainers.image.description=${description}")
    fi

    if "${push_cmd[@]}"; then
        log_success "Pushed: ${oci_ref}:${plugin_version}"

        # Tag as latest
        log_info "Tagging as latest..."
        if oras tag "${oci_ref}:${plugin_version}" latest; then
            log_success "Tagged: ${oci_ref}:latest"
        else
            log_warning "Failed to tag as latest"
        fi

        ((pushed_count++))
    else
        log_error "Failed to push to OCI registry"
    fi

    # Clean up temporary archive
    rm -rf "$temp_dir"
done

# Logout from registry
oras logout "$OCI_REGISTRY" 2>/dev/null || true

# Summary
log_header "OCI Push Summary"
echo "Packages processed: $pushed_count"

if [[ $pushed_count -eq 0 ]]; then
    log_warning "No packages were processed"
    exit 1
fi

echo ""
log_success "OCI push completed successfully"
log_info "Note: Versions already in registry were skipped (not an error)"
exit 0
