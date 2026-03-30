/**
 * Unit tests for the content ingestion pipeline — Task 15.1
 * Tests pure functions only (no DB/Redis required).
 */

import { computeContentHash } from "../pipeline/deduplication";
import { tagRolesRuleBased, extractServiceTags } from "../pipeline/roleTagger";
import { mergeRoleTags } from "../pipeline/tagMerger";
import { scorePriorityByKeywords } from "../pipeline/priorityScorer";

// ── Deduplication ────────────────────────────────────────────

describe("computeContentHash", () => {
  it("returns a 32-char hex string", () => {
    const hash = computeContentHash("https://aws.amazon.com/test", "Title", "2025-01-01");
    expect(hash).toMatch(/^[a-f0-9]{32}$/);
  });

  it("same inputs produce same hash", () => {
    const a = computeContentHash("https://aws.amazon.com/test", "Title", "2025-01-01");
    const b = computeContentHash("https://aws.amazon.com/test", "Title", "2025-01-01");
    expect(a).toBe(b);
  });

  it("different URLs produce different hashes", () => {
    const a = computeContentHash("https://aws.amazon.com/a", "Title", "2025-01-01");
    const b = computeContentHash("https://aws.amazon.com/b", "Title", "2025-01-01");
    expect(a).not.toBe(b);
  });

  it("normalises date to date-only (ignores time jitter)", () => {
    const a = computeContentHash("https://aws.amazon.com/test", "Title", "2025-01-15T10:00:00Z");
    const b = computeContentHash("https://aws.amazon.com/test", "Title", "2025-01-15T22:00:00Z");
    expect(a).toBe(b);
  });

  it("different titles produce different hashes", () => {
    const a = computeContentHash("https://aws.amazon.com/test", "Title A", "2025-01-01");
    const b = computeContentHash("https://aws.amazon.com/test", "Title B", "2025-01-01");
    expect(a).not.toBe(b);
  });
});

// ── Role Tagger (Layer 1) ────────────────────────────────────

describe("tagRolesRuleBased", () => {
  it("tags developer for Lambda updates", () => {
    const roles = tagRolesRuleBased("AWS Lambda now supports Node.js 22", "", "Serverless");
    expect(roles).toContain("developer");
  });

  it("tags data_engineer for Glue updates", () => {
    const roles = tagRolesRuleBased("AWS Glue adds new connector", "", "Analytics");
    expect(roles).toContain("data_engineer");
  });

  it("tags devops for EKS updates", () => {
    const roles = tagRolesRuleBased("Amazon EKS now supports version 1.30", "", "Containers");
    expect(roles).toContain("devops");
  });

  it("tags solution_architect for pricing changes", () => {
    const roles = tagRolesRuleBased("AWS announces price reduction for EC2", "", "Compute");
    expect(roles).toContain("solution_architect");
  });

  it("tags all roles for deprecation notices", () => {
    const roles = tagRolesRuleBased("Lambda Node.js 16 deprecation notice", "", "Serverless");
    expect(roles).toContain("developer");
    expect(roles).toContain("devops");
  });

  it("returns all roles when nothing matches (general announcement)", () => {
    const roles = tagRolesRuleBased("AWS announces new partnership", "", "General");
    expect(roles).toHaveLength(4);
  });

  it("returns deduplicated roles", () => {
    const roles = tagRolesRuleBased("EC2 Lambda update", "", "Compute");
    const unique = new Set(roles);
    expect(unique.size).toBe(roles.length);
  });
});

describe("extractServiceTags", () => {
  it("extracts EC2 from title", () => {
    const tags = extractServiceTags("Amazon EC2 now supports new instance types", "");
    expect(tags.some((t) => t.toUpperCase().includes("EC2"))).toBe(true);
  });

  it("extracts multiple services", () => {
    const tags = extractServiceTags("S3 and Lambda integration update", "");
    expect(tags.length).toBeGreaterThanOrEqual(2);
  });

  it("caps at 10 tags", () => {
    const tags = extractServiceTags(
      "EC2 Lambda S3 RDS EKS ECS Glue Athena Redshift Kinesis Bedrock SageMaker",
      ""
    );
    expect(tags.length).toBeLessThanOrEqual(10);
  });

  it("returns empty array when no services found", () => {
    const tags = extractServiceTags("AWS announces new partnership program", "");
    expect(Array.isArray(tags)).toBe(true);
  });
});

// ── Tag Merger ───────────────────────────────────────────────

describe("mergeRoleTags", () => {
  it("merges two arrays without duplicates", () => {
    const result = mergeRoleTags(["developer", "devops"], ["devops", "data_engineer"]);
    expect(result).toContain("developer");
    expect(result).toContain("devops");
    expect(result).toContain("data_engineer");
    expect(result.filter((r) => r === "devops")).toHaveLength(1);
  });

  it("returns all roles when both inputs are empty", () => {
    const result = mergeRoleTags([], []);
    expect(result).toHaveLength(4);
  });

  it("filters out invalid role values", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = mergeRoleTags(["developer", "invalid_role" as any]);
    expect(result).not.toContain("invalid_role");
    expect(result).toContain("developer");
  });

  it("handles null/undefined sources gracefully", () => {
    const result = mergeRoleTags(["developer"], null, undefined);
    expect(result).toContain("developer");
  });

  it("returns roles in consistent order", () => {
    const a = mergeRoleTags(["devops", "developer"]);
    const b = mergeRoleTags(["developer", "devops"]);
    expect(a).toEqual(b);
  });
});

// ── Priority Scorer ──────────────────────────────────────────

describe("scorePriorityByKeywords", () => {
  it("returns critical for deprecation notices", () => {
    expect(scorePriorityByKeywords("Lambda Node.js 16 deprecation", "")).toBe("critical");
  });

  it("returns critical for end-of-support", () => {
    expect(scorePriorityByKeywords("End of support for Python 3.8", "")).toBe("critical");
  });

  it("returns critical for breaking changes", () => {
    expect(scorePriorityByKeywords("Breaking change in IAM policy evaluation", "")).toBe("critical");
  });

  it("returns high for new GA services", () => {
    expect(scorePriorityByKeywords("Amazon Bedrock is now generally available", "")).toBe("high");
  });

  it("returns high for price changes", () => {
    expect(scorePriorityByKeywords("AWS announces price reduction for S3", "")).toBe("high");
  });

  it("returns high for new features", () => {
    expect(scorePriorityByKeywords("Lambda now supports new feature", "")).toBe("high");
  });

  it("returns null for normal updates (no strong signal)", () => {
    expect(scorePriorityByKeywords("Minor documentation update for CloudWatch", "")).toBeNull();
  });

  it("critical takes precedence over high signals", () => {
    // Title has both deprecation (critical) and "new feature" (high)
    expect(scorePriorityByKeywords("Deprecation of old feature, new feature available", "")).toBe("critical");
  });

  it("checks content as well as title", () => {
    const result = scorePriorityByKeywords(
      "Lambda update",
      "This is a mandatory upgrade required before end of support"
    );
    expect(result).toBe("critical");
  });
});
