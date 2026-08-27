import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { compareLeaderboardEntries, normalizeLeaderboardEntry } from "../src/storage.js";

export class LeaderboardStore {
  constructor(file) {
    this.file = file;
    this.queue = Promise.resolve();
  }

  async read(chapter = null) {
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8"));
      if (!Array.isArray(parsed)) return [];
      const entries = parsed.map(normalizeLeaderboardEntry).sort(compareLeaderboardEntries);
      return chapter === null ? entries : entries.filter((entry) => entry.chapter === chapter);
    } catch (error) {
      if (error?.code === "ENOENT" || error instanceof SyntaxError) return [];
      throw error;
    }
  }

  async submit(candidate) {
    const operation = this.queue.then(async () => {
      const entry = normalizeLeaderboardEntry(candidate);
      const entries = [...await this.read(), entry].sort(compareLeaderboardEntries);
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(entries, null, 2), "utf8");
      await rename(temporary, this.file);
      const chapterEntries = entries.filter((candidate) => candidate.chapter === entry.chapter);
      return { entry, rank: chapterEntries.indexOf(entry) + 1, entries: chapterEntries };
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
