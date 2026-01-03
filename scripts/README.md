# Automation Scripts

This directory contains automation scripts for managing production module syncing and branch cleanup.

## 📋 Scripts Overview

### 1. **cleanup-branches.sh**
Cleans up all branches except `dev` and creates a fresh `prod` branch.

**Usage:**
```bash
chmod +x scripts/cleanup-branches.sh
./scripts/cleanup-branches.sh
```

**What it does:**
- ✅ Deletes all local branches except `dev`
- ✅ Deletes all remote branches except `dev`
- ✅ Creates a fresh `prod` orphan branch
- ✅ Pushes clean `prod` branch to remote

---

### 2. **filter-prod-modules.ts**
Filters codebase to keep only production modules (status = "prod").

**Usage:**
```bash
bun run scripts/filter-prod-modules.ts
```

**What it does:**
- ✅ Scans all handler files
- ✅ Removes files without `status = "prod"`
- ✅ Cleans up empty directories
- ✅ Prints summary of kept/removed modules

---

### 3. **sanitize-configs.ts**
Removes sensitive files and internal documentation.

**Usage:**
```bash
bun run scripts/sanitize-configs.ts
```

**What it does:**
- ✅ Removes `.env`, secrets, credentials
- ✅ Removes internal docs (`conductor/`, `.claude/skills/`)
- ✅ Removes output and log files
- ✅ Creates production `.env.example` and `.gitignore`

---

### 4. **generate-prod-readme.ts**
Generates public-facing README.md for production branch.

**Usage:**
```bash
bun run scripts/generate-prod-readme.ts
```

**What it does:**
- ✅ Scans production modules
- ✅ Groups by category
- ✅ Generates module documentation
- ✅ Adds installation instructions
- ✅ Adds Azure setup guide

---

## 🚀 Initial Setup

### Step 1: Clean Existing Branches

```bash
# Make script executable
chmod +x scripts/cleanup-branches.sh

# Run cleanup
./scripts/cleanup-branches.sh
```

This will:
1. Delete all branches except `dev`
2. Create fresh `prod` branch
3. Push to remote

### Step 2: Mark Production Modules

Edit your handler files and set:
```typescript
status = "prod" as const;
```

For stable, production-ready modules only.

### Step 3: Enable GitHub Action

The GitHub Action is already configured in `.github/workflows/sync-prod.yml`.

It will automatically run when:
- You push to `dev` branch
- Changes are made to `core/src/handlers/`, `core/src/services/`, or `core/src/utils/`

### Step 4: Trigger First Sync

```bash
# Commit your changes
git add .
git commit -m "feat: mark modules as production ready"

# Push to dev (this triggers the action)
git push origin dev
```

The GitHub Action will:
1. Create clean `prod` branch
2. Copy only production modules
3. Remove sensitive files
4. Generate production README
5. Push to `prod` branch

---

## 📊 Monitoring

### Check GitHub Action Status

1. Go to your repository on GitHub
2. Click **Actions** tab
3. See "Sync Production Modules to Prod Branch" workflow
4. View logs and summary

### Manual Trigger

You can manually trigger the workflow:

1. Go to **Actions** tab
2. Select "Sync Production Modules to Prod Branch"
3. Click **Run workflow**
4. Select `dev` branch
5. Click **Run workflow**

---

## 🔧 Testing Scripts Locally

Before pushing, you can test scripts locally:

```bash
# Test filter script
git checkout -b test-filter
bun run scripts/filter-prod-modules.ts
git status # See what would be removed
git checkout dev
git branch -D test-filter

# Test sanitization
git checkout -b test-sanitize
bun run scripts/sanitize-configs.ts
ls -la # See what files remain
git checkout dev
git branch -D test-sanitize

# Test README generation
bun run scripts/generate-prod-readme.ts
cat README.md # Preview generated README
git checkout README.md # Restore original
```

---

## 🎯 Production Branch Usage

Once set up, the `prod` branch will:

- ✅ Auto-update on every push to `dev`
- ✅ Contain only production modules
- ✅ Have clean, public-facing README
- ✅ Be free of secrets and internal docs
- ✅ Be safe to make public (if desired)

### Making Prod Branch Public (Optional)

If you want to make only the `prod` branch public:

1. Go to repository **Settings**
2. Under **Branches**, set default branch to `prod`
3. Make repository public
4. Dev branch remains private (if using GitHub Teams/Enterprise)

OR create a separate public repository:

```bash
# Create new public repo on GitHub: RohiRIK/o365-cli-public

# Add as remote
git remote add public https://github.com/RohiRIK/o365-cli-public.git

# Push prod branch
git push public prod:main
```

---

## 🔒 Security Notes

- ⚠️ **Never commit secrets** to any branch
- ✅ All `.env` files are excluded
- ✅ Conductor files are removed from prod
- ✅ Internal docs are removed from prod
- ✅ Output/logs are excluded

---

## 🆘 Troubleshooting

### "Permission denied" when running cleanup script

```bash
chmod +x scripts/cleanup-branches.sh
```

### GitHub Action fails with "Permission denied"

Ensure GitHub Actions has write permissions:
1. Repo Settings → Actions → General
2. Workflow permissions → Read and write permissions

### Prod branch not updating

1. Check GitHub Actions logs
2. Ensure you pushed to `dev` branch
3. Ensure changes were in `core/src/handlers/`
4. Try manual workflow trigger

### Script says "No production modules found"

Ensure at least one handler has:
```typescript
status = "prod" as const;
```

---

**Last Updated:** 2026-01-02
