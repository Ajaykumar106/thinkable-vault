import { z } from "zod";
import { configuredGateway } from "./_gateway";

const toolNames = ["list_files", "read_file", "search_code", "apply_patch", "create_file", "delete_file", "git_status", "git_diff", "run_command"] as const;
const requestSchema = z.object({
  task: z.object({ id: z.string(), intent: z.string().max(4_000), plan: z.array(z.string()), changedFiles: z.array(z.string()) }),
  intelligence: z.object({ summary: z.string(), stack: z.array(z.string()), entryPoints: z.array(z.string()), nodes: z.array(z.object({ id: z.string(), label: z.string(), kind: z.string(), description: z.string(), evidenceIds: z.array(z.string()) })).max(80), relationships: z.array(z.object({ from: z.string(), to: z.string(), kind: z.string(), description: z.string() })).max(120) }),
  results: z.array(z.object({ callId: z.string(), tool: z.enum(toolNames), ok: z.boolean(), output: z.string().max(32_000), files: z.array(z.string()).optional() })).max(12),
  validationFailure: z.string().max(32_000).optional()
});

const format = {
  type: "json_schema",
  json_schema: {
    name: "thinkable_agent_decision",
    strict: true,
    schema: {
      type: "object",
      properties: {
        message: { type: "string" }, plan: { type: "array", items: { type: "string" } },
        toolCalls: { type: "array", items: { type: "object", properties: { id: { type: "string" }, tool: { type: "string", enum: toolNames }, input: { type: "object", additionalProperties: true }, rationale: { type: "string" } }, required: ["id", "tool", "input", "rationale"], additionalProperties: false } },
        final: { type: "object", properties: { summary: { type: "string" }, changedFiles: { type: "array", items: { type: "string" } }, validation: { type: "string" }, learnings: { type: "array", items: { type: "string" } } }, required: ["summary", "changedFiles", "validation", "learnings"], additionalProperties: false }
      }, required: ["toolCalls"], additionalProperties: false
    }
  }
};

const instructions = `You are Thinkable's autonomous coding agent. Work only from the compact project intelligence and tool results provided. You are controlling tools on the user's trusted local workspace through a secure desktop runtime.

Follow this loop: inspect relevant structure and files, write a concise plan, make the smallest correct changes, inspect the diff, and finish only after the desktop runtime validates. You may make multiple tool calls per decision but do not request more than 3 at a time. Never use shell syntax in run_command. Use list_files/read_file/search_code before edits. Use apply_patch for related edits, create_file for a new file, and delete_file only when necessary. Do not request secret files. Do not claim success before validation results are supplied. When validation failure is supplied, diagnose it with tools and repair it. Return final only when the task is complete or blocked, with an honest summary.`;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = requestSchema.parse(await request.json());
    const result = await configuredGateway().complete(instructions, body, format);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Agent decision failed." }, { status: 400 });
  }
}
