# 🚀 Production Sync Setup Guide

This guide walks you through setting up automatic production module syncing to a separate `prod` branch.

---

## 📋 What This Does

When you push to `main`:
1. ✅ GitHub Action automatically runs
2. ✅ Creates clean `prod` branch
3. ✅ Copies **only** modules with `status = "prod"`
4. ✅ Removes sensitive files (secrets, internal docs, conductor)
5. ✅ Generates public-facing README
6. ✅ Pushes to `prod` branch

**Result:** You have a clean, public-ready branch that auto-updates!

---

## 🏁 Initial Setup (One-Time)

### Step 1: Clean Existing Branches

Run the cleanup script to remove all old branches:

```bash
cd "/Users/rohirikman/Library/CloudStorage/GoogleDrive-rohi5054@gmail.com/My Drive/06-Projects/02-package-scrpts"

./scripts/cleanup-branches.sh
```

**This will:**
- Delete all branches except `main`
- Create fresh `prod` branch
- Push to remote

**⚠️ IMPORTANT:** Make sure you've committed any important work from other branches first!

---

### Step 2: Mark Stable Modules as Production

Edit your handler files and change:

```typescript
// FROM:
status = "beta" as const;

// TO:
status = "prod" as const;
```

**Only mark modules that are:**
- ✅ Fully tested
- ✅ Stable and working
- ✅ Safe for public use

**Example modules to mark as prod:**
- `rep:ca-roadmap` (if stable)
- Any other finished modules

**Keep as beta/draft:**
- Experimental features
- Work-in-progress modules
- Internal-only tools

---

### Step 3: Configure GitHub Actions Permissions

1. Go to your GitHub repository
2. Click **Settings** → **Actions** → **General**
3. Under "Workflow permissions":
   - ✅ Select **Read and write permissions**
   - ✅ Check **Allow GitHub Actions to create and approve pull requests**
4. Click **Save**

**Why:** The action needs permission to push to the `prod` branch.

---

### Step 4: Test Locally (Optional)

Before pushing, you can test the scripts:

```bash
# Test what would be filtered
git checkout -b test-sync
bun run scripts/filter-prod-modules.ts
# Check output - only prod modules should remain

# Clean up
git checkout main
git branch -D test-sync
```

---

### Step 5: Trigger First Sync

Commit and push to main:

```bash
git add .
git commit -m "chore: setup production sync automation"
git push origin main
```

**Watch the Action:**
1. Go to GitHub → **Actions** tab
2. See "Sync Production Modules to Prod Branch" running
3. Check logs for any errors
4. View summary when complete

---

### Step 6: Verify Prod Branch

```bash
# Fetch latest
git fetch origin

# Check out prod branch
git checkout prod

# Verify only prod modules exist
ls core/src/handlers/

# Check README
cat README.md

# Switch back to main
git checkout main
```

---

## 🔄 Day-to-Day Usage

After setup, the workflow is automatic:

### 1. Work in Main Branch

```bash
git checkout main

# Make changes
# Add new modules or update existing ones
```

### 2. Mark Stable Modules as Prod

```typescript
// In your handler file
status = "prod" as const;
```

### 3. Commit and Push

```bash
git add .
git commit -m "feat: add new production module"
git push origin main
```

### 4. Action Runs Automatically

GitHub Action will:
- ✅ Detect changes in `core/src/handlers/`
- ✅ Sync prod modules to `prod` branch
- ✅ Update README with new modules

**That's it!** No manual work needed.

---

## 🎯 Advanced: Making Prod Branch Public

### Option A: Separate Public Repo (Recommended)

Create a dedicated public repository:

```bash
# Create new repo on GitHub: yourorg/o365-cli-public

# Add as remote
git remote add public https://github.com/yourorg/o365-cli-public.git

# Push prod branch to public repo
git push public prod:main --force

# Update GitHub Action to auto-push
# (modify .github/workflows/sync-prod.yml)
```

### Option B: Same Repo, Public Prod Branch

If using GitHub Teams/Enterprise:

1. Keep `main` private
2. Make only `prod` branch public
3. Set `prod` as default branch for public view

---

## 📊 Monitoring & Maintenance

### Check Action Status

```bash
# View GitHub Actions status
gh run list --workflow=sync-prod.yml

# View latest run logs
gh run view
```

### Manual Sync Trigger

If you need to force a sync:

1. Go to GitHub → **Actions**
2. Select "Sync Production Modules to Prod Branch"
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

### View Prod Branch Diff

```bash
# See what's different between main and prod
git diff main..prod
```

---

## 🗂️ Files Created

Here's what was added to your repo:

```
.github/workflows/
  └── sync-prod.yml          # GitHub Action workflow

scripts/
  ├── cleanup-branches.sh    # Branch cleanup script
  ├── filter-prod-modules.ts # Filter to prod modules only
  ├── sanitize-configs.ts    # Remove sensitive files
  ├── generate-prod-readme.ts # Generate public README
  └── README.md              # Scripts documentation

PRODUCTION_SYNC_SETUP.md     # This file
```

---

## 🐛 Troubleshooting

### Action Fails: "Permission denied"

**Fix:** Enable write permissions in Settings → Actions → General

### No Modules in Prod Branch

**Fix:** Ensure at least one handler has `status = "prod"`

### Script Won't Run

**Fix:** Make executable:
```bash
chmod +x scripts/cleanup-branches.sh
```

### Cleanup Deleted Important Branch

**Fix:** Branches are recoverable for ~30 days:
```bash
git reflog
git checkout <commit-hash>
git checkout -b recovered-branch
```

---

## 📞 Support

- **Scripts Documentation:** `scripts/README.md`
- **GitHub Actions Logs:** Repository → Actions tab
- **Action Config:** `.github/workflows/sync-prod.yml`

---

## ✅ Checklist

Before marking setup as complete:

- [ ] Ran `cleanup-branches.sh` successfully
- [ ] Marked stable modules as `status = "prod"`
- [ ] Enabled GitHub Actions write permissions
- [ ] Pushed to main and action ran successfully
- [ ] Verified prod branch contains only prod modules
- [ ] Checked generated README in prod branch

---

**Setup Date:** 2026-01-02
**Last Updated:** 2026-01-02
