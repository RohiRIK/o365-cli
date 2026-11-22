#!/bin/bash

# Cleanup Branches Script
# Removes all branches except main and creates fresh prod branch

set -e # Exit on error

echo "🧹 Branch Cleanup Script"
echo "========================"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Ensure we're on main branch
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Switching to main branch..."
    git checkout main
fi

# Fetch latest from remote
echo "🔄 Fetching latest changes..."
git fetch --all --prune

# List all branches (local and remote)
echo ""
echo "📋 Current branches:"
echo "-------------------"
git branch -a
echo ""

# Confirm cleanup
read -p "⚠️  This will delete ALL branches except 'main'. Continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 0
fi

echo ""
echo "🗑️  Cleaning up branches..."
echo ""

# Delete all local branches except main
for branch in $(git branch | grep -v "main" | sed 's/\*//g' | xargs); do
    echo "  🗑️  Deleting local branch: $branch"
    git branch -D "$branch" 2>/dev/null || true
done

# Delete all remote branches except main
for branch in $(git branch -r | grep -v "main" | grep -v "HEAD" | sed 's/origin\///g' | xargs); do
    echo "  🗑️  Deleting remote branch: origin/$branch"
    git push origin --delete "$branch" 2>/dev/null || true
done

echo ""
echo "✅ Branch cleanup complete!"
echo ""

# Ask if user wants to create prod branch now
read -p "🚀 Create fresh 'prod' branch now? (Y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "✅ Setup complete. Run this script again or push to main to trigger prod sync."
    exit 0
fi

echo ""
echo "🚀 Creating fresh prod branch..."
echo ""

# Create orphan prod branch (no history)
git checkout --orphan prod

# Remove all files from staging
git rm -rf . 2>/dev/null || true

# Create initial prod branch commit
echo "# O365 CLI - Production Branch" > README.md
echo "" >> README.md
echo "This branch contains production-ready modules only." >> README.md
echo "" >> README.md
echo "**Status**: Initializing..." >> README.md
echo "" >> README.md
echo "Production modules will be automatically synced from main branch." >> README.md

git add README.md
git commit -m "chore: initialize prod branch"

# Push to remote
git push origin prod --force

# Switch back to main
git checkout main

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Summary:"
echo "  - All old branches deleted"
echo "  - Fresh 'prod' branch created"
echo "  - GitHub Action will auto-sync on next push to main"
echo ""
echo "🎯 Next steps:"
echo "  1. Mark stable modules as status = \"prod\""
echo "  2. Push to main branch"
echo "  3. GitHub Action will automatically update prod branch"
echo ""
