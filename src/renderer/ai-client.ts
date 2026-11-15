import type { AgentTask, ChangePlan, ExplanationRequest, ExplanationResponse, ProjectIntelligence } from "../domain/contracts";
import { explainLocally } from "../domain/explanations";

function planId() { return `plan-${crypto.randomUUID()}`; }

function safeSlug(goal: string) {
  return goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "next-step";
}

export async function createBuildPlan(intelligence: ProjectIntelligence, goal: string): Promise<ChangePlan> {
  const baseUrl = import.meta.env.VITE_THINKABLE_API_URL;
  if (baseUrl) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/build`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal, intelligence })
    });
    if (!response.ok) throw new Error("Thinkable could not create a build plan.");
    return response.json() as Promise<ChangePlan>;
  }
  const focused = intelligence.nodes.filter((node) => node.kind === "component" || node.kind === "entry-point").slice(0, 3);
  const slug = safeSlug(goal);
  return {
    id: planId(),
    goal,
    summary: `Local planning preview: Thinkable will document the requested change and its relationship to the current project map. Configure VITE_THINKABLE_API_URL to generate code-aware implementation patches through the hosted gateway.`,
    steps: [
      `Review ${focused.map((node) => node.label).join(", ") || "the available project structure"}.`,
      "Record the intent, expected behaviour, and affected architecture relationships.",
      "Apply the proposal and refresh the shared project understanding."
    ],
    affectedNodeIds: focused.map((node) => node.id),
    patch: {
      id: `patch-${crypto.randomUUID()}`,
      title: `Document: ${goal}`,
      rationale: "The local fallback intentionally makes a transparent documentation-only change; production patches come from the hosted, structured AI gateway.",
      affectedNodeIds: focused.map((node) => node.id),
      operations: [{
        type: "create",
        path: `thinkable-notes/${slug}.md`,
        content: `# ${goal}\n\n## Intent\n${goal}\n\n## Project context\n${intelligence.summary}\n\n## Affected areas\n${focused.map((node) => `- ${node.label}: ${node.description}`).join("\n") || "- No source components were detected."}\n`
      }]
    }
  };
}

export async function requestExplanation(intelligence: ProjectIntelligence, request: ExplanationRequest, task?: AgentTask): Promise<ExplanationResponse> {
  const baseUrl = import.meta.env.VITE_THINKABLE_API_URL;
  if (baseUrl) {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/explain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intelligence, request, task }) });
    if (!response.ok) throw new Error("Thinkable could not create that explanation.");
    return response.json() as Promise<ExplanationResponse>;
  }
  const explanation = explainLocally(intelligence, request);
  if (task?.changedFiles.length) explanation.body += ` In the latest agent task, Thinkable changed ${task.changedFiles.join(", ")} to address “${task.intent}”. ${task.validation ?? ""}`;
  return explanation;
}
