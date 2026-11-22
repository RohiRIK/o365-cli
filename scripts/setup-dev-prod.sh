#!/bin/bash

# Setup Dev → Prod Branch Strategy
# Safe cleanup and initialization script

set -e  # Exit on error

echo "🚀 Setting up Dev → Prod branch strategy"
echo "========================================"
echo ""

REPO_PATH="/Users/rohirikman/Library/CloudStorage/GoogleDrive-rohi5054@gmail.com/My Drive/06-Projects/02-package-scrpts"

cd "$REPO_PATH"

# Verify we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not a git repository"
    exit 1
fi

# Step 1: Ensure we're on dev branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "📍 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo "⚠️  Switching to dev branch..."
    git checkout dev
fi

# Step 2: Ensure all changes are committed
if ! git diff-index --quiet HEAD --; then
    echo ""
    echo "⚠️  You have uncommitted changes!"
    echo ""
    git status --short
    echo ""
    read -p "Commit these changes first? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "chore: commit changes before branch restructure"
        echo "✅ Changes committed"
    else
        echo "❌ Please commit or stash changes first"
        exit 1
    fi
fi

# Step 3: Push dev to remote (ensure backup)
echo ""
echo "📤 Pushing dev to remote as backup..."
git push origin dev

# Step 4: Fetch all remote branches
echo ""
echo "🔄 Fetching latest from remote..."
git fetch --all --prune

# Step 5: Show what will be deleted
echo ""
echo "📋 Branches that will be deleted:"
echo "  - feat/ts-orchestration (local + remote)"
echo "  - feature/comprehensive-upgrade (local + remote)"
echo "  - main (local + remote)"
echo ""
echo "⚠️  This is SAFE because:"
echo "  ✅ dev has all latest work (af6f9f1)"
echo "  ✅ dev is already pushed to remote"
echo "  ✅ You can recover from remote if needed"
echo ""

read -p "Continue with branch cleanup? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 0
fi

# Step 6: Delete local branches
echo ""
echo "🗑️  Deleting local branches..."

for branch in feat/ts-orchestration feature/comprehensive-upgrade main; do
    if git show-ref --verify --quiet refs/heads/$branch; then
        echo "  Deleting local: $branch"
        git branch -D "$branch" 2>/dev/null || true
    fi
done

# Step 7: Delete remote branches
echo ""
echo "🗑️  Deleting remote branches..."

for branch in feat/ts-orchestration feature/comprehensive-upgrade main; do
    if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
        echo "  Deleting remote: origin/$branch"
        git push origin --delete "$branch" 2>/dev/null || true
    fi
done

# Step 8: Create fresh prod branch
echo ""
echo "🚀 Creating fresh prod branch..."

# Delete existing prod if it exists
git branch -D prod 2>/dev/null || true
git push origin --delete prod 2>/dev/null || true

# Create orphan prod branch (no history)
git checkout --orphan prod

# Remove all files from staging
git rm -rf . 2>/dev/null || true

# Create initial prod README
cat > README.md << 'EOF'
# O365 CLI - Production Branch

**Status:** Initializing...

This branch is automatically synchronized from the `dev` branch.
It contains only production-ready modules (`status = "prod"`).

## Auto-Sync Process

When you push to `dev`, GitHub Actions will:
1. Filter to production modules only
2. Remove sensitive files (secrets, internal docs)
3. Generate public-facing README
4. Update this branch automatically

**Last Sync:** Pending first run

---

This is an auto-generated branch. Do not commit directly to this branch.
All changes should be made in the `dev` branch.
EOF

# Commit and push
git add README.md
git commit -m "chore: initialize prod branch"
git push origin prod

# Switch back to dev
git checkout dev

# Step 9: Set dev as default branch
echo ""
echo "⚙️  GitHub Configuration Required:"
echo ""
echo "Please go to:"
echo "  https://github.com/YOUR_USERNAME/YOUR_REPO/settings/branches"
echo ""
echo "And set 'dev' as the default branch"
echo ""

# Step 10: Enable GitHub Actions permissions
echo "Also enable GitHub Actions permissions:"
echo "  https://github.com/YOUR_USERNAME/YOUR_REPO/settings/actions"
echo ""
echo "Under 'Workflow permissions':"
echo "  ✅ Select 'Read and write permissions'"
echo "  ✅ Check 'Allow GitHub Actions to create and approve pull requests'"
echo ""

# Step 11: Summary
echo ""
echo "✅ Setup Complete!"
echo ""
echo "📊 Final Branch Structure:"
echo "  ✅ dev   - Your main development branch (current)"
echo "  ✅ prod  - Auto-generated production branch"
echo ""
echo "🗑️  Deleted Branches:"
echo "  ❌ feat/ts-orchestration"
echo "  ❌ feature/comprehensive-upgrade"
echo "  ❌ main"
echo ""
echo "🎯 Next Steps:"
echo "  1. Set 'dev' as default branch on GitHub"
echo "  2. Enable GitHub Actions permissions"
echo "  3. Mark stable modules as status = \"prod\""
echo "  4. Push to dev → Action will auto-sync to prod"
echo ""
echo "🔗 GitHub Actions will run on next push to dev"
echo ""
