#!/bin/bash

# Test script for scripts/setup-env.sh

# Mock the context file for testing
mkdir -p conductor
echo '{"test": "context"}' > conductor/context.json

# Source the script (expecting it to exist)
if [ ! -f "scripts/setup-env.sh" ]; then
    echo "FAIL: scripts/setup-env.sh not found"
    exit 1
fi

source scripts/setup-env.sh

# Test get-context
echo "Testing get-context..."
CONTEXT=$(get-context)
if [[ "$CONTEXT" != *'"test": "context"'* ]]; then
    echo "FAIL: get-context did not return expected content"
    echo "Got: $CONTEXT"
    exit 1
fi
echo "PASS: get-context"

# Test project-root
echo "Testing project-root..."
# Move to a subdir to test navigation
mkdir -p scripts/tests/subdir
cd scripts/tests/subdir || exit 1
project-root
CUR_DIR=$(pwd)
# We expect to be back at the root (where conductor dir exists)
if [ ! -d "conductor" ]; then
    echo "FAIL: project-root did not navigate to root. Current dir: $CUR_DIR"
    exit 1
fi
echo "PASS: project-root"

# Test run-cli alias/function
echo "Testing run-cli..."
# We can't easily execute the full CLI in this mock, but we can check if the alias/function exists
if ! command -v run-cli &> /dev/null; then
    echo "FAIL: run-cli command not found"
    exit 1
fi
echo "PASS: run-cli"

echo "ALL TESTS PASSED"
exit 0
