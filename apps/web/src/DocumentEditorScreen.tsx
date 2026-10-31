import { useState, useEffect, useRef } from "react";
import { TiptapEditor } from "./TiptapEditor";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type DocumentContent = {
  id: string;
  content: Record<string, unknown>;
  contentVersion: number;
  contentSchemaVersion: number;
  wordCount: number;
  updatedAt: string;
};

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error?.message ?? "Request failed.");
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return body;
}

export function DocumentEditorScreen({
  documentId,
  onBack,
}: {
  documentId: string;
  onBack: () => void;
}) {
  const [document, setDocument] = useState<DocumentContent | null>(null);
  const [content, setContent] = useState<Record<string, unknown>>({ type: "doc", content: [] });
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "unsaved" | "error" | "conflict"
  >("saved");
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<Array<Record<string, unknown>>>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const selectedRevision = revisions.find((revision) => revision.id === selectedRevisionId) ?? null;
  const saveTimer = useRef<number | null>(null);
  const contentRef = useRef(content);
  const documentRef = useRef<DocumentContent | null>(document);
  const saveRequestId = useRef(0);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  async function loadRevisions() {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const body = await request(`/api/v1/documents/${documentId}/revisions`);
      setRevisions(body.data.revisions ?? []);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Unable to load revision history.");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function loadDocument() {
    setIsLoading(true);
    setError(null);
    try {
      const body = await request(`/api/v1/documents/${documentId}/content`);
      setDocument(body.document);
      setContent(body.document.content ?? { type: "doc", content: [] });
      setIsDirty(false);
      setSaveStatus("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load document.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveDocument(
    nextContent: Record<string, unknown>,
    currentDocument: DocumentContent,
  ) {
    const requestId = ++saveRequestId.current;
    setSaveStatus("saving");
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      try {
        const response = await request(`/api/v1/documents/${documentId}/content`, {
          method: "PUT",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({
            contentVersion: currentDocument.contentVersion,
            contentSchemaVersion: currentDocument.contentSchemaVersion,
            content: nextContent,
          }),
        });

        if (requestId !== saveRequestId.current) return;
        setDocument((current) =>
          current
            ? {
                ...current,
                contentVersion: response.document.contentVersion,
                contentSchemaVersion: response.document.contentSchemaVersion,
                wordCount: response.document.wordCount,
                updatedAt: response.document.updatedAt,
              }
            : current,
        );
        setIsDirty(false);
        setSaveStatus("saved");
        setError(null);
        return;
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        if (status === 409) {
          if (requestId !== saveRequestId.current) return;
          try {
            const latest = await request(`/api/v1/documents/${documentId}/content`);
            if (requestId !== saveRequestId.current) return;
            setDocument((current) =>
              current
                ? {
                    ...current,
                    contentVersion: latest.document.contentVersion,
                    contentSchemaVersion: latest.document.contentSchemaVersion,
                  }
                : current,
            );
          } catch {
            // Keep the local draft even if refreshing version metadata fails.
          }
          if (requestId !== saveRequestId.current) return;
          setIsDirty(true);
          setSaveStatus("conflict");
          setError("This document changed elsewhere. Your unsaved changes are preserved.");
          return;
        }

        if (attempt >= 3 || status) {
          if (requestId !== saveRequestId.current) return;
          setSaveStatus("error");
          setError(err instanceof Error ? err.message : "Unable to save document.");
          return;
        }
      }

      await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
    }
  }
  useEffect(() => {
    void loadDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  useEffect(() => {
    if (!document || !isDirty) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveDocument(content, document);
    }, 800);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, document, isDirty]);

  useEffect(() => {
    return () => {
      const currentDocument = documentRef.current;
      const currentContent = contentRef.current;
      if (currentDocument && isDirty) {
        void saveDocument(currentContent, currentDocument);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  function handleEditorChange(nextContent: Record<string, unknown>) {
    setContent(nextContent);
    setIsDirty(true);
    setSaveStatus("unsaved");
  }

  if (isLoading) {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Loading document…</h1>
        </section>
      </main>
    );
  }

  if (error && !document) {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Document</h1>
          <p className="registration-error" role="alert">
            {error}
          </p>
          <button type="button" onClick={() => void loadDocument()}>
            Try again
          </button>
          <button type="button" onClick={onBack}>
            Back
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-screen">
      <section className="registration-card" style={{ width: "min(100%, 56rem)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Document</h1>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span>
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved"
                  : saveStatus === "unsaved"
                    ? "Unsaved changes"
                    : saveStatus === "conflict"
                      ? "Conflict detected"
                      : "Save failed"}
            </span>
            {saveStatus === "conflict" ? (
              <button type="button" onClick={() => void loadDocument()}>
                Reload server version
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setShowHistory((value) => !value);
                if (!showHistory) void loadRevisions();
              }}
            >
              {showHistory ? "Hide history" : "History"}
            </button>
            <button type="button" onClick={onBack}>
              Back to Binder
            </button>
          </div>
        </div>
        {error ? (
          <p className="registration-error" role="alert">
            {error}
          </p>
        ) : null}
        {showHistory ? (
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <h2>Revision history</h2>
            {isHistoryLoading ? <p>Loading history…</p> : null}
            {historyError ? (
              <p className="registration-error" role="alert">
                {historyError}
              </p>
            ) : null}
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
              <li style={{ fontWeight: selectedRevisionId === null ? 700 : 400 }}>
                <button type="button" onClick={() => setSelectedRevisionId(null)}>
                  Current document
                </button>
              </li>
              {revisions.map((revision) => (
                <li
                  key={String(revision.id)}
                  style={{ fontWeight: selectedRevisionId === revision.id ? 700 : 400 }}
                >
                  <button type="button" onClick={() => setSelectedRevisionId(String(revision.id))}>
                    {String(revision.createdAt)} · v{String(revision.documentVersion)} ·{" "}
                    {String(revision.wordCount)} words
                  </button>
                </li>
              ))}
            </ul>
            {selectedRevision ? (
              <div>
                <p>Historical content preview (read-only)</p>
                <TiptapEditor
                  content={selectedRevision.content as Record<string, unknown>}
                  editable={false}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Restore the revision from ${String(selectedRevision.createdAt)}?`,
                      )
                    )
                      return;
                    try {
                      await request(
                        `/api/v1/documents/${documentId}/revisions/${String(selectedRevision.id)}/restore`,
                        {
                          method: "POST",
                          headers: { "Idempotency-Key": crypto.randomUUID() },
                          body: JSON.stringify({ contentVersion: document?.contentVersion }),
                        },
                      );
                      await loadDocument();
                      await loadRevisions();
                      setSelectedRevisionId(null);
                      setError(null);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Unable to restore revision.");
                    }
                  }}
                >
                  Restore this version
                </button>
              </div>
            ) : (
              <p>Current document is selected.</p>
            )}
          </section>
        ) : null}
        <TiptapEditor content={content} onChange={handleEditorChange} />
      </section>
    </main>
  );
}
