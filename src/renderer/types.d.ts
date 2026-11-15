import type { CommandAssessment } from "../domain/command-policy";
import type { ExecutionRequest, PatchProposal, ProjectSnapshot } from "../domain/contracts";

declare global {
  interface Window {
    thinkable: {
      openProject(): Promise<ProjectSnapshot | undefined>;
      scanProject(workspacePath: string): Promise<ProjectSnapshot>;
      setTrust(workspacePath: string, trusted: boolean): Promise<void>;
      applyPatch(workspacePath: string, patch: PatchProposal): Promise<{ intelligence: ProjectSnapshot["intelligence"]; inversePatch: PatchProposal }>;
      assessCommand(request: ExecutionRequest): Promise<CommandAssessment>;
      runCommand(workspacePath: string, request: ExecutionRequest, approved: boolean): Promise<import("../domain/contracts").ExecutionResult>;
      readProjectFile(workspacePath: string, relativePath: string): Promise<string>;
      startAgent(workspacePath: string, intent: string): Promise<import("../domain/contracts").AgentTask>;
      stopAgent(taskId: string): Promise<void>;
      approveAgent(taskId: string, callId: string, approved: boolean): Promise<void>;
      undoAgent(taskId: string): Promise<import("../domain/contracts").AgentTask>;
      onAgentEvent(listener: (event: import("../domain/contracts").AgentRuntimeEvent) => void): () => void;
    };
  }
}

export {};
