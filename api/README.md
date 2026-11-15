# Thinkable AI gateway

Deploy this folder to Vercel as the hosted AI boundary. The desktop sends structured Project Intelligence and explicit source evidence; it never exposes an OpenAI key.

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. Add Supabase JWT verification before public deployment and configure the Electron `thinkable://auth/callback` redirect in Supabase OAuth settings.

The local app intentionally uses a transparent fallback planner when `VITE_THINKABLE_API_URL` is absent.
