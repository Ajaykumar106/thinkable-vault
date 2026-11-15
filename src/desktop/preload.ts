import { contextBridge, ipcRenderer } from "electron";
import type { ExecutionRequest, PatchProposal } from "../domain/contracts";

contextBridge.exposeInMainWorld("thinkable", {
  openProject: () => ipcRenderer.invoke("workspace:open"),
  scanProject: (workspacePath: string) => ipcRenderer.invoke("workspace:scan", workspacePath),
  setTrust: (workspacePath: string, trusted: boolean) => ipcRenderer.invoke("workspace:trust", workspacePath, trusted),
  applyPatch: (workspacePath: string, patch: PatchProposal) => ipcRenderer.invoke("workspace:apply-patch", workspacePath, patch),
  assessCommand: (request: ExecutionRequest) => ipcRenderer.invoke("workspace:assess-command", request),
  runCommand: (workspacePath: string, request: ExecutionRequest, approved: boolean) => ipcRenderer.invoke("workspace:run-command", workspacePath, request, approved),
  readProjectFile: (workspacePath: string, relativePath: string) => ipcRenderer.invoke("workspace:read-file", workspacePath, relativePath),
  startAgent: (workspacePath: string, intent: string) => ipcRenderer.invoke("agent:start", workspacePath, intent),
  stopAgent: (taskId: string) => ipcRenderer.invoke("agent:stop", taskId),
  approveAgent: (taskId: string, callId: string, approved: boolean) => ipcRenderer.invoke("agent:approve", taskId, callId, approved),
  undoAgent: (taskId: string) => ipcRenderer.invoke("agent:undo", taskId),
  onAgentEvent: (listener: (event: import("../domain/contracts").AgentRuntimeEvent) => void) => {
    const callback = (_event: Electron.IpcRendererEvent, payload: import("../domain/contracts").AgentRuntimeEvent) => listener(payload);
    ipcRenderer.on("agent:event", callback);
    return () => ipcRenderer.removeListener("agent:event", callback);
  }
});
