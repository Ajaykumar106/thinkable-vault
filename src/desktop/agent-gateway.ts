import type { AgentDecision, AgentTask, AgentToolResult, ProjectIntelligence } from "../domain/contracts";

export interface AgentGateway {
  next(input: { task: AgentTask; intelligence: ProjectIntelligence; results: AgentToolResult[]; validationFailure?: string }, signal?: AbortSignal): Promise<AgentDecision>;
}

export class RemoteAgentGateway implements AgentGateway {
  constructor(private readonly baseUrl = process.env.THINKABLE_API_URL) {}
  async next(input: { task: AgentTask; intelligence: ProjectIntelligence; results: AgentToolResult[]; validationFailure?: string }, signal?: AbortSignal): Promise<AgentDecision> {
    if (!this.baseUrl) return this.localFallback(input);
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/agent`, { method: "POST", signal, headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    if (!response.ok) throw new Error(`Agent gateway failed: ${response.status}`);
    return response.json() as Promise<AgentDecision>;
  }
  private localFallback(input: { task: AgentTask; intelligence: ProjectIntelligence; results: AgentToolResult[] }): AgentDecision {
    if (!input.results.length) return { message: "Inspecting the repository before planning a change.", plan: ["Inspect the project structure", "Identify the smallest safe implementation path", "Validate after changes"], toolCalls: [{ id: `tool-${crypto.randomUUID()}`, tool: "list_files", input: { directory: "" }, rationale: "Understand the local repository layout before making changes." }] };
    return { message: "A hosted model gateway is required to generate and repair code changes. The local runtime completed a safe repository inspection.", toolCalls: [], final: { summary: "Repository inspection completed. Configure THINKABLE_API_URL in the desktop environment to enable autonomous code generation.", changedFiles: [], validation: "No changes were made, so validation was not required.", learnings: [input.intelligence.summary] } };
  }
}
