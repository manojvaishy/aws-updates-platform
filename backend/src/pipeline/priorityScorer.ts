import { Priority } from "../types";
import { getDB } from "../config/db";

const CRITICAL_PATTERNS = [/deprecat/i,/end.of.support/i,/end.of.life/i,/breaking.change/i,/security.bulletin/i,/urgent/i,/must.migrate/i,/no.longer.supported/i];
const HIGH_PATTERNS = [/new.service/i,/generally.available/i,/price.reduction/i,/price.change/i,/limit.increase/i,/quota.increase/i,/new.region/i,/new.feature/i,/now.supports/i];

export function scorePriorityByKeywords(title: string, content: string): Priority | null {
  const text = `${title} ${content}`;
  for (const p of CRITICAL_PATTERNS) if (p.test(text)) return "critical";
  for (const p of HIGH_PATTERNS) if (p.test(text)) return "high";
  return null;
}

export async function scoreUpdatePriority(title: string, rawContent: string, simplifiedEn: string | null): Promise<Priority> {
  return scorePriorityByKeywords(title, rawContent) ?? "normal";
}

export async function scorePriorityBatch(updateIds: string[]): Promise<void> {
  if (!updateIds.length) return;
  const result = await getDB().query<{ id: string; title: string; raw_content: string; simplified_en: string | null }>(
    `SELECT id, title, raw_content, simplified_en FROM updates WHERE id = ANY($1) AND priority = 'normal'`, [updateIds]
  );
  console.log(`[priorityScorer] Scoring ${result.rows.length} updates`);
  for (const row of result.rows) {
    try {
      const priority = await scoreUpdatePriority(row.title, row.raw_content, row.simplified_en);
      await getDB().query(`UPDATE updates SET priority = $1 WHERE id = $2`, [priority, row.id]);
      if (priority !== "normal") console.log(`[priorityScorer] ${row.id} => ${priority}`);
    } catch (err) { console.error(`[priorityScorer] Failed for ${row.id}:`, err); }
  }
}
