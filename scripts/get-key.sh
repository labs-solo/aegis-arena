#!/usr/bin/env bash
# Retrieves an AEGIS Arena private key from macOS Keychain
# Usage: get-key.sh <wallet-name>
# Example: get-key.sh deployer

set -euo pipefail

WALLET="${1:?Usage: get-key.sh <wallet-name>}"

security find-generic-password -s "aegis-arena-${WALLET}" -a "talos" -w
