import { getDB } from "../config/db";

const TRANSLATE_REGION = process.env.TRANSLATE_REGION || process.env.AWS_REGION || "us-east-1";

async function translateText(text: string, targetLang: string): Promise<string | null> {
  try {
    const sdk = require("@aws-sdk/client-translate") as {
      TranslateClient: new (c: { region: string }) => { send: (cmd: unknown) => Promise<{ TranslatedText: string }> };
      TranslateTextCommand: new (i: { Text: string; SourceLanguageCode: string; TargetLanguageCode: string }) => unknown;
    };
    const client = new sdk.TranslateClient({ region: TRANSLATE_REGION });
    const response = await client.send(new sdk.TranslateTextCommand({
      Text: text.slice(0, 5000),
      SourceLanguageCode: "en",
      TargetLanguageCode: targetLang,
    }));
    return response.TranslatedText ?? null;
  } catch (err) {
    console.warn(`[translator] Translate to ${targetLang} failed:`, (err as Error).message);
    return null;
  }
}

function makeHinglish(english: string, hindi: string): string {
  const enWords = english.split(" ");
  const hiWords = hindi.split(" ");
  const result: string[] = [];
  for (let i = 0; i < enWords.length; i++) {
    result.push(i % 3 === 1 && hiWords[i] ? hiWords[i] : enWords[i]);
  }
  return result.join(" ");
}

export async function translateAndStore(updateId: string, simplifiedEn: string): Promise<void> {
  const hindi = await translateText(simplifiedEn, "hi");
  const hinglish = hindi ? makeHinglish(simplifiedEn, hindi) : null;
  await getDB().query(
    `UPDATE updates SET simplified_hi = $1, simplified_hinglish = $2 WHERE id = $3`,
    [hindi, hinglish, updateId]
  );
  console.log(`[translator] Stored translations for ${updateId}`);
}

export async function translateBatch(updateIds: string[]): Promise<void> {
  if (!updateIds.length) return;
  const result = await getDB().query<{ id: string; simplified_en: string }>(
    `SELECT id, simplified_en FROM updates WHERE id = ANY($1) AND simplified_en IS NOT NULL AND simplified_hi IS NULL`,
    [updateIds]
  );
  console.log(`[translator] Translating ${result.rows.length} updates`);
  for (const row of result.rows) {
    try {
      await translateAndStore(row.id, row.simplified_en);
    } catch (err) {
      console.error(`[translator] Failed for ${row.id}:`, err);
    }
  }
  console.log("[translator] Done");
}
