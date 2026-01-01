/**
 * Baseline Check Registry
 *
 * Central registry that loads all modular baseline checks.
 * Each check is defined in a separate file with co-located metadata and detection logic.
 *
 * Benefits of modular approach:
 * - Type safety (full TypeScript support)
 * - Co-location (logic and metadata together)
 * - Testability (import individual checks)
 * - Scalability (add new check = add new file)
 * - No JSON bloat
 */

import type { BaselineCheck, CheckHelpers } from "./types";

// Foundation pillar
import { createCAP001Check } from "./foundation/CAP001-block-legacy-auth";
import { createCAU002Check } from "./foundation/CAU002-mfa-all-users";
import { createCAU009Check } from "./foundation/CAU009-mfa-admin-portals";
import { createCAU008Check } from "./foundation/CAU008-phishing-resistant-mfa";
import { createCAU012Check } from "./foundation/CAU012-mfa-registration";

// Risk-Based pillar
import { createCAU015Check } from "./risk-based/CAU015-block-high-risk-signin";
import { createCAU006Check } from "./risk-based/CAU006-mfa-medium-risk-signin";
import { createCAU016Check } from "./risk-based/CAU016-block-high-risk-user";
import { createCAU007Check } from "./risk-based/CAU007-password-reset-risk";

// Zero Trust pillar
import { createCAD001Check } from "./zero-trust/CAD001-device-compliance";
import { createCAD002Check } from "./zero-trust/CAD002-mobile-mam";

// Administration pillar
import { createCAU017Check } from "./admin/CAU017-admin-signin-frequency";
import { createCAU018Check } from "./admin/CAU018-admin-browser-persistence";

// Guest/External pillar
import { createCAU001Check } from "./guest/CAU001-guest-mfa";
import { createCAU001ACheck } from "./guest/CAU001A-guest-admin-mfa";

/**
 * Initialize all baseline checks with the provided helpers
 *
 * @param helpers CheckHelpers implementation from the analyzer
 * @returns Array of all 15 baseline checks, ready to evaluate
 */
export function getAllChecks(helpers: CheckHelpers): BaselineCheck[] {
  return [
    // Foundation (Priority 1) - 5 checks
    createCAP001Check(helpers),
    createCAU002Check(helpers),
    createCAU009Check(helpers),
    createCAU008Check(helpers),
    createCAU012Check(helpers),

    // Risk-Based (Priority 2) - 4 checks
    createCAU015Check(helpers),
    createCAU006Check(helpers),
    createCAU016Check(helpers),
    createCAU007Check(helpers),

    // Zero Trust (Priority 3) - 2 checks
    createCAD001Check(helpers),
    createCAD002Check(helpers),

    // Administration (Priority 1) - 2 checks
    createCAU017Check(helpers),
    createCAU018Check(helpers),

    // Guest/External (Priority 2) - 2 checks
    createCAU001Check(helpers),
    createCAU001ACheck(helpers),
  ];
}

/**
 * Get a specific check by ID
 *
 * @param helpers CheckHelpers implementation
 * @param checkId Baseline check ID (e.g., "CAP001")
 * @returns The requested check, or undefined if not found
 */
export function getCheckById(helpers: CheckHelpers, checkId: string): BaselineCheck | undefined {
  const checks = getAllChecks(helpers);
  return checks.find((check) => check.id === checkId);
}

/**
 * Get checks by pillar
 *
 * @param helpers CheckHelpers implementation
 * @param pillar Pillar name
 * @returns Array of checks in this pillar
 */
export function getChecksByPillar(
  helpers: CheckHelpers,
  pillar: string
): BaselineCheck[] {
  const checks = getAllChecks(helpers);
  return checks.filter((check) => check.pillar === pillar);
}

/**
 * Get checks by priority
 *
 * @param helpers CheckHelpers implementation
 * @param priority Priority level (1-3)
 * @returns Array of checks at this priority
 */
export function getChecksByPriority(
  helpers: CheckHelpers,
  priority: number
): BaselineCheck[] {
  const checks = getAllChecks(helpers);
  return checks.filter((check) => check.priority === priority);
}
