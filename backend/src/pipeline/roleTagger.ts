/**
 * Role Tagger — Layer 1 (Task 3.4)
 *
 * Rule-based keyword + service category mapping.
 * Fast, deterministic, zero external calls.
 * Layer 2 (AI classifier, task 3.5) supplements this.
 */

import { UserRole } from "../types";

// ── Service → Role mapping ───────────────────────────────────
// Each service name maps to the roles that care about it.
const SERVICE_ROLE_MAP: Record<string, UserRole[]> = {
  // Compute
  "ec2":              ["developer", "devops", "solution_architect"],
  "lambda":           ["developer", "devops"],
  "fargate":          ["devops", "developer"],
  "lightsail":        ["developer", "solution_architect"],
  "batch":            ["devops", "data_engineer"],
  "outposts":         ["solution_architect", "devops"],
  "wavelength":       ["solution_architect"],

  // Containers
  "ecs":              ["devops", "developer"],
  "eks":              ["devops", "developer"],
  "ecr":              ["devops", "developer"],
  "app runner":       ["developer"],
  "app mesh":         ["devops"],

  // Storage
  "s3":               ["developer", "devops", "data_engineer", "solution_architect"],
  "ebs":              ["devops", "solution_architect"],
  "efs":              ["devops", "developer"],
  "fsx":              ["devops", "data_engineer"],
  "storage gateway":  ["devops", "solution_architect"],
  "backup":           ["devops", "solution_architect"],

  // Database
  "rds":              ["developer", "devops", "data_engineer"],
  "aurora":           ["developer", "devops", "data_engineer"],
  "dynamodb":         ["developer", "solution_architect"],
  "elasticache":      ["developer", "devops"],
  "documentdb":       ["developer"],
  "neptune":          ["developer", "data_engineer"],
  "timestream":       ["data_engineer", "developer"],
  "keyspaces":        ["developer", "data_engineer"],
  "memorydb":         ["developer", "devops"],

  // Analytics & Data
  "glue":             ["data_engineer"],
  "athena":           ["data_engineer", "developer"],
  "redshift":         ["data_engineer", "solution_architect"],
  "emr":              ["data_engineer"],
  "kinesis":          ["data_engineer", "developer"],
  "kafka":            ["data_engineer", "developer"],
  "msk":              ["data_engineer", "developer"],
  "lake formation":   ["data_engineer"],
  "quicksight":       ["data_engineer", "solution_architect"],
  "data pipeline":    ["data_engineer"],
  "opensearch":       ["developer", "data_engineer"],
  "elasticsearch":    ["developer", "data_engineer"],

  // AI/ML
  "bedrock":          ["developer", "solution_architect"],
  "sagemaker":        ["developer", "data_engineer"],
  "rekognition":      ["developer"],
  "comprehend":       ["developer", "data_engineer"],
  "textract":         ["developer"],
  "translate":        ["developer"],
  "polly":            ["developer"],
  "lex":              ["developer"],
  "kendra":           ["developer", "solution_architect"],

  // Networking
  "vpc":              ["devops", "solution_architect"],
  "cloudfront":       ["developer", "devops", "solution_architect"],
  "route 53":         ["devops", "solution_architect"],
  "api gateway":      ["developer", "solution_architect"],
  "load balancer":    ["devops", "solution_architect"],
  "alb":              ["devops", "solution_architect"],
  "nlb":              ["devops", "solution_architect"],
  "direct connect":   ["solution_architect"],
  "transit gateway":  ["solution_architect", "devops"],
  "global accelerator": ["solution_architect"],

  // Security & Identity
  "iam":              ["devops", "solution_architect"],
  "cognito":          ["developer", "solution_architect"],
  "kms":              ["devops", "solution_architect"],
  "secrets manager":  ["devops", "developer"],
  "waf":              ["devops", "solution_architect"],
  "shield":           ["solution_architect"],
  "guardduty":        ["devops", "solution_architect"],
  "security hub":     ["devops", "solution_architect"],
  "inspector":        ["devops"],
  "macie":            ["devops", "solution_architect"],
  "certificate manager": ["devops", "developer"],

  // DevOps & CI/CD
  "codepipeline":     ["devops"],
  "codebuild":        ["devops", "developer"],
  "codecommit":       ["devops", "developer"],
  "codedeploy":       ["devops"],
  "codeartifact":     ["devops", "developer"],
  "cloudformation":   ["devops", "solution_architect"],
  "cdk":              ["devops", "developer"],
  "sam":              ["developer", "devops"],
  "systems manager":  ["devops"],
  "ssm":              ["devops"],
  "cloudwatch":       ["devops", "developer"],
  "x-ray":            ["devops", "developer"],
  "config":           ["devops", "solution_architect"],
  "cloudtrail":       ["devops", "solution_architect"],

  // Serverless & Integration
  "step functions":   ["developer", "devops"],
  "eventbridge":      ["developer", "devops"],
  "sns":              ["developer", "devops"],
  "sqs":              ["developer", "devops"],
  "mq":               ["developer", "devops"],
  "appsync":          ["developer"],

  // Cost & Management
  "cost explorer":    ["solution_architect"],
  "budgets":          ["solution_architect"],
  "organizations":    ["solution_architect", "devops"],
  "control tower":    ["solution_architect", "devops"],
  "service catalog":  ["solution_architect", "devops"],
  "well-architected": ["solution_architect"],
};

// ── Category → Role mapping ──────────────────────────────────
const CATEGORY_ROLE_MAP: Record<string, UserRole[]> = {
  "Compute":        ["developer", "devops", "solution_architect"],
  "Containers":     ["devops", "developer"],
  "Storage":        ["developer", "devops", "data_engineer"],
  "Database":       ["developer", "data_engineer"],
  "Analytics":      ["data_engineer", "developer"],
  "AI/ML":          ["developer", "data_engineer"],
  "Serverless":     ["developer", "devops"],
  "Networking":     ["devops", "solution_architect"],
  "Security":       ["devops", "solution_architect"],
  "DevOps":         ["devops"],
  "Infrastructure": ["devops", "solution_architect"],
  "Management":     ["solution_architect", "devops"],
  "Integration":    ["developer", "devops"],
  "General":        ["developer", "devops", "solution_architect", "data_engineer"],
};

// ── Keyword → Role mapping (title/content signals) ──────────
const KEYWORD_ROLE_MAP: Array<{ pattern: RegExp; roles: UserRole[] }> = [
  { pattern: /deprecat|end.of.support|end.of.life|migration/i, roles: ["developer", "devops", "solution_architect", "data_engineer"] },
  { pattern: /sdk|cli|api|library|package/i,                   roles: ["developer"] },
  { pattern: /pricing|cost|saving|free tier/i,                 roles: ["solution_architect"] },
  { pattern: /compliance|hipaa|pci|soc|gdpr|fedramp/i,         roles: ["solution_architect", "devops"] },
  { pattern: /performance|latency|throughput|benchmark/i,      roles: ["developer", "solution_architect"] },
  { pattern: /limit|quota|increase/i,                          roles: ["developer", "devops", "solution_architect"] },
  { pattern: /region|availability zone|az/i,                   roles: ["solution_architect", "devops"] },
  { pattern: /container|docker|kubernetes|helm/i,              roles: ["devops", "developer"] },
  { pattern: /machine learning|deep learning|model|inference/i, roles: ["data_engineer", "developer"] },
  { pattern: /pipeline|etl|data lake|warehouse/i,              roles: ["data_engineer"] },
  { pattern: /monitoring|logging|observability|alert/i,        roles: ["devops", "developer"] },
  { pattern: /terraform|ansible|puppet|chef/i,                 roles: ["devops"] },
  { pattern: /serverless|function|trigger/i,                   roles: ["developer", "devops"] },
];

/**
 * Layer 1: Rule-based role tagging.
 *
 * Matches against:
 * 1. Service names in the title/content
 * 2. Category label
 * 3. Keyword patterns in title/content
 *
 * Returns a deduplicated array of matching roles.
 */
export function tagRolesRuleBased(
  title: string,
  content: string,
  category: string
): UserRole[] {
  const matched = new Set<UserRole>();
  const text = `${title} ${content}`.toLowerCase();

  // 1. Service name matching
  for (const [service, roles] of Object.entries(SERVICE_ROLE_MAP)) {
    if (text.includes(service.toLowerCase())) {
      roles.forEach((r) => matched.add(r));
    }
  }

  // 2. Category mapping
  const categoryRoles = CATEGORY_ROLE_MAP[category];
  if (categoryRoles) {
    categoryRoles.forEach((r) => matched.add(r));
  }

  // 3. Keyword pattern matching (title + content)
  for (const { pattern, roles } of KEYWORD_ROLE_MAP) {
    if (pattern.test(title) || pattern.test(content)) {
      roles.forEach((r) => matched.add(r));
    }
  }

  // If nothing matched, tag all roles (general announcement)
  if (matched.size === 0) {
    return ["developer", "devops", "solution_architect", "data_engineer"];
  }

  return Array.from(matched);
}

/**
 * Extract AWS service names mentioned in the text.
 * Used to populate the service_tags column.
 */
export function extractServiceTags(title: string, content: string): string[] {
  const text = `${title} ${content}`.toLowerCase();
  const found = new Set<string>();

  for (const service of Object.keys(SERVICE_ROLE_MAP)) {
    if (text.includes(service.toLowerCase())) {
      // Capitalize for display (e.g. "ec2" -> "EC2", "s3" -> "S3")
      found.add(service.toUpperCase().replace(/ /g, " "));
    }
  }

  return Array.from(found).slice(0, 10); // cap at 10 tags
}

import { getDB } from "../config/db";
import { mergeRoleTags } from "./tagMerger";

/**
 * Process a batch of updates — apply rule-based role + service tags and store.
 */
export async function tagRolesBatch(updateIds: string[]): Promise<void> {
  if (!updateIds.length) return;

  const result = await getDB().query<{
    id: string;
    title: string;
    raw_content: string;
    category: string;
  }>(
    `SELECT id, title, raw_content, category FROM updates
     WHERE id = ANY($1) AND (role_tags = '{}' OR role_tags IS NULL)`,
    [updateIds]
  );

  console.log(`[roleTagger] Tagging ${result.rows.length} updates`);

  for (const row of result.rows) {
    try {
      const roleTags = mergeRoleTags(
        tagRolesRuleBased(row.title, row.raw_content, row.category)
      );
      const serviceTags = extractServiceTags(row.title, row.raw_content);

      await getDB().query(
        `UPDATE updates
         SET role_tags = $1::user_role[], service_tags = $2
         WHERE id = $3`,
        [roleTags, serviceTags, row.id]
      );
    } catch (err) {
      console.error(`[roleTagger] Failed for ${row.id}:`, err);
    }
  }

  console.log(`[roleTagger] Done`);
}
