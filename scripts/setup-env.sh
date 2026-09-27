#!/bin/bash

# Agent Context Helper Script
# Usage: source scripts/setup-env.sh

# Capture the script's location immediately when sourced
_CTX_SCRIPT_SOURCE="${BASH_SOURCE[0]}"
# Fallback for Zsh
if [ -z "$_CTX_SCRIPT_SOURCE" ]; then _CTX_SCRIPT_SOURCE="${(%):-%x}"; fi
# Fallback to $0
if [ -z "$_CTX_SCRIPT_SOURCE" ]; then _CTX_SCRIPT_SOURCE="$0"; fi

# Resolve the absolute project root
# We use a subshell to avoid changing the current shell's PWD during resolution
_CTX_SCRIPT_DIR="$( cd "$( dirname "$_CTX_SCRIPT_SOURCE" )" && pwd )"
_CTX_PROJECT_ROOT="$( cd "$_CTX_SCRIPT_DIR/.." && pwd )"

# Navigate to the project root
project-root() {
    cd "$_CTX_PROJECT_ROOT" || return
}

# Print the content of conductor/context.json
get-context() {
    if [ -f "$_CTX_PROJECT_ROOT/conductor/context.json" ]; then
        cat "$_CTX_PROJECT_ROOT/conductor/context.json"
    else
        echo "Error: conductor/context.json not found in $_CTX_PROJECT_ROOT" >&2
        return 1
    fi
}

# Run the CLI using Bun
run-cli() {
    (
        cd "$_CTX_PROJECT_ROOT" || exit
        bun run core/src/cli.ts "$@"
    )
}