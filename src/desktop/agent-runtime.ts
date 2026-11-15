import type { AgentActivity, AgentDecision, AgentRuntimeEvent, AgentTask, AgentToolCall, AgentToolResult, PatchProposal } from "../domain/contracts";
import { newId } from "../domain/contracts";
import { AgentToolExecutor } from "./agent-tools";
import type { AgentGateway } from "./agent-gateway";
import { TaskStore, type StoredTask } from "./task-store";
import { WorkspaceService } from "./workspace-service";

interface LiveTask { task: StoredTask; controller: AbortController; approvals: Map<string, (approved: boolean) => void>; results: AgentToolResult[]; }

export class AgentRuntime {
  private live = new Map<string, LiveTask>();
  private readonly tools: AgentToolExecutor;

  constructor(private readonly workspace: WorkspaceService, private readonly gateway: AgentGateway, private readonly store: TaskStore, private readonly onEvent: (event: AgentRuntimeEvent) => void) {
    this.tools = new AgentToolExecutor(workspace);
  }

  async start(workspacePath: string, intent: string) {
    if (!this.workspace.isTrusted(workspacePath)) throw new Error("Trust the workspace before starting an agent task.");
    const task: StoredTask = { id: newId("task"), workspacePath, intent, status: "running", startedAt: new Date().toISOString(), plan: [], changedFiles: [], activities: [], undoPatches: [] };
    const live: LiveTask = { task, controller: new AbortController(), approvals: new Map(), results: [] };
    this.live.set(task.id, live);
    await this.store.save(task);
    void this.run(live);
    return task;
  }

  stop(taskId: string) {
    const live = this.live.get(taskId);
    if (!live) return;
    live.controller.abort();
    for (const resolve of live.approvals.values()) resolve(false);
    live.approvals.clear();
    live.task.status = "stopped";
    live.task.finishedAt = new Date().toISOString();
    this.emit(live, "error", "Task stopped", "The agent was stopped by the user.");
    void this.finish(live);
  }

  approve(taskId: string, callId: string, approved: boolean) {
    const live = this.live.get(taskId);
    const resolve = live?.approvals.get(callId);
    if (live && resolve) { live.approvals.delete(callId); live.task.status = "running"; resolve(approved); }
  }

  async undo(taskId: string) {
    const live = this.live.get(taskId);
    const stored = live?.task ?? await this.store.load(taskId);
    if (!stored?.undoPatches.length) throw new Error("There are no reversible changes for this task.");
    for (const inverse of [...stored.undoPatches].reverse()) await this.workspace.applyPatch(stored.workspacePath, inverse);
    stored.undoPatches = [];
    stored.changedFiles = [];
    stored.summary = "Changes from this task were reverted.";
    await this.store.save(stored);
    if (live) this.emit(live, "tool-result", "Changes reverted", "The inverse patches were applied to the workspace.");
    return stored;
  }

  private async run(live: LiveTask) {
    try {
      const intelligence = (await this.workspace.scan(live.task.workspacePath)).intelligence;
      this.emit(live, "thinking", "Understanding the repository", "Using the saved project map and retrieving only the files needed for this task.");
      let repairs = 0;
      for (let turn = 0; turn < 16 && !live.controller.signal.aborted; turn++) {
        const decision = await this.gateway.next({ task: live.task, intelligence, results: live.results.slice(-12) }, live.controller.signal);
        await this.handleDecision(live, decision);
        if (live.controller.signal.aborted) return;
        if (decision.final) {
          const validation = await this.validate(live);
          if (validation.failed && repairs < 2) {
            repairs += 1;
            this.emit(live, "repair", "Validation found an issue", validation.output);
            const repair = await this.gateway.next({ task: live.task, intelligence, results: live.results.slice(-12), validationFailure: validation.output }, live.controller.signal);
            await this.handleDecision(live, repair);
            if (repair.final && !repair.toolCalls.length) continue;
            continue;
          }
          live.task.status = validation.failed ? "failed" : "completed";
          live.task.summary = decision.final.summary;
          live.task.validation = validation.output || decision.final.validation;
          this.emit(live, "final", validation.failed ? "Task completed with validation failures" : "Task completed", `${decision.final.summary}\n${live.task.validation}`);
          await this.finish(live);
          return;
        }
      }
      if (!live.controller.signal.aborted) {
        live.task.status = "failed";
        live.task.summary = "The agent reached its safety limit before completing the task.";
        this.emit(live, "error", "Agent stopped at safety limit", "The task used the maximum number of reasoning/tool turns. Review the activity and retry with a narrower request.");
        await this.finish(live);
      }
    } catch (error) {
      if (live.controller.signal.aborted) return;
      live.task.status = "failed";
      live.task.summary = error instanceof Error ? error.message : "The agent failed.";
      this.emit(live, "error", "Agent task failed", live.task.summary);
      await this.finish(live);
    }
  }

  private async handleDecision(live: LiveTask, decision: AgentDecision) {
    if (decision.message) this.emit(live, "thinking", "Agent update", decision.message);
    if (decision.plan?.length) { live.task.plan = decision.plan; this.emit(live, "plan", "Implementation plan", decision.plan.map((step, index) => `${index + 1}. ${step}`).join("\n")); }
    for (const call of decision.toolCalls) {
      if (live.controller.signal.aborted) return;
      const result = await this.callTool(live, call);
      live.results.push(result);
    }
  }

  private async callTool(live: LiveTask, call: AgentToolCall) {
    this.emit(live, call.tool === "run_command" ? "validation" : "tool-call", `${call.tool.replace(/_/g, " ")}`, call.rationale, call);
    let result = await this.tools.execute(live.task.workspacePath, call, false, live.controller.signal);
    if (result.requiresApproval && !live.controller.signal.aborted) {
      const approved = await this.waitForApproval(live, call, result.output);
      if (!approved) result = { ...result, ok: false, requiresApproval: false, output: "Permission was declined by the user." };
      else result = await this.tools.execute(live.task.workspacePath, call, true, live.controller.signal);
    }
    if (result.patch) live.task.undoPatches.push(result.patch);
    if (result.files) live.task.changedFiles = [...new Set([...live.task.changedFiles, ...result.files])];
    this.emit(live, "tool-result", result.ok ? `${call.tool.replace(/_/g, " ")} completed` : `${call.tool.replace(/_/g, " ")} needs attention`, result.output, call, result);
    return result;
  }

  private async validate(live: LiveTask) {
    if (!live.task.changedFiles.length) return { failed: false, output: "No workspace files changed; validation was not required." };
    const commands = await this.workspace.validationCommands(live.task.workspacePath);
    if (!commands.length) return { failed: false, output: "No project typecheck, lint, test, or build scripts were available." };
    const outputs: string[] = [];
    for (const command of commands) {
      const call: AgentToolCall = { id: newId("validate"), tool: "run_command", input: { command }, rationale: "Validate the agent's change using this repository's configured script." };
      const result = await this.callTool(live, call);
      live.results.push(result);
      outputs.push(`${command}: ${result.ok && result.execution?.status === "success" ? "passed" : "failed"}\n${result.output}`);
      if (!result.ok || result.execution?.status !== "success") return { failed: true, output: outputs.join("\n\n") };
    }
    return { failed: false, output: outputs.join("\n\n") };
  }

  private waitForApproval(live: LiveTask, call: AgentToolCall, reason: string) {
    live.task.status = "waiting-permission";
    this.emit(live, "permission", "Approval required", `${reason}\n\n${call.rationale}`, call);
    return new Promise<boolean>((resolve) => live.approvals.set(call.id, resolve));
  }

  private emit(live: LiveTask, kind: AgentActivity["kind"], title: string, detail: string, toolCall?: AgentToolCall, toolResult?: AgentToolResult) {
    const activity: AgentActivity = { id: newId("activity"), taskId: live.task.id, kind, title, detail: detail.slice(0, 32_000), toolCall, toolResult, createdAt: new Date().toISOString() };
    live.task.activities.push(activity);
    void this.store.save(live.task);
    this.onEvent({ task: this.publicTask(live.task), activity });
  }

  private publicTask(task: StoredTask): AgentTask { const { activities: _activities, undoPatches: _undoPatches, ...plain } = task; return plain; }
  private async finish(live: LiveTask) { live.task.finishedAt ??= new Date().toISOString(); await this.store.save(live.task); this.live.delete(live.task.id); }
}
