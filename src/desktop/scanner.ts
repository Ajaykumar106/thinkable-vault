import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type {
  ArchitectureNode,
  ArchitectureRelationship,
  EvidenceReference,
  ProjectIntelligence
} from "../domain/contracts";

const ignoredDirectories = new Set([".git", "node_modules", "dist", "build", ".next", "coverage", ".cache", ".idea", ".vscode"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".cs"]);
const manifestNames = new Set(["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "requirements.txt"]);

export interface ScanResult {
  intelligence: ProjectIntelligence;
  files: string[];
}

async function walk(root: string, directory = root, entries: string[] = []): Promise<string[]> {
  if (entries.length >= 500) return entries;
  const children = await readdir(directory, { withFileTypes: true });
  for (const child of children) {
    if (entries.length >= 500) break;
    if (child.isDirectory()) {
      if (!ignoredDirectories.has(child.name)) await walk(root, join(directory, child.name), entries);
    } else if (child.isFile()) {
      const fullPath = join(directory, child.name);
      if ((await stat(fullPath)).size <= 1_000_000) entries.push(relative(root, fullPath).split(sep).join("/"));
    }
  }
  return entries;
}

function idFor(kind: string, value: string) {
  return `${kind}:${value.split(sep).join("/").replace(/[^a-zA-Z0-9._:/-]/g, "-")}`;
}

function stackFromManifest(manifest: Record<string, unknown> | undefined, files: string[]) {
  const dependencies = { ...(manifest?.dependencies as Record<string, string> | undefined), ...(manifest?.devDependencies as Record<string, string> | undefined) };
  const stack: string[] = [];
  if (dependencies.react) stack.push("React");
  if (dependencies.next) stack.push("Next.js");
  if (dependencies.electron) stack.push("Electron");
  if (dependencies.vite) stack.push("Vite");
  if (files.some((file) => file.endsWith(".py"))) stack.push("Python");
  if (files.some((file) => file.endsWith(".go"))) stack.push("Go");
  if (files.some((file) => file.endsWith(".rs"))) stack.push("Rust");
  return stack.length ? stack : ["Unidentified stack"];
}

export async function scanProject(workspacePath: string, previous?: ProjectIntelligence): Promise<ScanResult> {
  const files = await walk(workspacePath);
  const evidence: EvidenceReference[] = [];
  const nodes: ArchitectureNode[] = [];
  const relationships: ArchitectureRelationship[] = [];
  const projectId = "project:root";
  let manifest: Record<string, unknown> | undefined;
  const packagePath = files.find((file) => file === "package.json");
  if (packagePath) {
    try { manifest = JSON.parse(await readFile(join(workspacePath, packagePath), "utf8")); } catch { /* invalid manifests stay visible as a file */ }
  }

  const projectName = typeof manifest?.name === "string" ? manifest.name : workspacePath.split(/[\\/]/).pop() ?? "this project";
  evidence.push({ id: "evidence:workspace", kind: "file", label: "Workspace root", path: workspacePath, verified: true });
  nodes.push({ id: projectId, label: projectName, kind: "project", description: `The root of ${projectName}. Thinkable derives this map from the local workspace rather than a generic prompt.`, evidenceIds: ["evidence:workspace"] });

  for (const file of files.filter((entry) => manifestNames.has(entry.split("/").pop() ?? ""))) {
    const evidenceId = idFor("evidence", file);
    evidence.push({ id: evidenceId, kind: "config", label: file, path: file, verified: true });
    const nodeId = idFor("concept", file);
    nodes.push({ id: nodeId, label: file, kind: "concept", description: `${file} describes a key project configuration or dependency boundary.`, evidenceIds: [evidenceId] });
    relationships.push({ id: idFor("contains", file), from: projectId, to: nodeId, kind: "contains", description: `${projectName} is configured by ${file}.`, evidenceIds: [evidenceId] });
  }

  const sourceFiles = files.filter((file) => sourceExtensions.has(file.slice(file.lastIndexOf(".")))).slice(0, 80);
  for (const file of sourceFiles) {
    const content = await readFile(join(workspacePath, file), "utf8").catch(() => "");
    const evidenceId = idFor("evidence", file);
    evidence.push({ id: evidenceId, kind: "file", label: file, path: file, excerpt: content.slice(0, 240), verified: true });
    const isEntry = /(^|\/)(main|index|app|server)\.[^.]+$/.test(file) || (typeof manifest?.main === "string" && manifest.main === file);
    const nodeId = idFor(isEntry ? "entry" : "component", file);
    const exported = [...content.matchAll(/export\s+(?:default\s+)?(?:function|class|const)\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]);
    nodes.push({
      id: nodeId,
      label: file.split("/").pop() ?? file,
      kind: isEntry ? "entry-point" : "component",
      description: isEntry
        ? `${file} appears to be an application entry point.`
        : exported.length ? `${file} exposes ${exported.join(", ")} and participates in the project implementation.` : `${file} is a source module in the project.`,
      evidenceIds: [evidenceId]
    });
    relationships.push({ id: idFor("contains", file), from: projectId, to: nodeId, kind: "contains", description: `${projectName} contains ${file}.`, evidenceIds: [evidenceId] });
  }

  const dependencies = { ...(manifest?.dependencies as Record<string, string> | undefined), ...(manifest?.devDependencies as Record<string, string> | undefined) };
  for (const dependency of Object.keys(dependencies).slice(0, 30)) {
    const evidenceId = "evidence:package.json";
    const nodeId = idFor("dependency", dependency);
    nodes.push({ id: nodeId, label: dependency, kind: "dependency", description: `${dependency} is declared as an external project dependency.`, evidenceIds: [evidenceId] });
    relationships.push({ id: idFor("depends", dependency), from: projectId, to: nodeId, kind: "depends-on", description: `${projectName} depends on ${dependency}.`, evidenceIds: [evidenceId] });
  }

  const stack = stackFromManifest(manifest, files);
  const entryPoints = nodes.filter((node) => node.kind === "entry-point").map((node) => node.label);
  const capabilities = [
    manifest?.scripts ? "Project scripts are available for validation and verification." : "No package scripts were identified.",
    sourceFiles.length ? `${sourceFiles.length} source files were indexed for this project map.` : "No supported source files were identified yet."
  ];
  const scanEvent = { id: `event:scan:${Date.now()}`, type: "observed" as const, title: "Project understanding refreshed", detail: `Indexed ${files.length} files and mapped ${nodes.length} project entities.`, evidenceIds: evidence.slice(0, 8).map((item) => item.id), createdAt: new Date().toISOString() };
  return {
    files,
    intelligence: {
      version: 1,
      workspacePath,
      scannedAt: new Date().toISOString(),
      summary: `${projectName} is a ${stack.join(" + ")} project. Thinkable found ${sourceFiles.length} source modules and ${Object.keys(dependencies).length} declared dependencies.`,
      stack,
      capabilities,
      entryPoints,
      evidence,
      nodes,
      relationships,
      decisions: previous?.decisions ?? [],
      timeline: [...(previous?.timeline ?? []).slice(-40), scanEvent]
    }
  };
}
