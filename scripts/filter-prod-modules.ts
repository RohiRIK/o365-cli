/**
 * Filter Production Modules
 *
 * Removes all non-production modules from the codebase.
 * Only keeps modules with status = "prod".
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const HANDLERS_DIR = 'core/src/handlers';

async function filterProdModules() {
  console.log('🔍 Scanning for modules...\n');

  // Find all handler files
  const files = await glob(`${HANDLERS_DIR}/**/*.ts`, {
    ignore: ['**/*.test.ts', '**/*.spec.ts']
  });

  let keptCount = 0;
  let removedCount = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');

    // Check if module has status = "prod"
    const isProd = content.includes('status = "prod"') ||
                   content.includes("status: 'prod'") ||
                   content.includes('status: "prod"');

    if (!isProd) {
      // Delete non-prod modules
      fs.unlinkSync(file);
      console.log(`❌ Removed: ${file}`);
      removedCount++;
    } else {
      console.log(`✅ Kept:    ${file}`);
      keptCount++;
    }
  }

  // Clean up empty directories
  await cleanEmptyDirectories(HANDLERS_DIR);

  console.log(`\n📊 Summary:`);
  console.log(`   Production modules kept: ${keptCount}`);
  console.log(`   Non-production removed:  ${removedCount}`);
}

async function cleanEmptyDirectories(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await cleanEmptyDirectories(fullPath);

      // Check if directory is now empty
      const contents = fs.readdirSync(fullPath);
      if (contents.length === 0) {
        fs.rmdirSync(fullPath);
        console.log(`🗑️  Removed empty dir: ${fullPath}`);
      }
    }
  }
}

// Run the filter
filterProdModules().catch(error => {
  console.error('❌ Error filtering modules:', error);
  process.exit(1);
});
