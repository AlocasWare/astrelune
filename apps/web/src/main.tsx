import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BinderScreen } from "./BinderScreen";
import { DocumentEditorScreen } from "./DocumentEditorScreen";
import { LoginScreen } from "./LoginScreen";
import { ProjectsScreen } from "./ProjectsScreen";
import { RegistrationScreen } from "./RegistrationScreen";
import { SettingsScreen } from "./SettingsScreen";
import { WorldsScreen } from "./WorldsScreen";
import "./style.css";
import "./interaction-states.css";
import "./save-state.css";

type Chapter = { id: string; title: string; body: string; updatedAt: number };
type DraftBook = { title: string; chapters: Chapter[] };
type SaveState = "saving" | "saved" | "error";

const starter: DraftBook = {
  title: "The Cartographer’s Moon",
  chapters: [
    {
      id: "ch1",
      title: "The map that moved",
      body: "The first time the map changed, Elian blamed the candle.\n\nIts flame leaned hard to the west, though the windows were shut and the room was still. On the parchment, a silver coastline slipped beneath his inked thumb. A harbor appeared where yesterday there had been only open sea.\n\nHe knew every shore on the northern charts. He had drawn them himself, line by careful line, through three winters at the Royal Archive. This coast was not one of them.\n\nThen, from somewhere below the floorboards, came the sound of a bell.\n\nOnce.\n\nElian looked at the map again. A tiny black mark had appeared at the mouth of the new harbor. Beside it, in handwriting that looked very much like his own, someone had written: **Come before the tide turns.**",
      updatedAt: Date.now(),
    },
    { id: "ch2", title: "A bell beneath the floor", body: "", updatedAt: Date.now() - 86400000 },
    { id: "ch3", title: "North of the known sea", body: "", updatedAt: Date.now() - 172800000 },
  ],
};

const starterKey = "astrelune-writing-draft-v1";

function readDraft(): DraftBook {
  try {
    const saved = localStorage.getItem(starterKey);
    if (saved) return JSON.parse(saved) as DraftBook;
  } catch {
    /* Use the starter draft if browser storage is unavailable. */
  }
  return starter;
}

function App({ onLogout }: { onLogout: () => void }) {
  const [book, setBook] = useState<DraftBook>(readDraft);
  const [activeId, setActiveId] = useState(book.chapters[0]?.id ?? "ch1");
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saving");
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      const response = await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        setLogoutError("Logout failed. Please try again.");
        return;
      }
      onLogout();
    } catch {
      setLogoutError("Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }
  const [goal, setGoal] = useState(1200);
  const editorRef = useRef<HTMLDivElement>(null);
  const active = book.chapters.find((chapter) => chapter.id === activeId) ?? book.chapters[0];

  useEffect(() => {
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(starterKey, JSON.stringify(book));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [book, saveAttempt]);

  useEffect(() => {
    if (
      editorRef.current &&
      active &&
      editorRef.current.innerText !== active.body.replace(/\*\*(.*?)\*\*/g, "$1")
    ) {
      editorRef.current.innerText = active.body.replace(/\*\*(.*?)\*\*/g, "$1");
    }
    // Sync the editor on chapter changes, not while the current chapter is being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const words = useMemo(() => (active?.body.trim().match(/\S+/g) ?? []).length, [active?.body]);
  const totalWords = useMemo(
    () =>
      book.chapters.reduce(
        (sum, chapter) => sum + (chapter.body.trim().match(/\S+/g) ?? []).length,
        0,
      ),
    [book],
  );
  const visibleChapters = book.chapters.filter((chapter) =>
    chapter.title.toLowerCase().includes(query.toLowerCase()),
  );

  function updateBody(body: string) {
    setSaveState("saving");
    setBook((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.id === activeId ? { ...chapter, body, updatedAt: Date.now() } : chapter,
      ),
    }));
  }

  function addChapter() {
    const chapter = {
      id: crypto.randomUUID(),
      title: `Chapter ${book.chapters.length + 1}`,
      body: "",
      updatedAt: Date.now(),
    };
    setSaveState("saving");
    setBook((current) => ({ ...current, chapters: [...current.chapters, chapter] }));
    setActiveId(chapter.id);
  }

  function renameChapter(title: string) {
    setSaveState("saving");
    setBook((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.id === activeId ? { ...chapter, title, updatedAt: Date.now() } : chapter,
      ),
    }));
  }

  function format(command: string) {
    editorRef.current?.focus();
    document.execCommand(command);
    if (editorRef.current) updateBody(editorRef.current.innerText);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="Astrelune home">
          <span className="brand-mark">✳</span>
          <span>astrelune</span>
        </a>
        <div className="side-label">YOUR LIBRARY</div>
        <button className="library-item selected">
          <span className="book-icon">▤</span>
          <span className="library-copy">
            <strong>{book.title}</strong>
            <small>Novel · {book.chapters.length} chapters</small>
          </span>
          <span className="more">···</span>
        </button>
        <button
          className="new-book"
          onClick={() => {
            const title = window.prompt("Name your new story");
            if (title?.trim()) {
              const fresh = {
                id: crypto.randomUUID(),
                title: title.trim(),
                body: "",
                updatedAt: Date.now(),
              };
              setSaveState("saving");
              setBook({ title: title.trim(), chapters: [fresh] });
              setActiveId(fresh.id);
            }
          }}
        >
          <span>＋</span> New story
        </button>
        <div className="sidebar-bottom">
          <div className="avatar">A</div>
          <div>
            <strong>Writer</strong>
            <small>Personal workspace</small>
          </div>
          <button className="icon-button" aria-label="Account options" title="Account options">
            ···
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Library</span>
            <i>/</i>
            <span>{book.title}</span>
          </div>
          <div className="top-actions">
            <div
              className={`save-indicator save-indicator-${saveState}`}
              role={saveState === "error" ? "alert" : "status"}
              aria-live={saveState === "error" ? "assertive" : "polite"}
            >
              <span className="save-dot" />
              <span>
                {saveState === "saving"
                  ? "Saving changes…"
                  : saveState === "saved"
                    ? "Saved in this browser"
                    : "Could not save your changes"}
              </span>
              {saveState === "error" && (
                <button
                  className="save-retry"
                  onClick={() => {
                    setSaveState("saving");
                    setSaveAttempt((attempt) => attempt + 1);
                  }}
                >
                  Retry
                </button>
              )}
            </div>
            <button
              className="share-button"
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
            >
              ↗ <span>Share</span>
            </button>
            <button className="profile-button" aria-label="Profile" title="Profile">
              A
            </button>
          </div>
        </header>

        <div className="workspace">
          <section className="manuscript-panel">
            <div className="manuscript-heading">
              <div>
                <div className="eyebrow">YOUR MANUSCRIPT</div>
                <h1>{book.title}</h1>
              </div>
              <button
                className="icon-button"
                aria-label="More manuscript options"
                title="More manuscript options"
              >
                ···
              </button>
            </div>
            <div className="chapter-toolbar">
              <div className="chapter-title">
                <span className="chapter-glyph">☷</span>
                <span>Chapters</span>
                <span className="count-pill">{book.chapters.length}</span>
              </div>
              <button className="add-chapter" onClick={addChapter}>
                ＋ <span>Add chapter</span>
              </button>
            </div>
            <label className="search-box">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a chapter"
              />
            </label>
            <div className="chapter-list">
              {visibleChapters.map((chapter, index) => (
                <button
                  key={chapter.id}
                  className={`chapter-row ${chapter.id === activeId ? "active" : ""}`}
                  onClick={() => setActiveId(chapter.id)}
                >
                  <span className="chapter-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="chapter-info">
                    <strong>{chapter.title || "Untitled chapter"}</strong>
                    <small>{(chapter.body.trim().match(/\S+/g) ?? []).length} words</small>
                  </span>
                  <span className="row-dots">···</span>
                </button>
              ))}
              {visibleChapters.length === 0 && <p className="empty-search">No chapters found</p>}
            </div>
            <div className="goal-card">
              <div className="goal-top">
                <span>DAILY WRITING GOAL</span>
                <span className="goal-icon">✧</span>
              </div>
              <div className="goal-number">
                {totalWords.toLocaleString()} <span>/ {goal.toLocaleString()} words</span>
              </div>
              <div className="progress-track">
                <span style={{ width: `${Math.min(100, (totalWords / goal) * 100)}%` }} />
              </div>
              <button
                className="goal-edit"
                onClick={() => {
                  const next = Number(window.prompt("Set your daily word goal", String(goal)));
                  if (next > 0) setGoal(next);
                }}
              >
                Edit goal <span>↗</span>
              </button>
            </div>
          </section>

          <section className="editor-panel">
            <div className="editor-topline">
              <div className="location-label">
                <span className="location-dot" />
                DRAFTING <span className="crumb-separator">/</span>{" "}
                {active?.title?.toUpperCase() ?? "CHAPTER"}
              </div>
              <button
                className="focus-button"
                onClick={() => document.body.classList.toggle("focus-mode")}
              >
                ◉ <span>Focus mode</span>
              </button>
              <button className="focus-button" onClick={() => (window.location.hash = "#projects")}>
                Projects
              </button>
              <button className="focus-button" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? "Signing out..." : "Log out"}
              </button>
              {logoutError ? <span className="field-error">{logoutError}</span> : null}
            </div>
            <div className="format-toolbar">
              <div className="format-group">
                <button onClick={() => format("bold")} aria-label="Bold" title="Bold">
                  <b>B</b>
                </button>
                <button onClick={() => format("italic")} aria-label="Italic" title="Italic">
                  <i>I</i>
                </button>
                <button
                  onClick={() => format("underline")}
                  aria-label="Underline"
                  title="Underline"
                >
                  <u>U</u>
                </button>
                <span className="tool-divider" />
                <button
                  onClick={() => format("formatBlock")}
                  aria-label="Paragraph style"
                  title="Paragraph style"
                >
                  ¶⌄
                </button>
              </div>
              <div className="format-right">
                <button onClick={() => format("undo")} aria-label="Undo" title="Undo">
                  ↶
                </button>
                <button onClick={() => format("redo")} aria-label="Redo" title="Redo">
                  ↷
                </button>
                <span className="tool-divider" />
                <button aria-label="More formatting" title="More formatting">
                  ···
                </button>
              </div>
            </div>
            <div className="page-scroll">
              <article className="page">
                <div className="page-meta">
                  <span>
                    CHAPTER{" "}
                    {String(
                      Math.max(
                        1,
                        book.chapters.findIndex((chapter) => chapter.id === activeId) + 1,
                      ),
                    ).padStart(2, "0")}
                  </span>
                  <span>✧ &nbsp; A STORY IN PROGRESS</span>
                </div>
                <input
                  className="chapter-heading-input"
                  value={active?.title ?? ""}
                  onChange={(event) => renameChapter(event.target.value)}
                  placeholder="Chapter title"
                  aria-label="Chapter title"
                />
                <div
                  ref={editorRef}
                  className="writing-area"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(event) => updateBody(event.currentTarget.innerText)}
                  data-placeholder="Let the story begin…"
                />
              </article>
            </div>
            <footer className="editor-footer">
              <div>
                <span>{words} words</span>
                <span className="footer-separator">·</span>
                <span>{Math.max(1, Math.ceil(words / 250))} min read</span>
              </div>
              <div>
                <span className="keyboard-hint">⌘ ↵</span> New scene
              </div>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function Root() {
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`${apiUrl}/api/v1/preferences`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.data?.preferences) {
          document.documentElement.dataset.theme = data.data.preferences.theme;
          document.documentElement.style.setProperty(
            "--editor-font-family",
            data.data.preferences.editorFontFamily,
          );
          document.documentElement.style.setProperty(
            "--editor-font-size",
            `${data.data.preferences.editorFontSize}px`,
          );
          document.documentElement.style.setProperty(
            "--editor-line-height",
            String(data.data.preferences.editorLineHeight),
          );
        }
      })
      .catch(() => {
        // Preference loading must not block workspace access.
      });
  }, [status]);

  useEffect(() => {
    fetch(`${apiUrl}/auth/me`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setStatus(data?.user ? "authenticated" : "unauthenticated"))
      .catch(() => setStatus("unauthenticated"));
  }, []);

  useEffect(() => {
    if (
      status === "authenticated" &&
      (window.location.hash === "#login" || window.location.hash === "#register")
    ) {
      window.location.hash = "";
    }
    if (status === "unauthenticated" && !window.location.hash) {
      window.location.hash = "#login";
    }
  }, [status]);

  if (status === "loading") {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Loading your Sanctuary…</h1>
        </section>
      </main>
    );
  }

  if (status === "unauthenticated") {
    if (window.location.hash === "#register") return <RegistrationScreen />;
    return <LoginScreen />;
  }

  if (selectedDocumentId) {
    return (
      <DocumentEditorScreen
        documentId={selectedDocumentId}
        onBack={() => setSelectedDocumentId(null)}
      />
    );
  }

  if (selectedProjectId) {
    return (
      <BinderScreen
        projectId={selectedProjectId}
        onBack={() => setSelectedProjectId(null)}
        onOpenDocument={setSelectedDocumentId}
      />
    );
  }

  if (window.location.hash === "#write") {
    return <App onLogout={() => setStatus("unauthenticated")} />;
  }

  if (window.location.hash === "#settings") {
    return <SettingsScreen onBack={() => (window.location.hash = "#projects")} />;
  }

  if (window.location.hash === "#worlds") {
    return (
      <WorldsScreen
        onBack={() => (window.location.hash = "#projects")}
        onOpenDocument={setSelectedDocumentId}
      />
    );
  }

  if (window.location.hash === "#projects") {
    return (
      <ProjectsScreen
        onOpenBinder={setSelectedProjectId}
        onLogout={() => setStatus("unauthenticated")}
      />
    );
  }

  return (
    <ProjectsScreen
      onOpenBinder={setSelectedProjectId}
      onLogout={() => setStatus("unauthenticated")}
    />
  );
}
createRoot(document.getElementById("root")!).render(<Root />);
