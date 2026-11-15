import { describe, expect, it } from "vitest";
import { assessCommand } from "./command-policy";

const request = (command: string) => ({ id: "test", command, cwd: "C:/project", rationale: "test" });

describe("command policy", () => {
  it("allows constrained validation commands after trust", () => {
    expect(assessCommand(request("npm run build")).policy).toBe("auto");
    expect(assessCommand(request("git status")).policy).toBe("auto");
  });
  it("requires explicit approval for sensitive actions", () => {
    expect(assessCommand(request("npm install react")).policy).toBe("approval-required");
    expect(assessCommand(request("git commit -m test")).policy).toBe("approval-required");
    expect(assessCommand(request("npm run build; rm -rf .")).policy).toBe("approval-required");
  });
});
