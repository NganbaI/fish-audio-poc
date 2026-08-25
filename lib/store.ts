// Minimal file-backed store for call records. POC-grade: a single JSON file under
// /data, guarded by an in-process mutex. Swap for SQLite/Prisma for anything real.
// Note: this does not survive `next dev` hot-reloads cleanly across processes, but
// is fine for a single-process POC.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { CallRecord } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "calls.json");

let writeChain: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<Record<string, CallRecord>> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(raw) as Record<string, CallRecord>;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

async function writeAll(db: Record<string, CallRecord>): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

/** Serialize writes so concurrent webhook calls don't clobber each other. */
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  // Keep the chain alive regardless of individual success/failure.
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function listCalls(): Promise<CallRecord[]> {
  return readAll().then((db) =>
    Object.values(db).sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
    ),
  );
}

export function getCall(id: string): Promise<CallRecord | undefined> {
  return readAll().then((db) => db[id]);
}

/**
 * Create or merge a call record. `patch` is shallow-merged over the existing
 * record; pass a full object for new records. `now` must be provided by the
 * caller (routes have Date access; keeps this module side-effect-light).
 */
export function upsertCall(
  id: string,
  patch: Partial<CallRecord>,
  now: string,
): Promise<CallRecord> {
  return withLock(async () => {
    const db = await readAll();
    const existing = db[id];
    const merged: CallRecord = {
      ...existing,
      ...patch,
      id,
      status: patch.status ?? existing?.status ?? "created",
      createdAt: existing?.createdAt ?? patch.createdAt ?? now,
      updatedAt: now,
    };
    db[id] = merged;
    await writeAll(db);
    return merged;
  });
}
