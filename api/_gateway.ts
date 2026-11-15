import { z } from "zod";
import { explanationRequestSchema, patchProposalSchema } from "../src/domain/contracts";

const intelligenceSchema = z.object({
  summary: z.string(),
  stack: z.array(z.string()),
  nodes: z.array(z.object({ id: z.string(), label: z.string(), kind: z.string(), description: z.string(), evidenceIds: z.array(z.string()) })),
  relationships: z.array(z.object({ id: z.string(), from: z.string(), to: z.string(), kind: z.string(), description: z.string(), evidenceIds: z.array(z.string()) })),
  evidence: z.array(z.object({ id: z.string(), label: z.string(), kind: z.string(), path: z.string().optional(), excerpt: z.string().optional(), verified: z.boolean() }))
}).passthrough();

export const buildRequestSchema = z.object({ goal: z.string().min(3).max(2_000), intelligence: intelligenceSchema });
export const explainRequestSchema = z.object({ intelligence: intelligenceSchema, request: explanationRequestSchema });

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "thinkable_response",
    strict: true,
    schema: {
      type: "object",
      properties: {
        id: { type: "string" }, goal: { type: "string" }, summary: { type: "string" }, steps: { type: "array", items: { type: "string" } }, affectedNodeIds: { type: "array", items: { type: "string" } },
        patch: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, rationale: { type: "string" }, affectedNodeIds: { type: "array", items: { type: "string" } }, operations: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["create", "update", "delete"] }, path: { type: "string" }, content: { type: "string" }, previousContent: { type: "string" } }, required: ["type", "path"], additionalProperties: false } } }, required: ["id", "title", "rationale", "affectedNodeIds", "operations"], additionalProperties: false }
      }, required: ["id", "goal", "summary", "steps", "affectedNodeIds", "patch"], additionalProperties: false
    }
  }
};

export async function askOpenAi(instructions: string, input: unknown, format: unknown = responseFormat) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("The hosted Thinkable AI gateway is missing OPENAI_API_KEY.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", instructions, input: JSON.stringify(input), text: { format } })
  });
  if (!response.ok) throw new Error(`Model gateway failed: ${response.status}`);
  const payload = await response.json() as { output_text?: string };
  if (!payload.output_text) throw new Error("Model gateway returned no structured output.");
  return JSON.parse(payload.output_text);
}

export interface ModelGateway {
  complete(instructions: string, input: unknown, format: unknown): Promise<unknown>;
}

export class OpenAiResponsesGateway implements ModelGateway {
  complete(instructions: string, input: unknown, format: unknown) {
    return askOpenAi(instructions, input, format);
  }
}

export function configuredGateway(): ModelGateway {
  // This switch is deliberately the only provider-selection point. Add adapters here
  // without changing the desktop runtime, agent loop, or renderer.
  const provider = (process.env.THINKABLE_MODEL_PROVIDER || "openai").toLowerCase();
  if (provider === "openai") return new OpenAiResponsesGateway();
  throw new Error(`Unsupported configured model provider: ${provider}`);
}

export function modelInstructions(mode: "build" | "explain") {
  return mode === "build"
    ? "You are Thinkable's single build orchestrator. Use only supplied Project Intelligence and evidence. Return a minimal, safe implementation plan and structured patch. Never use shell commands, never invent files or evidence, and label uncertainty in the summary."
    : "You are Thinkable's learning engine. Explain only the supplied, evidence-backed Project Intelligence. Distinguish observed facts from inference. Be clear for a non-expert but technically honest.";
}

export function validPatch(raw: unknown) { return patchProposalSchema.parse(raw); }
