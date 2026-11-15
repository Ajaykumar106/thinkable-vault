import type { AgentToolCall, AgentToolResult, ExecutionRequest, PatchProposal } from "../domain/contracts";
import { patchProposalSchema } from "../domain/contracts";
import { WorkspaceService } from "./workspace-service";

export function requiresApproval(call: AgentToolCall) {
  if (call.tool === "delete_file") return "Deleting files requires your approval.";
  if (call.tool === "apply_patch") {
    const patch = patchProposalSchema.safeParse(call.input.patch);
    if (!patch.success) return "The proposed patch is invalid.";
    if (patch.data.operations.some((operation) => operation.type === "delete")) return "This patch deletes files and requires your approval.";
  }
  if (call.tool === "run_command") return undefined;
  return undefined;
}

export class AgentToolExecutor {
  constructor(private readonly workspace: WorkspaceService) {}

  async execute(workspacePath: string, call: AgentToolCall, approved: boolean, signal?: AbortSignal): Promise<AgentToolResult> {
    try {
      if (call.tool === "list_files") {
        const items = await this.workspace.listProjectFiles(workspacePath, typeof call.input.directory === "string" ? call.input.directory : "");
        return this.ok(call, JSON.stringify(items));
      }
      if (call.tool === "read_file") {
        const path = this.requireString(call.input.path, "path");
        return this.ok(call, await this.workspace.readProjectFile(workspacePath, path));
      }
      if (call.tool === "search_code") {
        const query = this.requireString(call.input.query, "query");
        const directory = typeof call.input.directory === "string" ? call.input.directory : "";
        return this.ok(call, JSON.stringify(await this.workspace.searchProjectCode(workspacePath, query, directory)));
      }
      if (call.tool === "git_status") return this.command(workspacePath, call, "git status --short", "Inspect the current repository status.", true, signal);
      if (call.tool === "git_diff") return this.command(workspacePath, call, "git diff --", "Inspect uncommitted local changes.", true, signal);
      if (call.tool === "run_command") {
        const command = this.requireString(call.input.command, "command");
        return this.command(workspacePath, call, command, call.rationale, approved, signal);
      }
      if (call.tool === "create_file") {
        const path = this.requireString(call.input.path, "path");
        const content = this.requireString(call.input.content, "content");
        return this.apply(workspacePath, call, { id: call.id, title: `Create ${path}`, rationale: call.rationale, affectedNodeIds: [], operations: [{ type: "create", path, content }] });
      }
      if (call.tool === "delete_file") {
        if (!approved) return this.pending(call, "Deleting a file requires approval.");
        const path = this.requireString(call.input.path, "path");
        return this.apply(workspacePath, call, { id: call.id, title: `Delete ${path}`, rationale: call.rationale, affectedNodeIds: [], operations: [{ type: "delete", path }] });
      }
      if (call.tool === "apply_patch") {
        const patch = patchProposalSchema.parse(call.input.patch);
        if (patch.operations.some((operation) => operation.type === "delete") && !approved) return this.pending(call, "A patch that deletes files requires approval.");
        return this.apply(workspacePath, call, patch);
      }
      return this.error(call, "Unsupported tool.");
    } catch (error) { return this.error(call, error instanceof Error ? error.message : "Tool failed."); }
  }

  private async command(workspacePath: string, call: AgentToolCall, command: string, rationale: string, approved: boolean, signal?: AbortSignal) {
    const request: ExecutionRequest = { id: call.id, command, cwd: workspacePath, rationale };
    const execution = await this.workspace.runCommand(workspacePath, request, approved, signal);
    return { ...this.ok(call, [execution.stdout, execution.stderr].filter(Boolean).join("\n").slice(0, 32_000)), execution, requiresApproval: execution.policy === "approval-required" && execution.status === "blocked" };
  }
  private async apply(workspacePath: string, call: AgentToolCall, patch: PatchProposal) {
    const result = await this.workspace.applyPatch(workspacePath, patch);
    return { ...this.ok(call, `Applied ${patch.operations.length} file operation(s).`), patch: result.inversePatch, files: patch.operations.map((operation) => operation.path) };
  }
  private ok(call: AgentToolCall, output: string): AgentToolResult { return { callId: call.id, tool: call.tool, ok: true, output: output.slice(0, 32_000) }; }
  private pending(call: AgentToolCall, output: string): AgentToolResult { return { ...this.ok(call, output), ok: false, requiresApproval: true }; }
  private error(call: AgentToolCall, output: string): AgentToolResult { return { ...this.ok(call, output), ok: false }; }
  private requireString(value: unknown, name: string) { if (typeof value !== "string" || !value) throw new Error(`${name} must be a non-empty string.`); return value; }
}
