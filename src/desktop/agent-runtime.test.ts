import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentDecision, AgentRuntimeEvent } from "../domain/contracts";
import { AgentRuntime } from "./agent-runtime";
import type { AgentGateway } from "./agent-gateway";
import { IntelligenceStore } from "./intelligence-store";
import { TaskStore } from "./task-store";
import { WorkspaceService } from "./workspace-service";

describe("agent runtime", () => {
  it("runs multiple decision turns, applies a safe edit, and records a final audit event", async () => {
    const root = await mkdtemp(join(tmpdir(), "thinkable-agent-"));
    await writeFile(join(root, "README.md"), "# sample\n");
    const workspace = new WorkspaceService(new IntelligenceStore(join(root, "intelligence")));
    workspace.trust(root, true);
    let turns = 0;
    const gateway: AgentGateway = { next: async (): Promise<AgentDecision> => {
      turns += 1;
      if (turns === 1) return { plan: ["Create a small project note", "Validate the result"], toolCalls: [{ id: "create", tool: "create_file", input: { path: "notes.md", content: "Created by the test agent.\n" }, rationale: "Add the requested project note." }] };
      return { toolCalls: [], final: { summary: "Created the note.", changedFiles: ["notes.md"], validation: "No scripts were available.", learnings: ["The task was completed through a typed local tool."] } };
    } };
    const events: AgentRuntimeEvent[] = [];
    const done = new Promise<void>((resolve) => {
      const runtime = new AgentRuntime(workspace, gateway, new TaskStore(join(root, "tasks")), (event) => { events.push(event); if (event.activity.kind === "final") resolve(); });
      void runtime.start(root, "Create a note");
    });
    await done;
    expect(turns).toBeGreaterThan(1);
    expect(await readFile(join(root, "notes.md"), "utf8")).toContain("test agent");
    expect(events.some((event) => event.activity.kind === "tool-call")).toBe(true);
    expect(events.some((event) => event.activity.kind === "final")).toBe(true);
  });
});
