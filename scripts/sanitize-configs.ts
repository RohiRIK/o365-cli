/**
 * Sanitize Configuration Files
 *
 * Removes sensitive files and internal documentation from the production branch.
 * This ensures no secrets, private notes, or development artifacts are exposed.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Files and patterns to remove from production branch
const SENSITIVE_PATTERNS = [
  // Environment files
  '.env',
  '.env.*',
  '!.env.example', // Keep example file

  // Secret files
  '**/secrets/**',
  '**/credentials/**',
  '**/*.key',
  '**/*.pem',
  '**/*.p12',

  // Internal documentation
  'docs/INTERNAL.md',
  'docs/internal/**',
  'NOTES.md',
  'TODO.md',

  // Conductor (project management)
  'conductor/**',

  // PAI Skills (personal automation)
  '.claude/skills/**',

  // Development artifacts
  'scripts/dev/**',
  '**/*.local.*',

  // Output directories (may contain tenant data)
  'output/**',
  'logs/**',
  'core/output/**',

  // Dependencies (CRITICAL - must exclude from prod)
  'node_modules/**',
  'core/node_modules/**',
  '**/node_modules',

  // Git artifacts
  '.git',
  '.github/ISSUE_TEMPLATE/**',
  '.github/PULL_REQUEST_TEMPLATE.md',

  // Keep only prod workflow
  '.github/workflows/*',
  '!.github/workflows/sync-prod.yml',
];

async function sanitizeConfigs() {
  console.log('🧹 Sanitizing configuration files...\n');

  // CRITICAL: Delete node_modules directories FIRST (before git operations)
  const nodeModulesDirs = ['node_modules', 'core/node_modules'];

  for (const dir of nodeModulesDirs) {
    if (fs.existsSync(dir)) {
      console.log(`🗑️  Removing: ${dir}`);
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✅ Deleted: ${dir}`);
    }
  }

  let removedCount = 0;

  for (const pattern of SENSITIVE_PATTERNS) {
    // Skip negated patterns (they're exclusions)
    if (pattern.startsWith('!')) continue;

    try {
      const files = await glob(pattern, {
        dot: true,
        ignore: SENSITIVE_PATTERNS.filter(p => p.startsWith('!'))
          .map(p => p.slice(1)) // Remove the '!' prefix
      });

      for (const file of files) {
        if (fs.existsSync(file)) {
          const stat = fs.statSync(file);

          if (stat.isDirectory()) {
            fs.rmSync(file, { recursive: true, force: true });
          } else {
            fs.unlinkSync(file);
          }

          console.log(`🗑️  Removed: ${file}`);
          removedCount++;
        }
      }
    } catch (error) {
      // Some patterns may not match, that's okay
      console.log(`⚠️  Pattern skipped: ${pattern}`);
    }
  }

  // Create production .env.example
  createProductionEnvExample();

  // Create production .gitignore
  createProductionGitignore();

  console.log(`\n📊 Summary:`);
  console.log(`   Sensitive files removed: ${removedCount}`);
}

function createProductionEnvExample() {
  const envExample = `# O365 CLI - Environment Variables (Production)

# Microsoft Entra ID OAuth Configuration
# Register your app at: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
CLIENT_ID=your-client-id-here
TENANT_ID=common

# Optional: Logging
LOG_LEVEL=info

# Note: Do NOT commit actual credentials to this repository
`;

  fs.writeFileSync('.env.example', envExample);
  console.log('✅ Created: .env.example');
}

function createProductionGitignore() {
  const gitignore = `# Dependencies
node_modules/
bun.lockb

# Environment
.env
.env.local
.env.*.local

# Output
output/
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Build artifacts
dist/
build/
`;

  // Create .gitignore in root
  fs.writeFileSync('.gitignore', gitignore);
  console.log('✅ Created: .gitignore');

  // Also create .gitignore in core/ directory
  if (fs.existsSync('core')) {
    fs.writeFileSync('core/.gitignore', gitignore);
    console.log('✅ Created: core/.gitignore');
  }
}

// Run sanitization
sanitizeConfigs().catch(error => {
  console.error('❌ Error sanitizing configs:', error);
  process.exit(1);
});
