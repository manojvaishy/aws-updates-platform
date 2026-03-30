/**
 * Pipeline Scheduler
 *
 * Registers cron jobs for the content ingestion pipeline.
 * Call startScheduler() once during app bootstrap.
 *
 * Schedule: every 6 hours = "0 * /6 * * *" (spaces removed in actual value)
 * For local dev set PIPELINE_CRON env var to override,
 * e.g. PIPELINE_CRON="* /5 * * * *" to run every 5 minutes.
 */

import cron from "node-cron";
import { pollFeed } from "./rssPoller";
import { simplifyBatch } from "./simplifier";
import { tagRolesBatch } from "./roleTagger";
import { aiTagRolesBatch } from "./aiRoleTagger";
import { scorePriorityBatch } from "./priorityScorer";
import { translateBatch } from "./translator";
import { markProcessedAndInvalidate } from "./postProcess";
import { withRetry } from "./retry";

const CRON_SCHEDULE = process.env.PIPELINE_CRON || "0 */6 * * *";

let isRunning = false;

interface StepResult { step: string; ok: boolean; durationMs: number; error?: string }

async function runStep(label: string, fn: () => Promise<void>): Promise<StepResult> {
  const t = Date.now();
  try {
    await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1000, label });
    return { step: label, ok: true, durationMs: Date.now() - t };
  } catch (err) {
    return { step: label, ok: false, durationMs: Date.now() - t, error: (err as Error).message };
  }
}

export async function runPipeline(): Promise<void> {
  if (isRunning) {
    console.warn("[pipeline] Already running, skipping this trigger");
    return;
  }

  isRunning = true;
  const start = Date.now();
  const results: StepResult[] = [];

  try {
    // Step 1: RSS poll (no retry — if feed is down, skip this run)
    const pollResult = await pollFeed();

    if (pollResult.inserted === 0) {
      console.log("[pipeline] No new updates to process");
      return;
    }

    console.log(`[pipeline] ${pollResult.inserted} new updates — starting enrichment`);
    const ids = pollResult.insertedIds;

    // Steps 2–7: each wrapped with retry + timing
    results.push(await runStep("simplify",    () => simplifyBatch(ids)));
    results.push(await runStep("tagL1",       () => tagRolesBatch(ids)));
    results.push(await runStep("tagL2",       () => aiTagRolesBatch(ids)));
    results.push(await runStep("priority",    () => scorePriorityBatch(ids)));
    results.push(await runStep("translate",   () => translateBatch(ids)));
    results.push(await runStep("postProcess", () => markProcessedAndInvalidate(ids)));

    // Log summary
    const failed = results.filter((r) => !r.ok);
    console.log(
      `[pipeline] Done in ${Date.now() - start}ms | ` +
      results.map((r) => `${r.step}:${r.ok ? "ok" : "FAIL"}(${r.durationMs}ms)`).join(" | ")
    );
    if (failed.length) {
      console.error(`[pipeline] ${failed.length} step(s) failed:`, failed.map((r) => `${r.step}: ${r.error}`));
    }

  } catch (err) {
    console.error("[pipeline] Fatal error:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the cron scheduler.
 */
export function startScheduler(): void {
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`[scheduler] Invalid cron expression: "${CRON_SCHEDULE}"`);
    return;
  }

  cron.schedule(CRON_SCHEDULE, () => {
    console.log(`[scheduler] Triggered at ${new Date().toISOString()}`);
    runPipeline().catch((err) =>
      console.error("[scheduler] Pipeline error:", err)
    );
  });

  console.log(`[scheduler] RSS poller scheduled: "${CRON_SCHEDULE}"`);
}
