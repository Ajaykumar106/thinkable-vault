import type { ExplanationRequest, ExplanationResponse, ProjectIntelligence } from "./contracts";

export function explainLocally(
  intelligence: ProjectIntelligence,
  request: ExplanationRequest
): ExplanationResponse {
  const evidence = intelligence.evidence.filter((item) => request.evidenceIds.includes(item.id));
  const location = evidence.map((item) => item.path ?? item.label).join(", ") || "the selected project evidence";
  const node = intelligence.nodes.find((item) => item.id === request.subjectId);
  const description = node?.description ?? request.subjectLabel;

  if (request.variant === "simple") {
    return { title: `Simply put: ${request.subjectLabel}`, body: `${description} It is part of the project so its job is clear and changes stay easier to reason about.`, evidenceIds: request.evidenceIds };
  }
  if (request.variant === "alternatives") {
    return {
      title: `Alternatives for ${request.subjectLabel}`,
      body: `The current project model is based on evidence from ${location}. Alternatives should be weighed against the project's existing stack and relationships.`,
      evidenceIds: request.evidenceIds,
      alternatives: [
        { option: "Keep the current approach", tradeoff: "Lowest change risk and best alignment with existing project structure." },
        { option: "Extract a separate module", tradeoff: "Improves separation when the responsibility grows, but adds another boundary to maintain." }
      ]
    };
  }
  if (request.variant === "code") {
    return { title: `Code behind ${request.subjectLabel}`, body: `The supporting implementation is located in ${location}. Open the linked evidence to inspect the exact source and configuration.`, evidenceIds: request.evidenceIds };
  }
  return { title: `Why ${request.subjectLabel}?`, body: `${description} This explanation is grounded in ${location}. Thinkable keeps that evidence attached so you can distinguish verified project facts from AI interpretation.`, evidenceIds: request.evidenceIds };
}
