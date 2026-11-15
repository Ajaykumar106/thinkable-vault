import type { ExecutionRequest } from "./contracts";

export type CommandPolicy = "auto" | "approval-required" | "blocked";

export interface CommandAssessment {
  policy: CommandPolicy;
  reason: string;
  executable?: string;
  args?: string[];
}

const shellSyntax = /[;&|><`$()\n\r]/;
const approvedScripts = new Set(["test", "lint", "build", "format"]);
const packageManagers = new Set(["npm", "pnpm", "yarn", "bun"]);

export function assessCommand(request: ExecutionRequest): CommandAssessment {
  const command = request.command.trim();
  if (!command) return { policy: "blocked", reason: "A command is required." };
  if (shellSyntax.test(command)) return { policy: "approval-required", reason: "Shell syntax is never run automatically." };

  const [executable, ...args] = command.split(/\s+/);
  if (["rm", "del", "rmdir", "Remove-Item", "sudo", "chmod", "chown", "curl", "wget"].includes(executable)) {
    return { policy: "approval-required", reason: "This command can remove data, elevate access, or change the system." };
  }
  if (executable === "git") {
    const safe = ["status", "diff", "log", "show"].includes(args[0] ?? "");
    return safe
      ? { policy: "auto", reason: "Read-only Git inspection is allowed after workspace trust.", executable, args }
      : { policy: "approval-required", reason: "Git mutations require approval.", executable, args };
  }
  if (packageManagers.has(executable) && args[0] === "run" && approvedScripts.has(args[1] ?? "")) {
    return { policy: "auto", reason: "Approved project validation scripts may run automatically.", executable, args };
  }
  if (packageManagers.has(executable) && ["test", "lint", "build"].includes(args[0] ?? "")) {
    return { policy: "auto", reason: "Approved project validation commands may run automatically.", executable, args };
  }
  if (packageManagers.has(executable) && ["install", "add", "remove", "update", "exec"].includes(args[0] ?? "")) {
    return { policy: "approval-required", reason: "Dependency changes require approval.", executable, args };
  }
  return { policy: "approval-required", reason: "Only explicitly allowlisted project commands run automatically.", executable, args };
}
