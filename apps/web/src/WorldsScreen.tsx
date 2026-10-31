import { useState, useEffect, type FormEvent } from "react";
import * as validation from "@astrelune/validation";

type World = { id: string; name: string; description?: string | null };
type WorldEntry = {
  id: string;
  worldId: string;
  name: string;
  kind: string;
  parentId: string | null;
  summary?: string | null;
};
type Relationship = {
  id: string;
  sourceEntryId: string;
  targetEntryId: string;
  relationshipType: string;
  description?: string | null;
  sourceEntry?: { id: string; name: string; kind: string };
  targetEntry?: { id: string; name: string; kind: string };
};
type DocumentLink = {
  id: string;
  documentId: string;
  worldEntryId: string;
  document?: { id: string; title: string };
};

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "Request failed.");
  return body;
}

export function WorldsScreen({
  onBack,
  onOpenDocument,
}: {
  onBack: () => void;
  onOpenDocument?: (documentId: string) => void;
}) {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [entries, setEntries] = useState<WorldEntry[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [documentLinks, setDocumentLinks] = useState<DocumentLink[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [entryFilter, setEntryFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateWorld, setShowCreateWorld] = useState(false);
  const [newWorldName, setNewWorldName] = useState("");
  const [newWorldDescription, setNewWorldDescription] = useState("");

  const [showCreateEntry, setShowCreateEntry] = useState(false);
  const [newEntryName, setNewEntryName] = useState("");
  const [newEntryKind, setNewEntryKind] = useState("CHARACTER");
  const [newEntrySummary, setNewEntrySummary] = useState("");

  const [newRelationshipType, setNewRelationshipType] = useState("");
  const [newRelationshipTargetId, setNewRelationshipTargetId] = useState("");
  const [newRelationshipDescription, setNewRelationshipDescription] = useState("");

  const [documentIdToLink, setDocumentIdToLink] = useState("");

  const [isEditingWorld, setIsEditingWorld] = useState(false);
  const [editWorldName, setEditWorldName] = useState("");
  const [editWorldDescription, setEditWorldDescription] = useState("");

  const [isEditingEntry, setIsEditingEntry] = useState(false);
  const [editEntryName, setEditEntryName] = useState("");
  const [editEntryKind, setEditEntryKind] = useState("CHARACTER");
  const [editEntrySummary, setEditEntrySummary] = useState("");

  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const [editRelationshipType, setEditRelationshipType] = useState("");
  const [editRelationshipDescription, setEditRelationshipDescription] = useState("");

  async function loadWorlds() {
    setIsLoading(true);
    setError(null);
    try {
      const body = await request("/api/v1/worlds");
      setWorlds(body.data.worlds ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load worlds.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadWorldData(worldId: string) {
    setError(null);
    try {
      const body = await request(`/api/v1/worlds/${worldId}/entries`);
      setEntries(body.data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load world data.");
    }
  }

  useEffect(() => {
    void loadWorlds();
  }, []);

  useEffect(() => {
    if (selectedWorldId) void loadWorldData(selectedWorldId);
  }, [selectedWorldId]);

  useEffect(() => {
    if (!selectedWorldId || !selectedEntryId) {
      setRelationships([]);
      setDocumentLinks([]);
      return;
    }
    void (async () => {
      try {
        const [relBody, linkBody] = await Promise.all([
          request(`/api/v1/worlds/${selectedWorldId}/relationships?entryId=${selectedEntryId}`),
          request(`/api/v1/worlds/${selectedWorldId}/entries/${selectedEntryId}/documents`),
        ]);
        setRelationships(relBody.data.relationships ?? []);
        setDocumentLinks(linkBody.data.links ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load entry details.");
      }
    })();
  }, [selectedWorldId, selectedEntryId]);

  async function handleCreateWorld(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validation.createWorldSchema.safeParse({
      name: newWorldName,
      description: newWorldDescription || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid world.");
      return;
    }
    try {
      const body = await request("/api/v1/worlds", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      setWorlds((current) => [body.data.world, ...current]);
      setShowCreateWorld(false);
      setNewWorldName("");
      setNewWorldDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create world.");
    }
  }

  async function handleDeleteWorld(worldId: string) {
    if (!window.confirm("Delete this world and all of its entries?")) return;
    try {
      await request(`/api/v1/worlds/${worldId}`, { method: "DELETE" });
      setWorlds((current) => current.filter((world) => world.id !== worldId));
      if (selectedWorldId === worldId) {
        setSelectedWorldId(null);
        setEntries([]);
        setSelectedEntryId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete world.");
    }
  }
  async function handleCreateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorldId) return;
    const parsed = validation.createWorldEntrySchema.safeParse({
      name: newEntryName,
      kind: newEntryKind,
      parentId: null,
      summary: newEntrySummary || undefined,
      content: { type: "doc", content: [] },
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid entry.");
      return;
    }
    try {
      const body = await request(`/api/v1/worlds/${selectedWorldId}/entries`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      setEntries((current) => [...current, body.data.entry]);
      setShowCreateEntry(false);
      setNewEntryName("");
      setNewEntrySummary("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create entry.");
    }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!selectedWorldId || !window.confirm("Delete this entry?")) return;
    try {
      await request(`/api/v1/worlds/${selectedWorldId}/entries/${entryId}`, { method: "DELETE" });
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      if (selectedEntryId === entryId) setSelectedEntryId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete entry.");
    }
  }

  async function handleCreateRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorldId || !selectedEntryId || !newRelationshipTargetId) return;
    const parsed = validation.createWorldEntryRelationshipSchema.safeParse({
      sourceEntryId: selectedEntryId,
      targetEntryId: newRelationshipTargetId,
      relationshipType: newRelationshipType,
      description: newRelationshipDescription || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid relationship.");
      return;
    }
    try {
      await request(`/api/v1/worlds/${selectedWorldId}/relationships`, {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      const relBody = await request(
        `/api/v1/worlds/${selectedWorldId}/relationships?entryId=${selectedEntryId}`,
      );
      setRelationships(relBody.data.relationships ?? []);
      setNewRelationshipType("");
      setNewRelationshipTargetId("");
      setNewRelationshipDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create relationship.");
    }
  }

  async function handleDeleteRelationship(relationshipId: string) {
    if (!selectedWorldId || !window.confirm("Remove this relationship?")) return;
    try {
      await request(`/api/v1/worlds/${selectedWorldId}/relationships/${relationshipId}`, {
        method: "DELETE",
      });
      setRelationships((current) =>
        current.filter((relationship) => relationship.id !== relationshipId),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove relationship.");
    }
  }

  async function handleLinkDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorldId || !selectedEntryId || !documentIdToLink) return;
    try {
      await request(`/api/v1/documents/${documentIdToLink}/world-entries`, {
        method: "POST",
        body: JSON.stringify({ worldEntryId: selectedEntryId, relationshipType: "REFERENCES" }),
      });
      const linkBody = await request(
        `/api/v1/worlds/${selectedWorldId}/entries/${selectedEntryId}/documents`,
      );
      setDocumentLinks(linkBody.data.links ?? []);
      setDocumentIdToLink("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to link document.");
    }
  }

  async function handleUnlinkDocument(link: DocumentLink) {
    if (!window.confirm("Remove this document link?")) return;
    try {
      await request(`/api/v1/documents/${link.documentId}/world-entries/${link.worldEntryId}`, {
        method: "DELETE",
      });
      const linkBody = await request(
        `/api/v1/worlds/${selectedWorldId}/entries/${selectedEntryId}/documents`,
      );
      setDocumentLinks(linkBody.data.links ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove link.");
    }
  }

  async function handleUpdateWorld(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorldId) return;
    const parsed = validation.updateWorldSchema.safeParse({
      name: editWorldName || undefined,
      description: editWorldDescription || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid world.");
      return;
    }
    try {
      const body = await request(`/api/v1/worlds/${selectedWorldId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      setWorlds((current) =>
        current.map((world) => (world.id === selectedWorldId ? body.data.world : world)),
      );
      setIsEditingWorld(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update world.");
    }
  }

  async function handleUpdateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorldId || !selectedEntryId) return;
    const parsed = validation.updateWorldEntrySchema.safeParse({
      name: editEntryName || undefined,
      kind: editEntryKind || undefined,
      summary: editEntrySummary || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid entry.");
      return;
    }
    try {
      const body = await request(`/api/v1/worlds/${selectedWorldId}/entries/${selectedEntryId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      setEntries((current) =>
        current.map((entry) => (entry.id === selectedEntryId ? body.data.entry : entry)),
      );
      setIsEditingEntry(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update entry.");
    }
  }

  async function handleUpdateRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorldId || !editingRelationshipId) return;
    const parsed = validation.updateWorldEntryRelationshipSchema.safeParse({
      relationshipType: editRelationshipType || undefined,
      description: editRelationshipDescription || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid relationship.");
      return;
    }
    try {
      await request(`/api/v1/worlds/${selectedWorldId}/relationships/${editingRelationshipId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      const relBody = await request(
        `/api/v1/worlds/${selectedWorldId}/relationships?entryId=${selectedEntryId}`,
      );
      setRelationships(relBody.data.relationships ?? []);
      setEditingRelationshipId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update relationship.");
    }
  }

  const filteredEntries = entries.filter((entry) =>
    entryFilter ? entry.kind === entryFilter : true,
  );

  if (isLoading) {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Loading worlds…</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-screen">
      <section className="registration-card" style={{ width: "min(100%, 72rem)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Worlds</h1>
          <button type="button" onClick={onBack}>
            Back
          </button>
        </div>
        {error ? (
          <p className="registration-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="button" onClick={() => setShowCreateWorld((value) => !value)}>
          {showCreateWorld ? "Cancel" : "New world"}
        </button>
        {showCreateWorld ? (
          <form onSubmit={handleCreateWorld}>
            <label>
              Name
              <input
                value={newWorldName}
                onChange={(event) => setNewWorldName(event.target.value)}
              />
            </label>
            <label>
              Description
              <textarea
                value={newWorldDescription}
                onChange={(event) => setNewWorldDescription(event.target.value)}
              />
            </label>
            <button type="submit">Create world</button>
          </form>
        ) : null}

        {worlds.length === 0 ? (
          <p>No worlds yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "16rem 1fr", gap: "1rem" }}>
            <aside>
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
                {worlds.map((world) => (
                  <li key={world.id}>
                    <button type="button" onClick={() => setSelectedWorldId(world.id)}>
                      {world.name}
                    </button>
                    <button type="button" onClick={() => void handleDeleteWorld(world.id)}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            {selectedWorldId ? (
              <div style={{ display: "grid", gap: "1rem" }}>
                <h2>{worlds.find((world) => world.id === selectedWorldId)?.name}</h2>
                <button
                  type="button"
                  onClick={() => {
                    const world = worlds.find((item) => item.id === selectedWorldId);
                    setEditWorldName(world?.name ?? "");
                    setEditWorldDescription(world?.description ?? "");
                    setIsEditingWorld((value) => !value);
                  }}
                >
                  {isEditingWorld ? "Cancel edit" : "Rename world"}
                </button>
                {isEditingWorld ? (
                  <form onSubmit={handleUpdateWorld}>
                    <label>
                      Name
                      <input
                        value={editWorldName}
                        onChange={(event) => setEditWorldName(event.target.value)}
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        value={editWorldDescription}
                        onChange={(event) => setEditWorldDescription(event.target.value)}
                      />
                    </label>
                    <button type="submit">Save world</button>
                  </form>
                ) : null}

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <label>
                    Filter by type
                    <select
                      value={entryFilter}
                      onChange={(event) => setEntryFilter(event.target.value)}
                    >
                      <option value="">All</option>
                      <option value="CHARACTER">Character</option>
                      <option value="LOCATION">Location</option>
                      <option value="ORGANIZATION">Organization</option>
                      <option value="OBJECT">Object</option>
                      <option value="EVENT">Event</option>
                      <option value="SPECIES">Species</option>
                      <option value="CONCEPT">Concept</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => setShowCreateEntry((value) => !value)}>
                    {showCreateEntry ? "Cancel" : "New entry"}
                  </button>
                </div>

                {showCreateEntry ? (
                  <form onSubmit={handleCreateEntry}>
                    <label>
                      Name
                      <input
                        value={newEntryName}
                        onChange={(event) => setNewEntryName(event.target.value)}
                      />
                    </label>
                    <label>
                      Type
                      <select
                        value={newEntryKind}
                        onChange={(event) => setNewEntryKind(event.target.value)}
                      >
                        <option value="CHARACTER">Character</option>
                        <option value="LOCATION">Location</option>
                        <option value="ORGANIZATION">Organization</option>
                        <option value="OBJECT">Object</option>
                        <option value="EVENT">Event</option>
                        <option value="SPECIES">Species</option>
                        <option value="CONCEPT">Concept</option>
                        <option value="CUSTOM">Custom</option>
                      </select>
                    </label>
                    <label>
                      Summary
                      <textarea
                        value={newEntrySummary}
                        onChange={(event) => setNewEntrySummary(event.target.value)}
                      />
                    </label>
                    <button type="submit">Create entry</button>
                  </form>
                ) : null}

                {filteredEntries.length === 0 ? (
                  <p>No entries found.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
                    {filteredEntries.map((entry) => (
                      <li
                        key={entry.id}
                        style={{
                          border: "1px solid #d8d2c8",
                          borderRadius: "0.5rem",
                          padding: "0.75rem",
                        }}
                      >
                        <button type="button" onClick={() => setSelectedEntryId(entry.id)}>
                          {entry.name} ({entry.kind})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEntryId(entry.id);
                            setEditEntryName(entry.name);
                            setEditEntryKind(entry.kind);
                            setEditEntrySummary(entry.summary ?? "");
                            setIsEditingEntry(true);
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => void handleDeleteEntry(entry.id)}>
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedEntryId ? (
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {isEditingEntry ? (
                      <form onSubmit={handleUpdateEntry}>
                        <label>
                          Name
                          <input
                            value={editEntryName}
                            onChange={(event) => setEditEntryName(event.target.value)}
                          />
                        </label>
                        <label>
                          Type
                          <select
                            value={editEntryKind}
                            onChange={(event) => setEditEntryKind(event.target.value)}
                          >
                            <option value="CHARACTER">Character</option>
                            <option value="LOCATION">Location</option>
                            <option value="ORGANIZATION">Organization</option>
                            <option value="OBJECT">Object</option>
                            <option value="EVENT">Event</option>
                            <option value="SPECIES">Species</option>
                            <option value="CONCEPT">Concept</option>
                            <option value="CUSTOM">Custom</option>
                          </select>
                        </label>
                        <label>
                          Summary
                          <textarea
                            value={editEntrySummary}
                            onChange={(event) => setEditEntrySummary(event.target.value)}
                          />
                        </label>
                        <button type="submit">Save entry</button>
                        <button type="button" onClick={() => setIsEditingEntry(false)}>
                          Cancel
                        </button>
                      </form>
                    ) : null}

                    <h3>Relationships</h3>
                    <form onSubmit={handleCreateRelationship}>
                      <label>
                        Target entry
                        <select
                          value={newRelationshipTargetId}
                          onChange={(event) => setNewRelationshipTargetId(event.target.value)}
                        >
                          <option value="">Select an entry</option>
                          {entries
                            .filter((entry) => entry.id !== selectedEntryId)
                            .map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Type
                        <input
                          value={newRelationshipType}
                          onChange={(event) => setNewRelationshipType(event.target.value)}
                        />
                      </label>
                      <label>
                        Description
                        <textarea
                          value={newRelationshipDescription}
                          onChange={(event) => setNewRelationshipDescription(event.target.value)}
                        />
                      </label>
                      <button type="submit">Add relationship</button>
                    </form>
                    {relationships.length === 0 ? (
                      <p>No relationships yet.</p>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
                        {relationships.map((relationship) => (
                          <li key={relationship.id}>
                            {editingRelationshipId === relationship.id ? (
                              <form onSubmit={handleUpdateRelationship}>
                                <label>
                                  Type
                                  <input
                                    value={editRelationshipType}
                                    onChange={(event) =>
                                      setEditRelationshipType(event.target.value)
                                    }
                                  />
                                </label>
                                <label>
                                  Description
                                  <textarea
                                    value={editRelationshipDescription}
                                    onChange={(event) =>
                                      setEditRelationshipDescription(event.target.value)
                                    }
                                  />
                                </label>
                                <button type="submit">Save</button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRelationshipId(null)}
                                >
                                  Cancel
                                </button>
                              </form>
                            ) : (
                              <>
                                {relationship.relationshipType}: {relationship.sourceEntry?.name} →{" "}
                                {relationship.targetEntry?.name}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRelationshipId(relationship.id);
                                    setEditRelationshipType(relationship.relationshipType);
                                    setEditRelationshipDescription(relationship.description ?? "");
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteRelationship(relationship.id)}
                                >
                                  Remove
                                </button>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    <h3>Linked documents</h3>
                    <form onSubmit={handleLinkDocument}>
                      <label>
                        Document ID
                        <input
                          value={documentIdToLink}
                          onChange={(event) => setDocumentIdToLink(event.target.value)}
                        />
                      </label>
                      <button type="submit">Link document</button>
                    </form>
                    {documentLinks.length === 0 ? (
                      <p>No linked documents.</p>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
                        {documentLinks.map((link) => (
                          <li key={link.id}>
                            {link.document?.title ?? link.documentId}
                            {onOpenDocument ? (
                              <button type="button" onClick={() => onOpenDocument(link.documentId)}>
                                Open
                              </button>
                            ) : null}
                            <button type="button" onClick={() => void handleUnlinkDocument(link)}>
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <p>Select a world to view its entries.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
