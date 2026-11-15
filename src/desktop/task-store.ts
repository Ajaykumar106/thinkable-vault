import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentActivity, AgentTask, PatchProposal } from "../domain/contracts";

export interface StoredTask extends AgentTask { activities: AgentActivity[]; undoPatches: PatchProposal[]; }

export class TaskStore {
  constructor(private readonly directory: string) {}
  private path(taskId: string) { return join(this.directory, `${taskId}.json`); }
  async save(task: StoredTask) { await mkdir(this.directory, { recursive: true }); await writeFile(this.path(task.id), JSON.stringify(task, null, 2), "utf8"); }
  async load(taskId: string) { try { return JSON.parse(await readFile(this.path(taskId), "utf8")) as StoredTask; } catch { return undefined; } }
}
