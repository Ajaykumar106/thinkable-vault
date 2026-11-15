import { askOpenAi, explainRequestSchema, modelInstructions } from "./_gateway";

const format = {
  type: "json_schema",
  json_schema: {
    name: "thinkable_explanation",
    strict: true,
    schema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" }, evidenceIds: { type: "array", items: { type: "string" } }, alternatives: { type: "array", items: { type: "object", properties: { option: { type: "string" }, tradeoff: { type: "string" } }, required: ["option", "tradeoff"], additionalProperties: false } } }, required: ["title", "body", "evidenceIds"], additionalProperties: false }
  }
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = explainRequestSchema.parse(await request.json());
    const result = await askOpenAi(modelInstructions("explain"), body, format);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Explanation failed." }, { status: 400 });
  }
}
