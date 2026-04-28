const DB_NAME = "terra";
const DB_VERSION = 1;
const STORE_NAME = "pending_reports";

export type ReportStatus = "pending" | "syncing" | "synced" | "failed";

export interface QueuedReport {
  id: string; // offline_queue_id
  status: ReportStatus;
  photo: ArrayBuffer | null;
  photoContentType: string | null;
  photoKey: string | null; // set after photo upload succeeds
  latitude: number;
  longitude: number;
  s2Id: string | null;
  locationDescription: string | null;
  damageLevel: string;
  aiDamageLevel: string | null;
  aiInfrastructureType: string[] | null;
  aiConfidence: number | null;
  surveyData: {
    infrastructureType: string[];
    infrastructureTypeOther: string;
    infrastructureName: string;
    crisisNature: string[];
    debrisPresent: boolean | null;
    electricityStatus: string;
    healthStatus: string;
    pressingNeeds: string[];
    pressingNeedsOther: string;
  };
  error: string | null;
  retryCount: number;
  createdAt: string;
  lastAttempt: string | null;
  syncedAt: string | null;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
};

export const reportQueue = {
  /** Add a new report to the queue */
  async add(report: Omit<QueuedReport, "status" | "error" | "retryCount" | "lastAttempt" | "syncedAt">): Promise<QueuedReport> {
    const queued: QueuedReport = {
      ...report,
      status: "pending",
      error: null,
      retryCount: 0,
      lastAttempt: null,
      syncedAt: null,
    };
    await withStore("readwrite", (store) => store.put(queued));
    return queued;
  },

  /** Get all reports with a given status */
  async getByStatus(status: ReportStatus): Promise<QueuedReport[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("status");
      const request = index.getAll(status);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  },

  /** Get all reports ordered by creation time */
  async getAll(): Promise<QueuedReport[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result as QueuedReport[];
        results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  },

  /** Get a single report by ID */
  async get(id: string): Promise<QueuedReport | undefined> {
    return withStore("readonly", (store) => store.get(id));
  },

  /** Update a report's status and metadata */
  async updateStatus(
    id: string,
    status: ReportStatus,
    extra?: Partial<Pick<QueuedReport, "error" | "photoKey" | "retryCount" | "lastAttempt" | "syncedAt">>,
  ): Promise<void> {
    const report = await reportQueue.get(id);
    if (!report) return;

    const updated: QueuedReport = {
      ...report,
      status,
      ...extra,
    };

    await withStore("readwrite", (store) => store.put(updated));
  },

  /** Remove a synced or discarded report */
  async remove(id: string): Promise<void> {
    await withStore("readwrite", (store) => store.delete(id));
  },

  /** Remove all synced reports */
  async clearSynced(): Promise<void> {
    const synced = await reportQueue.getByStatus("synced");
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const report of synced) {
        store.delete(report.id);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Get counts by status */
  async getCounts(): Promise<Record<ReportStatus, number>> {
    const all = await reportQueue.getAll();
    const counts: Record<ReportStatus, number> = {
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
    };
    for (const report of all) {
      counts[report.status]++;
    }
    return counts;
  },
};
