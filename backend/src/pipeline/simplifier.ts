/**
 * LLM Simplification — Task 3.3
 *
 * Converts raw AWS announcements into plain-English summaries using AWS Bedrock.
 * Runs ONCE per update at ingestion time. Result stored permanently in DB.
 * Never called at request time.
 *
 * Model: Claude 3 Haiku (fast + cheap, good for summarization)
 * Fallback: if Bedrock is unavailable, stores a truncated version of raw content.
 */

import { getDB } from "../config/db";

const BEDROCK_REGION = process.env.AWS_REGION || "us-east-1";
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID ||
  "anthropic.claude-3-haiku-20240307-v1:0";

const SIMPLIFY_PROMPT = (title: string, content: string) => `
You are a technical writer helping developers understand AWS updates quickly.

Given this AWS announcement, write a plain-English summary (3-4 sentences max) that explains:
1. What changed or was announced
2. Why it matters to developers
3. What action (if any) they should take

Keep it simple. Avoid jargon. Write for a developer who is busy and needs the key point fast.

Title: ${title}

Content: ${content.slice(0, 3000)}

Summary:`.trim();

/**
 * Call AWS Bedrock (Claude) to simplify an announcement.
 * Returns the simplified text, or null if the call fails.
 */
async function callBedrock(title: string, rawContent: string): Promise<string | null> {
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
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: SIMPLIFY_PROMPT(title, rawContent),
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

    const text = result?.content?.[0]?.text ?? "";
    return text.trim() || null;
  } catch (err) {
    console.error("[simplifier] Bedrock call failed:", err);
    return null;
  }
}

/**
 * Fallback: extract a plain-text snippet from raw HTML/text content.
 * Used when Bedrock is unavailable or not configured.
 */
function extractFallbackSummary(rawContent: string, maxLength = 400): string {
  // Strip HTML tags
  const text = rawContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

/**
 * Simplify a single update and store the result in the DB.
 * Returns the simplified text (from LLM or fallback).
 */
export async function simplifyAndStore(
  updateId: string,
  title: string,
  rawContent: string
): Promise<string> {
  // Try LLM first
  let simplified = await callBedrock(title, rawContent);

  if (!simplified) {
    console.warn(`[simplifier] Using fallback for update ${updateId}`);
    simplified = extractFallbackSummary(rawContent);
  }

  // Store permanently — never re-run for this update
  await getDB().query(
    `UPDATE updates SET simplified_en = $1 WHERE id = $2`,
    [simplified, updateId]
  );

  console.log(`[simplifier] Stored simplified_en for ${updateId}`);
  return simplified;
}

/**
 * Process a batch of unprocessed updates that are missing simplified_en.
 * Called by the pipeline after RSS ingestion.
 */
export async function simplifyBatch(updateIds: string[]): Promise<void> {
  if (!updateIds.length) return;

  // Fetch raw content for all IDs in one query
  const result = await getDB().query<{
    id: string;
    title: string;
    raw_content: string;
  }>(
    `SELECT id, title, raw_content FROM updates
     WHERE id = ANY($1) AND simplified_en IS NULL`,
    [updateIds]
  );

  console.log(`[simplifier] Processing ${result.rows.length} updates`);

  for (const row of result.rows) {
    try {
      await simplifyAndStore(row.id, row.title, row.raw_content);
    } catch (err) {
      console.error(`[simplifier] Failed for ${row.id}:`, err);
    }
  }
}
