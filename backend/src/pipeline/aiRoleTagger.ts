/**
 * Role Tagger — Layer 2 (Task 3.5)
 *
 * AI classifier via AWS Bedrock (Claude).
 * Runs ONCE per update at ingestion time. Result merged with Layer 1 tags.
 * Falls back to Layer 1 tags only if Bedrock is unavailable.
 */

import { UserRole } from "../types";
import { getDB } from "../config/db";
import { tagRolesRuleBased } from "./roleTagger";
import { mergeRoleTags } from "./tagMerger";

const BEDROCK_REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID ||
  "anthropic.claude-3-haiku-20240307-v1:0";

const VALID_ROLES: UserRole[] = [
  "solution_architect",
  "developer",
  "devops",
  "data_engineer",
];

const CLASSIFY_PROMPT = (title: string, simplified: string) => `
You are classifying an AWS announcement for a developer news platform.

Given this AWS update, list which of these roles would find it relevant:
- solution_architect
- developer
- devops
- data_engineer

Rules:
- List only roles that genuinely care about this update
- A role is relevant if the update affects their daily work or decisions
- You may list multiple roles or just one
- Respond with ONLY a JSON array of role strings, nothing else

Example response: ["developer", "devops"]

Title: ${title}
Summary: ${simplified}

Response:`.trim();

/**
 * Call Bedrock to classify roles for a single update.
 * Returns null if Bedrock is unavailable.
 */
async function classifyRolesWithLLM(
  title: string,
  simplified: string
): Promise<UserRole[] | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require("@aws-sdk/client-bedrock-runtime") as {
      BedrockRuntimeClient: new (config: { region: string }) => {
        send: (cmd: unknown) => Promise<{ body: Uint8Array }>;
      };
      InvokeModelCommand: new (input: {
        modelId: string;
        contentType: string;
        accept: string;
        body: Buffer;
      }) => unknown;
    };

    const client = new sdk.BedrockRuntimeClient({ region: BEDROCK_REGION });

    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: CLASSIFY_PROMPT(title, simplified),
        },
      ],
    });

    const command = new sdk.InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: Buffer.from(body),
    });

    const response = await client.send(command);
    const result = JSON.parse(Buffer.from(response.body).toString()) as {
      content?: { type: string; text: string }[];
    };

    const text = result?.content?.[0]?.text?.trim() ?? "";

    // Parse the JSON array response
    const parsed = JSON.parse(text) as unknown[];
    if (!Array.isArray(parsed)) return null;

    // Validate — only accept known role values
    const roles = parsed.filter(
      (r): r is UserRole => typeof r === "string" && VALID_ROLES.includes(r as UserRole)
    );

    return roles.length > 0 ? roles : null;
  } catch (err) {
    console.warn("[aiRoleTagger] Bedrock classification failed:", (err as Error).message);
    return null;
  }
}

/**
 * Process a batch of updates with AI role classification.
 * Merges AI results with existing Layer 1 tags already stored in DB.
 */
export async function aiTagRolesBatch(updateIds: string[]): Promise<void> {
  if (!updateIds.length) return;

  const result = await getDB().query<{
    id: string;
    title: string;
    raw_content: string;
    simplified_en: string | null;
    category: string;
    role_tags: UserRole[];
  }>(
    `SELECT id, title, raw_content, simplified_en, category, role_tags
     FROM updates
     WHERE id = ANY($1)`,
    [updateIds]
  );

  console.log(`[aiRoleTagger] Classifying ${result.rows.length} updates`);

  for (const row of result.rows) {
    try {
      // Use simplified_en if available, fall back to raw content snippet
      const textForClassification =
        row.simplified_en || row.raw_content.slice(0, 500);

      // Layer 1 tags (already in DB, or re-compute if empty)
      const layer1Tags =
        row.role_tags?.length > 0
          ? row.role_tags
          : tagRolesRuleBased(row.title, row.raw_content, row.category);

      // Layer 2: AI classification
      const layer2Tags = await classifyRolesWithLLM(row.title, textForClassification);

      // Merge both layers
      const finalTags = layer2Tags
        ? mergeRoleTags(layer1Tags, layer2Tags)
        : layer1Tags;

      await getDB().query(
        `UPDATE updates SET role_tags = $1::user_role[] WHERE id = $2`,
        [finalTags, row.id]
      );

      console.log(
        `[aiRoleTagger] ${row.id}: L1=${layer1Tags.join(",")} L2=${layer2Tags?.join(",") ?? "skipped"} final=${finalTags.join(",")}`
      );
    } catch (err) {
      console.error(`[aiRoleTagger] Failed for ${row.id}:`, err);
    }
  }

  console.log("[aiRoleTagger] Done");
}
