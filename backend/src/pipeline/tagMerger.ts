/**
 * Tag Merger — Task 3.6
 *
 * Single source of truth for merging and deduplicating role tags
 * from Layer 1 (rule-based) and Layer 2 (AI classifier).
 *
 * Rules:
 * - Union of both sets (never discard a tag from either layer)
 * - Deduplicated (Set-based)
 * - Validated (only known UserRole values survive)
 * - Fallback: if both layers produce nothing, tag all roles
 */

import { UserRole } from "../types";

const VALID_ROLES = new Set<UserRole>([
  "solution_architect",
  "developer",
  "devops",
  "data_engineer",
]);

/**
 * Validate that a value is a known UserRole.
 */
export function isValidRole(value: unknown): value is UserRole {
  return typeof value === "string" && VALID_ROLES.has(value as UserRole);
}

/**
 * Merge role tags from multiple sources into a single deduplicated array.
 * Filters out any invalid values. Falls back to all roles if result is empty.
 */
export function mergeRoleTags(...sources: (UserRole[] | null | undefined)[]): UserRole[] {
  const merged = new Set<UserRole>();

  for (const source of sources) {
    if (!source) continue;
    for (const role of source) {
      if (isValidRole(role)) merged.add(role);
    }
  }

  // Fallback: if no roles matched, tag all (general announcement)
  if (merged.size === 0) {
    return Array.from(VALID_ROLES);
  }

  // Return in consistent order
  return (Array.from(VALID_ROLES) as UserRole[]).filter((r) => merged.has(r));
}
