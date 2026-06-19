import { reportQueue } from "./report-queue";
import type { QueuedReport } from "./report-queue";
import { api } from "./api";

const MAX_RETRIES = 10;
const BASE_BACKOFF_MS = 2000;

type SyncListener = (counts: {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
}) => void;

let running = false;
let awaitingFollowUpMigrationDone = false;
let listeners: SyncListener[] = [];

const notifyListeners = async () => {
  const counts = await reportQueue.getCounts();
  for (const listener of listeners) {
    listener(counts);
  }
};

export const syncEngine = {
  onStatusChange(listener: SyncListener) {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  async refreshCounts() {
    await notifyListeners();
  },

  async processQueue() {
    if (running) return;
    if (!navigator.onLine) return;

    running = true;

    try {
      if (!awaitingFollowUpMigrationDone) {
        // Legacy migration: clients queued reports as "awaiting-follow-up"
        // before #51 moved the questions in-flow. Nothing flips that status
        // anymore, so adopt any stragglers as pending — their answers (or the
        // user's abandonment) are already final.
        const stranded = await reportQueue.getByStatus("awaiting-follow-up");
        for (const report of stranded) {
          await reportQueue.updateStatus(report.id, "pending");
        }
        awaitingFollowUpMigrationDone = true;
      }

      const pending = await reportQueue.getByStatus("pending");
      const failed = await reportQueue.getByStatus("failed");
      const retryable = failed.filter((r) => r.retryCount < MAX_RETRIES);
      const toProcess = [...pending, ...retryable];

      for (const report of toProcess) {
        if (!navigator.onLine) break;
        await syncEngine.syncReport(report);
        await notifyListeners();
      }
    } finally {
      running = false;
      await notifyListeners();

      // Re-check for pending reports (failures with backoff get set back to pending)
      if (navigator.onLine) {
        const remaining = await reportQueue.getByStatus("pending");
        if (remaining.length > 0) {
          syncEngine.processQueue();
        }
      }
    }
  },

  async syncReport(report: QueuedReport) {
    await reportQueue.updateStatus(report.id, "syncing", {
      lastAttempt: new Date().toISOString(),
    });
    await notifyListeners();

    try {
      let photoKey = report.photoKey;
      if (report.photo && !photoKey) {
        const contentType = report.photoContentType || "image/jpeg";
        const blob = new Blob([report.photo], { type: contentType });
        photoKey = await uploadPhoto(blob, contentType);
        await reportQueue.updateStatus(report.id, "syncing", { photoKey });
      }

      const e2ePrefix = (globalThis as { __E2E_PREFIX__?: string })
        .__E2E_PREFIX__;
      const device_id = e2ePrefix
        ? `${e2ePrefix}${crypto.randomUUID()}`
        : undefined;

      const result = await api("/reports", {
        method: "POST",
        body: JSON.stringify({
          latitude: report.latitude,
          longitude: report.longitude,
          building_id: report.buildingId,
          damage_level: report.damageLevel,
          ai_damage_level: report.aiDamageLevel,
          ai_infrastructure_type: report.aiInfrastructureType,
          ai_confidence: report.aiConfidence,
          photo_key: photoKey,
          infrastructure_type: report.surveyData.infrastructureType,
          infrastructure_type_other:
            report.surveyData.infrastructureTypeOther || null,
          infrastructure_description:
            report.surveyData.infrastructureDescription || null,
          crisis_nature: report.surveyData.crisisNature,
          debris_present: report.surveyData.debrisPresent,
          electricity_status: report.surveyData.electricityStatus || null,
          health_status: report.surveyData.healthStatus || null,
          pressing_needs: report.surveyData.pressingNeeds,
          pressing_needs_other: report.surveyData.pressingNeedsOther || null,
          offline_queue_id: report.id,
          follow_up_responses: report.followUpResponses ?? null,
          device_id,
        }),
      });

      if (result.status === "created" || result.status === "duplicate") {
        await reportQueue.updateStatus(report.id, "synced", {
          syncedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const is4xx = message.includes("API error 4");

      if (is4xx) {
        await reportQueue.updateStatus(report.id, "failed", {
          error: message,
          retryCount: MAX_RETRIES,
        });
      } else {
        const retryCount = report.retryCount + 1;
        if (retryCount >= MAX_RETRIES) {
          await reportQueue.updateStatus(report.id, "failed", {
            error: `Max retries exceeded: ${message}`,
            retryCount,
          });
        } else {
          await reportQueue.updateStatus(report.id, "pending", {
            error: message,
            retryCount,
          });
          const backoff = Math.min(
            BASE_BACKOFF_MS * Math.pow(2, retryCount - 1),
            60000,
          );
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
      await notifyListeners();
    }
  },
};

async function uploadPhoto(blob: Blob, contentType: string): Promise<string> {
  const { photo_key, upload_url } = await api("/photos/upload", {
    method: "POST",
    body: JSON.stringify({ content_type: contentType }),
  });

  const response = await fetch(upload_url, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });

  if (!response.ok) {
    throw new Error(`Photo upload failed: ${response.status}`);
  }

  return photo_key;
}
