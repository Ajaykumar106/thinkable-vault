import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { join } from "node:path";
import { IntelligenceStore } from "./intelligence-store";
import { WorkspaceService } from "./workspace-service";
import { AgentRuntime } from "./agent-runtime";
import { RemoteAgentGateway } from "./agent-gateway";
import { TaskStore } from "./task-store";
import { patchProposalSchema } from "../domain/contracts";
import { assessCommand } from "../domain/command-policy";
import type { ExecutionRequest } from "../domain/contracts";

const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
let window: BrowserWindow | undefined;
let workspace: WorkspaceService;
let agentRuntime: AgentRuntime;

function createWindow() {
  window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: join(import.meta.dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  if (isDevelopment) void window.loadURL(process.env.VITE_DEV_SERVER_URL!);
  else void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  workspace = new WorkspaceService(new IntelligenceStore(join(app.getPath("userData"), "intelligence")));
  agentRuntime = new AgentRuntime(
    workspace,
    new RemoteAgentGateway(),
    new TaskStore(join(app.getPath("userData"), "agent-tasks")),
    (event) => window?.webContents.send("agent:event", event)
  );
  ipcMain.handle("workspace:open", async () => {
    const selected = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (selected.canceled || !selected.filePaths[0]) return undefined;
    const workspacePath = selected.filePaths[0];
    const result = await workspace.scan(workspacePath);
    return { workspacePath, intelligence: result.intelligence, trusted: false, files: result.files, gitAvailable: await workspace.gitAvailable(workspacePath) };
  });
  ipcMain.handle("workspace:scan", async (_event, workspacePath: string) => {
    const result = await workspace.scan(workspacePath);
    return { workspacePath, intelligence: result.intelligence, trusted: workspace.isTrusted(workspacePath), files: result.files, gitAvailable: await workspace.gitAvailable(workspacePath) };
  });
  ipcMain.handle("workspace:trust", (_event, workspacePath: string, trusted: boolean) => workspace.trust(workspacePath, trusted));
  ipcMain.handle("workspace:apply-patch", async (_event, workspacePath: string, rawPatch: unknown) => {
    const patch = patchProposalSchema.parse(rawPatch);
    return workspace.applyPatch(workspacePath, patch);
  });
  ipcMain.handle("workspace:assess-command", (_event, request: ExecutionRequest) => assessCommand(request));
  ipcMain.handle("workspace:run-command", (_event, workspacePath: string, request: ExecutionRequest, approved: boolean) => workspace.runCommand(workspacePath, request, approved));
  ipcMain.handle("workspace:read-file", (_event, workspacePath: string, relativePath: string) => workspace.readProjectFile(workspacePath, relativePath));
  ipcMain.handle("agent:start", (_event, workspacePath: string, intent: string) => agentRuntime.start(workspacePath, intent));
  ipcMain.handle("agent:stop", (_event, taskId: string) => agentRuntime.stop(taskId));
  ipcMain.handle("agent:approve", (_event, taskId: string, callId: string, approved: boolean) => agentRuntime.approve(taskId, callId, approved));
  ipcMain.handle("agent:undo", (_event, taskId: string) => agentRuntime.undo(taskId));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
