import { z } from "zod";

export const evidenceKinds = ["file", "symbol", "config", "command", "user", "inference"] as const;
export type EvidenceKind = (typeof evidenceKinds)[number];

export interface EvidenceReference {
  id: string;
  kind: EvidenceKind;
  label: string;
  path?: string;
  symbol?: string;
  excerpt?: string;
  verified: boolean;
}

export interface ArchitectureNode {
  id: string;
  label: string;
  kind: "project" | "entry-point" | "component" | "dependency" | "concept";
  description: string;
  evidenceIds: string[];
  inferred?: boolean;
}

export interface ArchitectureRelationship {
  id: string;
  from: string;
  to: string;
  kind: "contains" | "imports" | "uses" | "depends-on";
  description: string;
  evidenceIds: string[];
  inferred?: boolean;
}

export interface DecisionRecord {
  id: string;
  title: string;
  rationale: string;
  alternatives: string[];
  tradeoff: string;
  evidenceIds: string[];
  source: "observed" | "ai" | "user";
  createdAt: string;
}

export interface ChangeEvent {
  id: string;
  type: "observed" | "proposal" | "accepted" | "execution" | "verification";
  title: string;
  detail: string;
  evidenceIds: string[];
  createdAt: string;
}

export interface ProjectIntelligence {
  version: 1;
  workspacePath: string;
  scannedAt: string;
  summary: string;
  stack: string[];
  capabilities: string[];
  entryPoints: string[];
  evidence: EvidenceReference[];
  nodes: ArchitectureNode[];
  relationships: ArchitectureRelationship[];
  decisions: DecisionRecord[];
  timeline: ChangeEvent[];
}

export interface ProjectSnapshot {
  workspacePath: string;
  intelligence: ProjectIntelligence;
  trusted: boolean;
  files: string[];
  gitAvailable: boolean;
}

export interface PatchOperation {
  type: "create" | "update" | "delete";
  path: string;
  content?: string;
  previousContent?: string;
}

export interface PatchProposal {
  id: string;
  title: string;
  rationale: string;
  affectedNodeIds: string[];
  operations: PatchOperation[];
}

export interface ChangePlan {
  id: string;
  goal: string;
  summary: string;
  steps: string[];
  affectedNodeIds: string[];
  patch?: PatchProposal;
  command?: ExecutionRequest;
}

export interface ExecutionRequest {
  id: string;
  command: string;
  cwd: string;
  rationale: string;
}

export interface ExecutionResult {
  requestId: string;
  command: string;
  status: "success" | "failed" | "blocked";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  policy: "auto" | "approval-required" | "blocked";
  completedAt: string;
}

export type ExplanationVariant = "why" | "simple" | "alternatives" | "code";

export interface ExplanationRequest {
  variant: ExplanationVariant;
  subjectId: string;
  subjectLabel: string;
  evidenceIds: string[];
}

export interface ExplanationResponse {
  title: string;
  body: string;
  evidenceIds: string[];
  alternatives?: Array<{ option: string; tradeoff: string }>;
}

export const patchProposalSchema = z.object({
  id: z.string(),
  title: z.string(),
  rationale: z.string(),
  affectedNodeIds: z.array(z.string()),
  operations: z.array(z.object({
    type: z.enum(["create", "update", "delete"]),
    path: z.string().min(1),
    content: z.string().optional(),
    previousContent: z.string().optional()
  }))
});

export const explanationRequestSchema = z.object({
  variant: z.enum(["why", "simple", "alternatives", "code"]),
  subjectId: z.string(),
  subjectLabel: z.string(),
  evidenceIds: z.array(z.string())
});

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const agentToolNames = [
  "list_files", "read_file", "search_code", "apply_patch", "create_file", "delete_file", "git_status", "git_diff", "run_command"
] as const;
export type AgentToolName = (typeof agentToolNames)[number];

export interface AgentToolCall {
  id: string;
  tool: AgentToolName;
  input: Record<string, unknown>;
  rationale: string;
}

export interface AgentToolResult {
  callId: string;
  tool: AgentToolName;
  ok: boolean;
  output: string;
  files?: string[];
  patch?: PatchProposal;
  execution?: ExecutionResult;
  requiresApproval?: boolean;
}

export interface AgentDecision {
  message?: string;
  plan?: string[];
  toolCalls: AgentToolCall[];
  final?: { summary: string; changedFiles: string[]; validation: string; learnings: string[] };
}

export interface AgentTask {
  id: string;
  workspacePath: string;
  intent: string;
  status: "running" | "waiting-permission" | "completed" | "failed" | "stopped";
  startedAt: string;
  finishedAt?: string;
  plan: string[];
  changedFiles: string[];
  summary?: string;
  validation?: string;
  undoPatch?: PatchProposal;
}

export type AgentActivityKind = "thinking" | "plan" | "tool-call" | "tool-result" | "permission" | "validation" | "repair" | "final" | "error";
export interface AgentActivity {
  id: string;
  taskId: string;
  kind: AgentActivityKind;
  title: string;
  detail: string;
  toolCall?: AgentToolCall;
  toolResult?: AgentToolResult;
  createdAt: string;
}

export interface AgentRuntimeEvent {
  task: AgentTask;
  activity: AgentActivity;
}
