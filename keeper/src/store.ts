// Durable copy of the keeper's session, so a restart or a new deployment does not forget a vault that
// already holds tokens. One JSON file, written atomically; bigint values are tagged to survive JSON.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VERSION = 1;

const replacer = (_k: string, v: unknown) => (typeof v === "bigint" ? { $big: v.toString() } : v);
const reviver = (_k: string, v: unknown) =>
  v && typeof v === "object" && "$big" in v && typeof (v as { $big: unknown }).$big === "string"
    ? BigInt((v as { $big: string }).$big)
    : v;

export type PersistedState = Record<string, unknown> & { version: typeof VERSION };

export class SessionStore {
  private readonly file: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, "session.json");
  }

  /** Throws when the data directory cannot be written and read back (volume missing or read-only). */
  assertWritable(): void {
    const probe = `${this.file}.probe`;
    writeFileSync(probe, "ok", { mode: 0o600 });
    if (readFileSync(probe, "utf8") !== "ok") throw new Error("KEEPER_DATA_DIR cannot be read back");
    unlinkSync(probe);
  }

  /** The saved state, or null when there is none or it is unreadable (an unreadable file is kept as a backup). */
  load(): PersistedState | null {
    if (!existsSync(this.file)) return null;
    try {
      const data = JSON.parse(readFileSync(this.file, "utf8"), reviver) as PersistedState;
      if (data?.version === VERSION) return data;
    } catch { /* falls through to the backup */ }
    this.backup("unreadable");
    return null;
  }

  /** Returns false (after logging) when the file could not be written. */
  save(data: Omit<PersistedState, "version">): boolean {
    try {
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify({ version: VERSION, ...data }, replacer), { mode: 0o600 });
      renameSync(tmp, this.file);
      chmodSync(this.file, 0o600);
      return true;
    } catch (e) {
      console.error(`Keeper could not save its session: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  /** Keeps a copy of the current file next to it (used before a saved session is dropped). */
  backup(reason: string): void {
    try {
      if (existsSync(this.file)) copyFileSync(this.file, `${this.file}.${reason}-${Date.now()}.bak`);
    } catch { /* best effort */ }
  }
}
