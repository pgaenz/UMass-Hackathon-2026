import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Serializes read-modify-write cycles per file, so two requests can't both read
 * the same snapshot and overwrite each other (lost updates).
 */
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  locks.set(
    key,
    run.catch(() => undefined),
  );
  return run;
}

/**
 * Reads and parses a JSON file. A missing file yields the provided fallback
 * instead of throwing (the store starts empty on a fresh clone).
 */
export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw err;
  }
}

/**
 * Writes JSON atomically: the data is written to a temp file first and then
 * renamed into place. Readers therefore never observe a half-written file
 * (which previously surfaced as "Unexpected end of JSON input").
 */
export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

/**
 * Runs a read -> mutate -> write cycle under a per-file lock. The mutator
 * receives the current contents and returns the next contents.
 */
export function mutateJson<T>(
  filePath: string,
  fallback: T,
  mutate: (current: T) => T | Promise<T>,
): Promise<T> {
  return withLock(filePath, async () => {
    const current = await readJson(filePath, fallback);
    const next = await mutate(current);
    await writeJson(filePath, next);
    return next;
  });
}
