import { useState, useEffect, type FormEvent } from "react";
import * as validation from "@astrelune/validation";

type Project = {
  id: string;
  title: string;
  description?: string | null;
  status: "ACTIVE" | "ARCHIVED";
  ownerId: string;
};

type GoalProgress = {
  periodStart: string;
  periodEnd: string;
  wordsAdded: number;
  targetWords: number;
  status: string;
};

type ActivitySummary = {
  count: number;
  totalWords: number;
  latestDate: string | null;
};

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Request failed.");
  }
  return body;
}

export function ProjectsScreen({
  onOpenBinder,
  onLogout,
}: {
  onOpenBinder: (projectId: string) => void;
  onLogout?: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [activeGoalProgress, setActiveGoalProgress] = useState<GoalProgress | null>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalPeriod, setGoalPeriod] = useState<"DAILY" | "WEEKLY">("DAILY");
  const [goalTarget, setGoalTarget] = useState("500");
  const [goalStartsAt, setGoalStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [goalEndsAt, setGoalEndsAt] = useState("");
  const [goalProjectId, setGoalProjectId] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);

  async function loadProjects() {
    setIsLoading(true);
    setError(null);
    try {
      const body = await request("/api/v1/projects");
      setProjects(body.data.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load projects.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadGoals() {
    try {
      const body = await request("/api/v1/goals");
      const nextGoals = body.data.goals ?? [];
      const active = nextGoals[0];
      if (active) {
        const progressBody = await request(`/api/v1/goals/${active.id}/progress`);
        setActiveGoalProgress(progressBody.data.progress ?? null);
      } else {
        setActiveGoalProgress(null);
      }
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : "Unable to load goals.");
    }
  }

  async function loadActivity() {
    try {
      const body = await request("/api/v1/activity");
      const items = body.data.activity ?? [];
      const totalWords = items.reduce(
        (sum: number, item: { wordsAdded?: number }) => sum + (item.wordsAdded ?? 0),
        0,
      );
      setActivitySummary({
        count: items.length,
        totalWords,
        latestDate: items[0]?.activityDate ?? null,
      });
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : "Unable to load activity.");
    }
  }

  async function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGoalError(null);
    const parsed = validation.createWritingGoalSchema.safeParse({
      period: goalPeriod,
      targetWords: Number(goalTarget),
      startsAt: goalStartsAt,
      endsAt: goalEndsAt || null,
      projectId: goalProjectId || null,
    });
    if (!parsed.success) {
      setGoalError(parsed.error.issues[0]?.message ?? "Invalid goal.");
      return;
    }
    setIsCreatingGoal(true);
    try {
      await request("/api/v1/goals", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      await loadGoals();
      setShowGoalForm(false);
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : "Unable to create goal.");
    } finally {
      setIsCreatingGoal(false);
    }
  }

  useEffect(() => {
    void loadProjects();
    void loadGoals();
    void loadActivity();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);

    const parsed = validation.createProjectSchema.safeParse({
      title: newTitle,
      description: newDescription || undefined,
    });
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? "Invalid project.");
      return;
    }

    setIsCreating(true);
    try {
      const body = await request("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      setProjects((current) => [body.data.project, ...current]);
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to create project.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRename(projectId: string) {
    setEditError(null);
    const previousProjects = projects;
    const parsed = validation.updateProjectSchema.safeParse({ title: editTitle });
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? "Invalid project name.");
      return;
    }

    setProjects((current) =>
      current.map((project) =>
        project.id === projectId ? { ...project, title: editTitle.trim() } : project,
      ),
    );

    try {
      const body = await request(`/api/v1/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      setProjects((current) =>
        current.map((project) => (project.id === projectId ? body.data.project : project)),
      );
      setEditingId(null);
      setEditTitle("");
    } catch (err) {
      setProjects(previousProjects);
      setEditError(err instanceof Error ? err.message : "Unable to rename project.");
    }
  }

  async function handleArchive(projectId: string) {
    const previousProjects = projects;
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, status: "ARCHIVED", archivedAt: new Date() }
          : project,
      ),
    );
    try {
      const body = await request(`/api/v1/projects/${projectId}/archive`, { method: "POST" });
      setProjects((current) =>
        current.map((project) => (project.id === projectId ? body.data.project : project)),
      );
    } catch (err) {
      setProjects(previousProjects);
      setError(err instanceof Error ? err.message : "Unable to archive project.");
    }
  }

  async function handleDelete(projectId: string) {
    const previousProjects = projects;
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setDeletingId(null);
    try {
      await request(`/api/v1/projects/${projectId}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE PROJECT" }),
      });
    } catch (err) {
      setProjects(previousProjects);
      setError(err instanceof Error ? err.message : "Unable to delete project.");
    }
  }
  if (isLoading) {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Loading projects…</h1>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Sanctuary</h1>
          <p className="registration-error" role="alert">
            {error}
          </p>
          <button type="button" onClick={() => void loadProjects()}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-screen">
      <section className="registration-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1>Sanctuary</h1>
            <p>Welcome back. Choose a project to continue writing, or create a new one.</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => (window.location.hash = "#settings")}>
              Settings
            </button>
            <button type="button" onClick={() => (window.location.hash = "#worlds")}>
              Worlds
            </button>
            <button type="button" onClick={() => setShowCreate((value) => !value)}>
              {showCreate ? "Cancel" : "New project"}
            </button>
            {onLogout ? (
              <button type="button" onClick={onLogout}>
                Log out
              </button>
            ) : null}
          </div>
        </div>

        {showCreate ? (
          <form onSubmit={handleCreate}>
            <label>
              Title
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
            </label>
            <label>
              Description
              <textarea
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
              />
            </label>
            {createError ? <p className="field-error">{createError}</p> : null}
            <button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create project"}
            </button>
          </form>
        ) : null}

        <section
          style={{
            border: "1px solid #d8d2c8",
            borderRadius: "0.5rem",
            padding: "1rem",
            display: "grid",
            gap: "0.5rem",
          }}
        >
          <h2>Writing goal</h2>
          {goalError ? <p className="field-error">{goalError}</p> : null}
          {activeGoalProgress ? (
            <div>
              <p>
                {activeGoalProgress.status}: {activeGoalProgress.wordsAdded}/
                {activeGoalProgress.targetWords} words ({activeGoalProgress.periodStart} to{" "}
                {activeGoalProgress.periodEnd})
              </p>
            </div>
          ) : (
            <p>No writing goal configured yet.</p>
          )}
          <button type="button" onClick={() => setShowGoalForm((value) => !value)}>
            {showGoalForm ? "Cancel" : "Create or update goal"}
          </button>
          {showGoalForm ? (
            <form onSubmit={handleCreateGoal}>
              <label>
                Period
                <select
                  value={goalPeriod}
                  onChange={(event) => setGoalPeriod(event.target.value as "DAILY" | "WEEKLY")}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </label>
              <label>
                Target words
                <input value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} />
              </label>
              <label>
                Starts at
                <input
                  type="date"
                  value={goalStartsAt}
                  onChange={(event) => setGoalStartsAt(event.target.value)}
                />
              </label>
              <label>
                Ends at (optional)
                <input
                  type="date"
                  value={goalEndsAt}
                  onChange={(event) => setGoalEndsAt(event.target.value)}
                />
              </label>
              <label>
                Project (optional)
                <select
                  value={goalProjectId}
                  onChange={(event) => setGoalProjectId(event.target.value)}
                >
                  <option value="">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={isCreatingGoal}>
                {isCreatingGoal ? "Saving..." : "Save goal"}
              </button>
            </form>
          ) : null}
        </section>

        <section
          style={{
            border: "1px solid #d8d2c8",
            borderRadius: "0.5rem",
            padding: "1rem",
            display: "grid",
            gap: "0.5rem",
          }}
        >
          <h2>Writing activity</h2>
          {activitySummary ? (
            <p>
              {activitySummary.count} recorded event(s), {activitySummary.totalWords} words added
              {activitySummary.latestDate ? `, latest on ${activitySummary.latestDate}` : ""}.
            </p>
          ) : (
            <p>No recorded activity yet.</p>
          )}
        </section>

        {projects.length === 0 ? (
          <p>No projects yet. Create your first project to begin.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
            {projects.map((project) => (
              <li
                key={project.id}
                style={{ border: "1px solid #d8d2c8", borderRadius: "0.5rem", padding: "1rem" }}
              >
                {editingId === project.id ? (
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                    />
                    {editError ? <p className="field-error">{editError}</p> : null}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="button" onClick={() => void handleRename(project.id)}>
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditTitle("");
                          setEditError(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <strong>{project.title}</strong>
                    {project.description ? <p>{project.description}</p> : null}
                    <span>{project.status}</span>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => onOpenBinder(project.id)}>
                        Open Binder
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(project.id);
                          setEditTitle(project.title);
                        }}
                      >
                        Rename
                      </button>
                      {project.status !== "ARCHIVED" ? (
                        <button type="button" onClick={() => void handleArchive(project.id)}>
                          Archive
                        </button>
                      ) : null}
                      <button type="button" onClick={() => setDeletingId(project.id)}>
                        Delete
                      </button>
                    </div>
                    {deletingId === project.id ? (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span>Delete this project?</span>
                        <button type="button" onClick={() => void handleDelete(project.id)}>
                          Confirm
                        </button>
                        <button type="button" onClick={() => setDeletingId(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
