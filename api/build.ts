import { askOpenAi, buildRequestSchema, modelInstructions } from "./_gateway";

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = buildRequestSchema.parse(await request.json());
    const result = await askOpenAi(modelInstructions("build"), body);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Build planning failed." }, { status: 400 });
  }
}
