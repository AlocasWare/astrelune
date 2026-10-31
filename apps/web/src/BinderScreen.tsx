import { useState, useEffect, type FormEvent } from "react";
import * as validation from "@astrelune/validation";
import { BinderTree } from "./Binder";

type BinderDocument = {
  id: string;
  title: string;
  kind: "FOLDER" | "CHAPTER" | "SCENE" | "NOTE" | "RESEARCH";
  parentId: string | null;
  position: number;
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

export function BinderScreen({
  projectId,
  onBack,
  onOpenDocument,
}: {
  projectId: string;
  onBack: () => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const [documents, setDocuments] = useState<BinderDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newKind, setNewKind] = useState<BinderDocument["kind"]>("SCENE");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  async function loadDocuments() {
    setIsLoading(true);
    setError(null);
    try {
      const body = await request(`/api/v1/projects/${projectId}/documents`);
      setDocuments(body.data.documents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Binder.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
    }
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    const parsed = validation.createDocumentSchema.safeParse({
      title: newTitle,
      kind: newKind,
      parentId: newParentId,
      position: 0,
    });
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? "Invalid item.");
      return;
    }
    try {
      const body = await request(`/api/v1/projects/${projectId}/documents`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      setDocuments((current) => [...current, body.data.document]);
      setNewTitle("");
      setNewParentId(null);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Unable to create item.");
    }
  }

  async function handleMove(documentId: string, parentId: string | null, position?: number) {
    try {
      await request(`/api/v1/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ parentId, position }),
      });
      setDocuments((current) =>
        current.map((doc) =>
          doc.id === documentId ? { ...doc, parentId, position: position ?? doc.position } : doc,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to move item.");
    }
  }

  async function handleRename(documentId: string, title: string) {
    try {
      const parsed = validation.moveDocumentSchema.safeParse({ title });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid name.");
        return;
      }
      await request(`/api/v1/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      setDocuments((current) =>
        current.map((doc) => (doc.id === documentId ? { ...doc, title: title.trim() } : doc)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename item.");
    }
  }

  async function handleDelete(documentId: string) {
    try {
      await request(`/api/v1/documents/${documentId}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE DOCUMENT" }),
      });
      setDocuments((current) => current.filter((doc) => doc.id !== documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete item.");
    }
  }

  async function handleDuplicate(documentId: string) {
    try {
      const body = await request(`/api/v1/documents/${documentId}/duplicate`, { method: "POST" });
      setDocuments((current) => [...current, body.data.document]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to duplicate item.");
    }
  }

  if (isLoading) {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Loading Binder…</h1>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Binder</h1>
          <p className="registration-error" role="alert">
            {error}
          </p>
          <button type="button" onClick={() => void loadDocuments()}>
            Try again
          </button>
          <button type="button" onClick={onBack}>
            Back to projects
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-screen">
      <section className="registration-card" style={{ width: "min(100%, 48rem)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Binder</h1>
          <button type="button" onClick={onBack}>
            Back to projects
          </button>
        </div>

        <form onSubmit={handleCreate} style={{ display: "grid", gap: "0.75rem" }}>
          <label>
            Title
            <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
          </label>
          <label>
            Type
            <select
              value={newKind}
              onChange={(event) => setNewKind(event.target.value as BinderDocument["kind"])}
            >
              <option value="FOLDER">Folder</option>
              <option value="CHAPTER">Chapter</option>
              <option value="SCENE">Scene</option>
              <option value="NOTE">Note</option>
              <option value="RESEARCH">Research</option>
            </select>
          </label>
          <label>
            Parent
            <select
              value={newParentId ?? ""}
              onChange={(event) => setNewParentId(event.target.value || null)}
            >
              <option value="">Root</option>
              {documents
                .filter((doc) => doc.kind === "FOLDER" || doc.kind === "CHAPTER")
                .map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
            </select>
          </label>
          {createError ? <p className="field-error">{createError}</p> : null}
          <button type="submit">Add item</button>
        </form>

        {contextMenu ? (
          <div
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              background: "#fff",
              border: "1px solid #d8d2c8",
              borderRadius: "0.5rem",
              padding: "0.5rem",
              display: "grid",
              gap: "0.25rem",
              zIndex: 10,
            }}
          >
            <button
              type="button"
              onClick={() => {
                const target = documents.find((doc) => doc.id === contextMenu.id);
                if (target) {
                  const next = window.prompt("Rename item", target.title);
                  if (next && next.trim()) void handleRename(target.id, next.trim());
                }
                setContextMenu(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                void handleDuplicate(contextMenu.id);
                setContextMenu(null);
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                void handleMove(contextMenu.id, null, 0);
                setContextMenu(null);
              }}
            >
              Move to root
            </button>
            <button
              type="button"
              onClick={() => {
                setDeletingId(contextMenu.id);
                setContextMenu(null);
              }}
            >
              Delete
            </button>
          </div>
        ) : null}
        {deletingId ? (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span>Delete this item?</span>
            <button type="button" onClick={() => void handleDelete(deletingId)}>
              Confirm
            </button>
            <button type="button" onClick={() => setDeletingId(null)}>
              Cancel
            </button>
          </div>
        ) : null}
        {documents.length === 0 ? (
          <p>No Binder items yet.</p>
        ) : (
          <BinderTree
            documents={documents}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={setSelectedId}
            onToggle={(id) =>
              setExpandedIds((current) => {
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onMove={handleMove}
            onDelete={(id) => setDeletingId(id)}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onOpen={onOpenDocument}
          />
        )}
      </section>
    </main>
  );
}
