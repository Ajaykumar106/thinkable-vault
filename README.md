# Thinkable Desktop

Thinkable is a desktop-first AI engineering mentor. Its core loop is: understand a local project, make a safe change, then explain the reasoning and trade-offs behind it.

## Run locally

1. Copy `.env.example` to `.env` if you have a hosted Thinkable API. Without it, the app uses a local demo planner so the core workflow remains explorable.
2. Run `pnpm install`.
3. Run `pnpm dev`.

## Architecture

- `src/domain` contains the shared Project Intelligence contracts and deterministic local intelligence services.
- `src/desktop` owns filesystem access, persistence, patching, command execution, and the narrow Electron IPC boundary.
- `src/renderer` is the React workspace. It has no Node or direct filesystem access.
- `api` contains a deployable, provider-neutral Vercel handler. Production credentials live only there.

Raw project files are never synced as a workspace copy. The UI only sends explicit intelligence evidence and source slices for the active AI request.
