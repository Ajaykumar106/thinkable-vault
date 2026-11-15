import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import type { PatchProposal, ExecutionRequest, ExecutionResult, ProjectIntelligence } from "../domain/contracts";
import { assessCommand } from "../domain/command-policy";
import { IntelligenceStore } from "./intelligence-store";
import { scanProject, type ScanResult } from "./scanner";

export class WorkspaceService {
  private trusted = new Set<string>();
  private intelligence = new Map<string, ProjectIntelligence>();

  constructor(private readonly store: IntelligenceStore) {}

  async scan(workspacePath: string): Promise<ScanResult> {
    const previous = this.intelligence.get(workspacePath) ?? await this.store.load(workspacePath);
    const result = await scanProject(workspacePath, previous);
    this.intelligence.set(workspacePath, result.intelligence);
    await this.store.save(result.intelligence);
    return result;
  }

  trust(workspacePath: string, value: boolean) {
    if (value) this.trusted.add(workspacePath);
    else this.trusted.delete(workspacePath);
  }

  isTrusted(workspacePath: string) {
    return this.trusted.has(workspacePath);
  }

  private safePath(workspacePath: string, input: string) {
    if (isAbsolute(input)) throw new Error("Patch paths must be relative to the trusted workspace.");
    const candidate = resolve(workspacePath, input);
    const outside = relative(workspacePath, candidate).startsWith(".." + sep) || relative(workspacePath, candidate) === "..";
    if (outside) throw new Error("Patch path escapes the trusted workspace.");
    return candidate;
  }

  isProtectedPath(relativePath: string) {
    const normal = relativePath.replace(/\\/g, "/").toLowerCase();
    const name = normal.split("/").pop() ?? "";
    return name === ".env" || name.startsWith(".env.") || name === "id_rsa" || name.endsWith(".pem") || name.endsWith(".key") || /(^|\/)(secrets?|credentials?|private)(\/|$)/.test(normal);
  }

  async applyPatch(workspacePath: string, patch: PatchProposal) {
    if (!this.isTrusted(workspacePath)) throw new Error("Trust this workspace before applying changes.");
    const inverse = [] as PatchProposal["operations"];
    for (const operation of patch.operations) {
      if (this.isProtectedPath(operation.path)) throw new Error("Thinkable never modifies protected secret files.");
      const filePath = this.safePath(workspacePath, operation.path);
      let previousContent: string | undefined;
      try { previousContent = await readFile(filePath, "utf8"); } catch { /* creating a new file is valid */ }
      if (operation.type === "create" && previousContent !== undefined) throw new Error(`${operation.path} already exists.`);
      if (operation.type === "update" && previousContent === undefined) throw new Error(`${operation.path} does not exist.`);
      if (operation.type === "delete" && previousContent === undefined) throw new Error(`${operation.path} does not exist.`);
      if (operation.previousContent !== undefined && previousContent !== operation.previousContent) throw new Error(`${operation.path} changed since the proposal was generated.`);

      if (operation.type === "delete") {
        await rm(filePath);
        inverse.unshift({ type: "create", path: operation.path, content: previousContent });
      } else {
        await mkdir(resolve(filePath, ".."), { recursive: true });
        await writeFile(filePath, operation.content ?? "", "utf8");
        inverse.unshift(previousContent === undefined
          ? { type: "delete", path: operation.path }
          : { type: "update", path: operation.path, content: previousContent });
      }
    }
    const next = await this.scan(workspacePath);
    next.intelligence.timeline.push({
      id: `event:accepted:${Date.now()}`,
      type: "accepted",
      title: patch.title,
      detail: patch.rationale,
      evidenceIds: [],
      createdAt: new Date().toISOString()
    });
    await this.store.save(next.intelligence);
    return { intelligence: next.intelligence, inversePatch: { ...patch, id: `${patch.id}:revert`, title: `Revert: ${patch.title}`, rationale: "Generated inverse patch.", operations: inverse } };
  }

  async runCommand(workspacePath: string, request: ExecutionRequest, approved = false, signal?: AbortSignal): Promise<ExecutionResult> {
    if (!this.isTrusted(workspacePath)) throw new Error("Trust this workspace before running commands.");
    const policy = assessCommand(request);
    if (policy.policy === "blocked") return this.result(request, "blocked", policy.policy, "", policy.reason, null);
    if (policy.policy === "approval-required" && !approved) return this.result(request, "blocked", policy.policy, "", policy.reason, null);
    if (!policy.executable || !policy.args) return this.result(request, "blocked", policy.policy, "", policy.reason, null);

    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((complete) => {
      const child = spawn(policy.executable!, policy.args!, { cwd: workspacePath, shell: false, windowsHide: true });
      let stdout = "";
      let stderr = "";
      let done = false;
      const finish = (value: { stdout: string; stderr: string; exitCode: number | null }) => { if (!done) { done = true; complete(value); } };
      const limit = (value: string) => value.slice(0, 32_000);
      const timeout = setTimeout(() => { child.kill(); finish({ stdout, stderr: `${stderr}\nCommand timed out after 60 seconds.`, exitCode: null }); }, 60_000);
      const abort = () => { child.kill(); finish({ stdout, stderr: `${stderr}\nCommand stopped by user.`, exitCode: null }); };
      signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk) => { stdout = limit(stdout + chunk.toString()); });
      child.stderr.on("data", (chunk) => { stderr = limit(stderr + chunk.toString()); });
      child.on("error", (error) => { clearTimeout(timeout); finish({ stdout, stderr: `${stderr}${error.message}`, exitCode: null }); });
      child.on("close", (exitCode) => { clearTimeout(timeout); finish({ stdout, stderr, exitCode }); });
    });
    const execution = this.result(request, result.exitCode === 0 ? "success" : "failed", policy.policy, result.stdout, result.stderr, result.exitCode);
    const intelligence = this.intelligence.get(workspacePath) ?? await this.store.load(workspacePath);
    if (intelligence) {
      intelligence.timeline.push({ id: `event:execution:${Date.now()}`, type: "execution", title: request.command, detail: execution.status === "success" ? "Command completed successfully." : "Command failed or was blocked.", evidenceIds: [], createdAt: execution.completedAt });
      await this.store.save(intelligence);
    }
    return execution;
  }

  async gitAvailable(workspacePath: string) {
    try { await access(resolve(workspacePath, ".git"), constants.F_OK); return true; } catch { return false; }
  }

  async readProjectFile(workspacePath: string, relativePath: string) {
    if (this.isProtectedPath(relativePath)) throw new Error("Protected files are never exposed to the agent.");
    const filePath = this.safePath(workspacePath, relativePath);
    const content = await readFile(filePath, "utf8");
    return content.slice(0, 100_000);
  }

  async listProjectFiles(workspacePath: string, directory = "") {
    const target = this.safePath(workspacePath, directory || ".");
    const children = await readdir(target, { withFileTypes: true });
    return children
      .filter((entry) => !["node_modules", ".git", "dist", "build", ".next"].includes(entry.name))
      .filter((entry) => !this.isProtectedPath(directory ? `${directory}/${entry.name}` : entry.name))
      .slice(0, 250)
      .map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "directory" : "file" }));
  }

  async searchProjectCode(workspacePath: string, query: string, directory = "") {
    if (!query.trim() || query.length > 200) throw new Error("Search queries must be between 1 and 200 characters.");
    const scan = await this.scan(workspacePath);
    const scoped = scan.files.filter((file) => !directory || file.startsWith(directory.replace(/\\/g, "/"))).filter((file) => !this.isProtectedPath(file));
    const needle = query.toLowerCase();
    const matches: Array<{ path: string; line: number; text: string }> = [];
    for (const file of scoped.slice(0, 200)) {
      const content = await this.readProjectFile(workspacePath, file).catch(() => "");
      content.split(/\r?\n/).forEach((line, index) => {
        if (matches.length < 100 && line.toLowerCase().includes(needle)) matches.push({ path: file, line: index + 1, text: line.slice(0, 300) });
      });
      if (matches.length >= 100) break;
    }
    return matches;
  }

  async validationCommands(workspacePath: string) {
    try {
      const manifest = JSON.parse(await readFile(this.safePath(workspacePath, "package.json"), "utf8")) as { scripts?: Record<string, string> };
      const manager = await access(this.safePath(workspacePath, "pnpm-lock.yaml")).then(() => "pnpm").catch(async () => access(this.safePath(workspacePath, "yarn.lock")).then(() => "yarn").catch(() => "npm"));
      return ["typecheck", "lint", "test", "build"].filter((script) => Boolean(manifest.scripts?.[script])).map((script) => `${manager} run ${script}`);
    } catch { return []; }
  }

  private result(request: ExecutionRequest, status: ExecutionResult["status"], policy: ExecutionResult["policy"], stdout: string, stderr: string, exitCode: number | null): ExecutionResult {
    return { requestId: request.id, command: request.command, status, stdout, stderr, exitCode, policy, completedAt: new Date().toISOString() };
  }
}
