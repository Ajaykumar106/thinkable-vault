import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectIntelligence } from "../domain/contracts";

export class IntelligenceStore {
  constructor(private readonly directory: string) {}

  private fileFor(workspacePath: string) {
    const key = createHash("sha256").update(workspacePath).digest("hex");
    return join(this.directory, `${key}.json`);
  }

  async load(workspacePath: string): Promise<ProjectIntelligence | undefined> {
    try {
      return JSON.parse(await readFile(this.fileFor(workspacePath), "utf8")) as ProjectIntelligence;
    } catch {
      return undefined;
    }
  }

  async save(intelligence: ProjectIntelligence) {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.fileFor(intelligence.workspacePath), JSON.stringify(intelligence, null, 2), "utf8");
  }
}
