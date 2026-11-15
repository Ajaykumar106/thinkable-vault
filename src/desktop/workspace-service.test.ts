import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IntelligenceStore } from "./intelligence-store";
import { WorkspaceService } from "./workspace-service";

describe("workspace safety tools", () => {
  it("blocks secret content and keeps changes inside a trusted workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "thinkable-workspace-"));
    await mkdir(join(root, "src"));
    await writeFile(join(root, ".env"), "SECRET=value");
    await writeFile(join(root, "src", "index.ts"), "export const answer = 42;");
    const service = new WorkspaceService(new IntelligenceStore(join(root, "store")));
    service.trust(root, true);
    await expect(service.readProjectFile(root, ".env")).rejects.toThrow("Protected");
    expect((await service.listProjectFiles(root)).some((item) => item.name === ".env")).toBe(false);
    const result = await service.applyPatch(root, { id: "patch", title: "add", rationale: "test", affectedNodeIds: [], operations: [{ type: "create", path: "src/new.ts", content: "export const safe = true;" }] });
    expect(await readFile(join(root, "src", "new.ts"), "utf8")).toContain("safe");
    await service.applyPatch(root, result.inversePatch);
    await expect(readFile(join(root, "src", "new.ts"), "utf8")).rejects.toThrow();
  });
});
