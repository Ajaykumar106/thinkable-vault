import { useEffect, useMemo, useState } from "react";
import type { AgentActivity, AgentTask, ChangePlan, EvidenceReference, ExecutionRequest, ExplanationResponse, ProjectSnapshot } from "../domain/contracts";
import { createBuildPlan, requestExplanation } from "./ai-client";

type Panel = "understand" | "build" | "learn" | "details";

function ActionBar({ label, evidenceIds, onExplain, onCode }: { label: string; evidenceIds: string[]; onExplain: (variant: "why" | "simple" | "alternatives" | "code") => void; onCode: () => void }) {
  return <div className="action-bar">
    <button onClick={() => onExplain("why")}>Why?</button>
    <button onClick={() => onExplain("simple")}>Explain simpler</button>
    <button onClick={() => onExplain("alternatives")}>Show alternatives</button>
    <button onClick={() => { onExplain("code"); onCode(); }}>Show me the code</button>
  </div>;
}

function EvidencePill({ evidence, openCode }: { evidence: EvidenceReference; openCode: (path?: string) => void }) {
  return <button className={`evidence ${evidence.verified ? "" : "inferred"}`} onClick={() => openCode(evidence.path)} title={evidence.excerpt}>{evidence.verified ? "Verified" : "Inference"} · {evidence.label}</button>;
}

export function App() {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot>();
  const [panel, setPanel] = useState<Panel>("understand");
  const [selectedId, setSelectedId] = useState<string>();
  const [buildGoal, setBuildGoal] = useState("");
  const [plan, setPlan] = useState<ChangePlan>();
  const [explanation, setExplanation] = useState<ExplanationResponse>();
  const [code, setCode] = useState<{ path: string; content: string }>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [execution, setExecution] = useState<string>();
  const [agentTask, setAgentTask] = useState<AgentTask>();
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const intelligence = snapshot?.intelligence;
  const selected = intelligence?.nodes.find((node) => node.id === selectedId) ?? intelligence?.nodes[0];
  const selectedEvidence = useMemo(() => intelligence?.evidence.filter((item) => selected?.evidenceIds.includes(item.id)) ?? [], [intelligence, selected]);

  useEffect(() => window.thinkable?.onAgentEvent((event) => {
    setAgentTask(event.task);
    setActivities((current) => current.some((item) => item.id === event.activity.id) ? current : [...current, event.activity]);
    if (event.activity.toolResult?.files?.length) void window.thinkable.scanProject(event.task.workspacePath).then(setSnapshot);
  }), []);

  async function openProject() {
    const project = await window.thinkable.openProject();
    if (project) { setSnapshot(project); setPanel("understand"); setSelectedId(project.intelligence.nodes[0]?.id); setNotice("Project understanding is ready. Trust the workspace before Thinkable can act locally."); }
  }
  async function trust() {
    if (!snapshot) return;
    await window.thinkable.setTrust(snapshot.workspacePath, true);
    setSnapshot({ ...snapshot, trusted: true });
    setNotice("Workspace trusted. Changes and allowed validation commands remain visible and reversible.");
  }
  async function refresh() {
    if (!snapshot) return;
    const next = await window.thinkable.scanProject(snapshot.workspacePath);
    setSnapshot(next);
    setNotice("Project understanding refreshed from the local workspace.");
  }
  async function openCode(path?: string) {
    if (!snapshot || !path || path === snapshot.workspacePath) return;
    try { setCode({ path, content: await window.thinkable.readProjectFile(snapshot.workspacePath, path) }); setPanel("details"); } catch { setNotice(`Could not open ${path}.`); }
  }
  async function explain(variant: "why" | "simple" | "alternatives" | "code") {
    if (!intelligence || !selected) return;
    setBusy(true);
    try { setExplanation(await requestExplanation(intelligence, { variant, subjectId: selected.id, subjectLabel: selected.label, evidenceIds: selected.evidenceIds }, agentTask)); setPanel("learn"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Explanation failed."); }
    finally { setBusy(false); }
  }
  async function createPlan() {
    if (!intelligence || !buildGoal.trim()) return;
    setBusy(true);
    try { setPlan(await createBuildPlan(intelligence, buildGoal.trim())); setPanel("build"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Build planning failed."); }
    finally { setBusy(false); }
  }
  async function applyPlan() {
    if (!snapshot || !plan?.patch) return;
    if (!snapshot.trusted) { setNotice("Trust the workspace before applying a proposal."); return; }
    setBusy(true);
    try {
      const next = await window.thinkable.applyPatch(snapshot.workspacePath, plan.patch);
      setSnapshot({ ...snapshot, intelligence: next.intelligence });
      setNotice(`Applied “${plan.patch.title}”. Project Understanding was refreshed.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "The patch could not be applied."); }
    finally { setBusy(false); }
  }
  async function runVerification() {
    if (!snapshot) return;
    const request: ExecutionRequest = { id: `run-${crypto.randomUUID()}`, command: "npm run build", cwd: snapshot.workspacePath, rationale: "Verify the latest applied change with the project's build script." };
    const assessment = await window.thinkable.assessCommand(request);
    if (assessment.policy === "approval-required" && !window.confirm(`${assessment.reason}\n\nRun: ${request.command}?`)) return;
    setBusy(true);
    const result = await window.thinkable.runCommand(snapshot.workspacePath, request, assessment.policy === "approval-required");
    setExecution(`${result.status.toUpperCase()} · ${result.command}\n${result.stdout || result.stderr || "No output."}`);
    setBusy(false);
  }
  async function startAgent() {
    if (!snapshot || !buildGoal.trim()) return;
    try {
      setActivities([]);
      setAgentTask(await window.thinkable.startAgent(snapshot.workspacePath, buildGoal.trim()));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not start the agent."); }
  }
  async function decidePermission(callId: string, approved: boolean) {
    if (!agentTask) return;
    await window.thinkable.approveAgent(agentTask.id, callId, approved);
    setNotice(approved ? "Permission granted. The agent is continuing." : "Permission declined. The agent will revise its approach.");
  }
  async function undoAgent() {
    if (!agentTask) return;
    try { setAgentTask(await window.thinkable.undoAgent(agentTask.id)); setSnapshot(await window.thinkable.scanProject(snapshot!.workspacePath)); setNotice("The agent's reversible changes were undone."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Changes could not be reverted."); }
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">T</span><span>thinkable</span></div>
      <button className="open-project" onClick={openProject}>+ Open project</button>
      <nav>
        {(["understand", "build", "learn", "details"] as Panel[]).map((item) => <button key={item} className={panel === item ? "active" : ""} onClick={() => setPanel(item)}><span>{item === "understand" ? "◎" : item === "build" ? "↗" : item === "learn" ? "◌" : "⌘"}</span>{item === "understand" ? "Project Understanding" : item[0].toUpperCase() + item.slice(1)}</button>)}
      </nav>
      <div className="sidebar-footer">{snapshot ? <><strong>{snapshot.intelligence.stack.join(" · ")}</strong><span>{snapshot.trusted ? "● Trusted workspace" : "○ Read-only workspace"}</span></> : <span>Open a local project to begin.</span>}</div>
    </aside>

    <section className="workspace">
      {!snapshot ? <Welcome openProject={openProject} /> : <>
        <header className="topbar"><div><span className="eyebrow">LOCAL WORKSPACE</span><h1>{snapshot.intelligence.nodes[0]?.label}</h1><p>{snapshot.intelligence.summary}</p></div><div className="header-actions"><button onClick={refresh}>Refresh understanding</button>{!snapshot.trusted && <button className="primary" onClick={trust}>Trust workspace</button>}</div></header>
        {notice && <div className="notice">{notice}<button onClick={() => setNotice(undefined)}>×</button></div>}
        {panel === "understand" && intelligence && <Understanding intelligence={intelligence} selectedId={selected?.id} setSelectedId={setSelectedId} selectedEvidence={selectedEvidence} onExplain={explain} openCode={openCode} />}
        {panel === "build" && intelligence && <Build goal={buildGoal} setGoal={setBuildGoal} trusted={snapshot.trusted} busy={busy} task={agentTask} activities={activities} onStart={startAgent} onStop={() => agentTask && window.thinkable.stopAgent(agentTask.id)} onPermission={decidePermission} onUndo={undoAgent} onRetry={startAgent} />}
        {panel === "learn" && intelligence && <Learn explanation={explanation} selected={selected} evidence={selectedEvidence} agentTask={agentTask} activities={activities} onExplain={explain} openCode={openCode} />}
        {panel === "details" && intelligence && <Details snapshot={snapshot} code={code} setCode={setCode} openCode={openCode} selected={selected} />}
      </>}
      {busy && <div className="loading">Thinkable is working…</div>}
    </section>
  </main>;
}

function Welcome({ openProject }: { openProject: () => void }) {
  return <section className="welcome"><div className="orb">✦</div><span className="eyebrow">THINKABLE DESKTOP</span><h1>Build with a clearer picture.</h1><p>Thinkable maps how your project works before helping you change it. Every recommendation stays connected to its evidence, code, and trade-offs.</p><button className="primary large" onClick={openProject}>Open a local project</button><div className="welcome-points"><span>◎ Understand architecture</span><span>↗ Make safe changes</span><span>◌ Learn the why</span></div></section>;
}

function Understanding({ intelligence, selectedId, setSelectedId, selectedEvidence, onExplain, openCode }: { intelligence: NonNullable<ProjectSnapshot["intelligence"]>; selectedId?: string; setSelectedId: (id: string) => void; selectedEvidence: EvidenceReference[]; onExplain: (v: "why" | "simple" | "alternatives" | "code") => void; openCode: (path?: string) => void }) {
  const selected = intelligence.nodes.find((node) => node.id === selectedId) ?? intelligence.nodes[0];
  return <div className="content-grid"><section className="overview"><div className="section-heading"><div><span className="eyebrow">PROJECT MAP</span><h2>How this project fits together</h2></div><span className="chip">{intelligence.nodes.length} mapped entities</span></div><div className="stack-row">{intelligence.stack.map((item) => <span key={item} className="chip accent">{item}</span>)}</div><div className="graph">{intelligence.nodes.slice(0, 14).map((node) => <button key={node.id} className={`graph-node ${node.id === selected?.id ? "selected" : ""} ${node.kind}`} onClick={() => setSelectedId(node.id)}><span>{node.kind.replace("-", " ")}</span><strong>{node.label}</strong><small>{node.description}</small></button>)}</div><div className="relationship-list"><h3>Architecture relationships</h3>{intelligence.relationships.slice(0, 6).map((relationship) => <div key={relationship.id}><span>{intelligence.nodes.find((node) => node.id === relationship.from)?.label}</span><b>→</b><span>{intelligence.nodes.find((node) => node.id === relationship.to)?.label}</span><small>{relationship.description}</small></div>)}</div></section><aside className="inspector"><span className="eyebrow">SELECTED CONCEPT</span><h2>{selected?.label}</h2><p>{selected?.description}</p><ActionBar label={selected?.label ?? "project"} evidenceIds={selected?.evidenceIds ?? []} onExplain={onExplain} onCode={() => openCode(selectedEvidence[0]?.path)} /><h3>Evidence</h3>{selectedEvidence.map((item) => <EvidencePill key={item.id} evidence={item} openCode={openCode} />)}<h3>Recent understanding</h3>{intelligence.timeline.slice(-4).reverse().map((event) => <div className="timeline-event" key={event.id}><span className={event.type}></span><div><strong>{event.title}</strong><p>{event.detail}</p></div></div>)}</aside></div>;
}

function Build({ goal, setGoal, trusted, busy, task, activities, onStart, onStop, onPermission, onUndo, onRetry }: { goal: string; setGoal: (value: string) => void; trusted: boolean; busy: boolean; task?: AgentTask; activities: AgentActivity[]; onStart: () => void; onStop: () => void; onPermission: (callId: string, approved: boolean) => void; onUndo: () => void; onRetry: () => void }) {
  const active = task?.status === "running" || task?.status === "waiting-permission";
  return <section className="build-view agent-build"><div className="section-heading"><div><span className="eyebrow">BUILD AGENT</span><h2>Give Thinkable a goal. It will inspect, plan, act, validate, and explain.</h2></div><span className={`chip ${trusted ? "good" : "warning"}`}>{trusted ? "Trusted agent workspace" : "Read-only until trusted"}</span></div><div className="goal-box"><label htmlFor="goal">What should Thinkable change?</label><textarea id="goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="For example: Add a filter to the projects list, update the empty state, and cover it with tests." /><div className="composer-footer"><span>The agent retrieves only relevant files and will request approval for sensitive actions.</span><button className="primary" onClick={onStart} disabled={!goal.trim() || !trusted || active || busy}>{active ? "Agent running" : "Start agent"}</button></div></div>{task && <div className="agent-task"><div className="task-header"><div><span className="eyebrow">TASK ACTIVITY</span><h2>{task.intent}</h2><p className={`status ${task.status}`}>{task.status.replace(/-/g, " ")}</p></div><div className="task-controls">{active && <button className="danger" onClick={onStop}>Stop</button>}{(task.status === "failed" || task.status === "stopped") && <button onClick={onRetry}>Retry</button>}{task.changedFiles.length > 0 && <button onClick={onUndo}>Undo changes</button>}</div></div>{task.plan.length > 0 && <div className="agent-plan"><strong>Plan</strong><ol>{task.plan.map((step) => <li key={step}>{step}</li>)}</ol></div>}<div className="activity-stream">{activities.map((activity) => <ActivityCard key={activity.id} activity={activity} task={task} onPermission={onPermission} />)}</div>{task.changedFiles.length > 0 && <div className="changed-files"><strong>Changed files</strong>{task.changedFiles.map((file) => <span key={file}>{file}</span>)}</div>}{task.summary && <div className="agent-summary"><strong>Final summary</strong><p>{task.summary}</p><pre>{task.validation}</pre></div>}</div>}</section>;
}

function ActivityCard({ activity, task, onPermission }: { activity: AgentActivity; task: AgentTask; onPermission: (callId: string, approved: boolean) => void }) {
  const call = activity.toolCall;
  return <article className={`activity-card ${activity.kind}`}><div className="activity-icon">{activity.kind === "tool-call" ? "↗" : activity.kind === "tool-result" ? "✓" : activity.kind === "permission" ? "!" : activity.kind === "error" ? "×" : "·"}</div><div><span className="eyebrow">{activity.kind.replace(/-/g, " ")}</span><h3>{activity.title}</h3><pre>{activity.detail}</pre>{call && <div className="tool-meta"><code>{call.tool}</code>{call.tool === "run_command" && <code>{String(call.input.command ?? "")}</code>}</div>}{activity.kind === "permission" && call && task.status === "waiting-permission" && <div className="permission-actions"><button className="primary" onClick={() => onPermission(call.id, true)}>Allow once</button><button onClick={() => onPermission(call.id, false)}>Decline</button></div>}</div></article>;
}

function Learn({ explanation, selected, evidence, agentTask, activities, onExplain, openCode }: { explanation?: ExplanationResponse; selected?: NonNullable<ProjectSnapshot["intelligence"]>["nodes"][number]; evidence: EvidenceReference[]; agentTask?: AgentTask; activities: AgentActivity[]; onExplain: (v: "why" | "simple" | "alternatives" | "code") => void; openCode: (path?: string) => void }) {
  return <section className="learn-view"><div className="section-heading"><div><span className="eyebrow">LEARN MODE</span><h2>Make the project make sense.</h2><p>Select any project concept, relationship, proposal, or result and ask Thinkable to unpack it.</p></div></div>{agentTask && <div className="learn-history"><span className="eyebrow">LATEST AGENT WORK</span><h3>{agentTask.intent}</h3><p>{agentTask.summary ?? "The task is still in progress. Learn follows its evidence and tool activity as it develops."}</p><div>{agentTask.changedFiles.map((file) => <span className="chip accent" key={file}>{file}</span>)}</div><small>{activities.filter((item) => item.taskId === agentTask.id).length} recorded agent events · {agentTask.validation ?? "Validation pending"}</small></div>}{selected && <div className="learn-focus"><span className="chip accent">Currently exploring</span><h2>{selected.label}</h2><ActionBar label={selected.label} evidenceIds={selected.evidenceIds} onExplain={onExplain} onCode={() => openCode(evidence[0]?.path)} /></div>}{explanation ? <article className="explanation"><span className="eyebrow">CONTEXTUAL EXPLANATION</span><h2>{explanation.title}</h2><p>{explanation.body}</p>{explanation.alternatives && <div className="alternatives">{explanation.alternatives.map((alternative) => <div key={alternative.option}><strong>{alternative.option}</strong><p>{alternative.tradeoff}</p></div>)}</div>}<div className="evidence-row">{evidence.map((item) => <EvidencePill key={item.id} evidence={item} openCode={openCode} />)}</div></article> : <div className="empty-state">Start with “Why?” from Project Understanding or Build. The explanation will stay tied to source evidence, so it is inspectable rather than magic.</div>}</section>;
}

function Details({ snapshot, code, setCode, openCode, selected }: { snapshot: ProjectSnapshot; code?: { path: string; content: string }; setCode: (value: { path: string; content: string }) => void; openCode: (path?: string) => void; selected?: NonNullable<ProjectSnapshot["intelligence"]>["nodes"][number] }) {
  return <section className="details-view"><div className="file-list"><span className="eyebrow">PROJECT FILES</span>{snapshot.files.slice(0, 120).map((path) => <button key={path} onClick={() => openCode(path)}>{path}</button>)}</div><div className="code-panel"><div className="code-header"><div><span className="eyebrow">CODE & DETAILS</span><h2>{code?.path ?? selected?.label ?? "Select a file"}</h2></div>{snapshot.gitAvailable && <span className="chip good">Git detected</span>}</div>{code ? <pre>{code.content}</pre> : <div className="empty-state">Code is available when you need precision, but Thinkable begins with meaning: use Project Understanding to select a concept first.</div>}</div></section>;
}
