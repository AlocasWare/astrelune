export type BinderItem = {
  id: string;
  title: string;
  kind: "FOLDER" | "CHAPTER" | "SCENE" | "NOTE" | "RESEARCH";
  parentId: string | null;
  position: number;
};

type BinderTreeProps = {
  documents: BinderItem[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onMove: (documentId: string, parentId: string | null, position?: number) => void;
  onDelete: (documentId: string) => void;
  onRename: (documentId: string, title: string) => void;
  onDuplicate: (documentId: string) => void;
  onOpen: (documentId: string) => void;
};

function iconFor(kind: BinderItem["kind"]) {
  switch (kind) {
    case "FOLDER":
      return "📁";
    case "CHAPTER":
      return "📖";
    case "SCENE":
      return "🎬";
    case "NOTE":
      return "📝";
    default:
      return "🔍";
  }
}

function BinderNode({
  doc,
  documents,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  onMove,
  onDelete,
  onRename,
  onDuplicate,
  onOpen,
  depth,
}: {
  doc: BinderItem;
  documents: BinderItem[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onMove: (documentId: string, parentId: string | null, position?: number) => void;
  onDelete: (documentId: string) => void;
  onRename: (documentId: string, title: string) => void;
  onDuplicate: (documentId: string) => void;
  onOpen: (documentId: string) => void;

  depth: number;
}) {
  const children = documents
    .filter((item) => item.parentId === doc.id)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));

  return (
    <li
      role="treeitem"
      aria-expanded={children.length > 0 ? expandedIds.has(doc.id) : undefined}
      aria-selected={selectedId === doc.id}
      style={{ marginLeft: `${depth * 1.25}rem` }}
    >
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(doc.id)}
            aria-label={expandedIds.has(doc.id) ? "Collapse" : "Expand"}
          >
            {expandedIds.has(doc.id) ? "▾" : "▸"}
          </button>
        ) : (
          <span style={{ width: "1.5rem", display: "inline-block" }} />
        )}
        <span
          style={{
            fontWeight: selectedId === doc.id ? 700 : 400,
            background: selectedId === doc.id ? "#efe7d8" : "transparent",
            padding: "0.1rem 0.35rem",
            borderRadius: "0.35rem",
            cursor: "pointer",
          }}
          onClick={() => onSelect(doc.id)}
          draggable
          onDragStart={(event) => event.dataTransfer.setData("text/plain", doc.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const draggedId = event.dataTransfer.getData("text/plain");
            if (draggedId && draggedId !== doc.id) {
              const targetParentId =
                doc.kind === "FOLDER" || doc.kind === "CHAPTER" ? doc.id : doc.parentId;
              onMove(draggedId, targetParentId, doc.position);
            }
          }}
        >
          {iconFor(doc.kind)} {doc.title}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = window.prompt("Rename item", doc.title);
            if (next && next.trim()) onRename(doc.id, next.trim());
          }}
        >
          Rename
        </button>
        <button type="button" onClick={() => onOpen(doc.id)}>
          Open
        </button>
        <button type="button" onClick={() => onDuplicate(doc.id)}>
          Duplicate
        </button>
        <button type="button" onClick={() => onDelete(doc.id)}>
          Delete
        </button>
      </div>
      {expandedIds.has(doc.id) && children.length > 0 ? (
        <ul role="group" style={{ listStyle: "none", padding: 0 }}>
          {children.map((child) => (
            <BinderNode
              key={child.id}
              doc={child}
              documents={documents}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onMove={onMove}
              onDelete={onDelete}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onOpen={onOpen}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function BinderTree(props: BinderTreeProps) {
  const roots = props.documents
    .filter((item) => item.parentId === null)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));

  if (props.documents.length === 0) {
    return <p>No Binder items yet.</p>;
  }

  return (
    <ul role="tree" style={{ listStyle: "none", padding: 0 }}>
      {roots.map((doc) => (
        <BinderNode key={doc.id} doc={doc} {...props} depth={0} />
      ))}
    </ul>
  );
}
