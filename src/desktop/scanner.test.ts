import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanProject } from "./scanner";

describe("project scanner", () => {
  it("creates an evidence-backed map from a local project", async () => {
    const folder = await mkdtemp(join(tmpdir(), "thinkable-scan-"));
    await mkdir(join(folder, "src"));
    await writeFile(join(folder, "package.json"), JSON.stringify({ name: "sample", dependencies: { react: "19" }, scripts: { build: "vite build" } }));
    await writeFile(join(folder, "src", "main.ts"), "export function start() { return 'ready'; }");
    const scan = await scanProject(folder);
    expect(scan.intelligence.stack).toContain("React");
    expect(scan.intelligence.nodes.some((node) => node.kind === "entry-point")).toBe(true);
    expect(scan.intelligence.evidence.every((evidence) => evidence.verified)).toBe(true);
  });
});
