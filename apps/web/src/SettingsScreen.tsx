import { useState, useEffect, type FormEvent } from "react";
import * as validation from "@astrelune/validation";

type Preferences = {
  theme: "SYSTEM" | "LIGHT" | "DARK";
  editorFontFamily: string;
  editorFontSize: number;
  editorLineHeight: number;
  focusModeDefault: boolean;
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

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [theme, setTheme] = useState<Preferences["theme"]>("SYSTEM");
  const [editorFontFamily, setEditorFontFamily] = useState("serif");
  const [editorFontSize, setEditorFontSize] = useState(18);
  const [editorLineHeight, setEditorLineHeight] = useState(1.7);
  const [focusModeDefault, setFocusModeDefault] = useState(false);

  async function loadPreferences() {
    setIsLoading(true);
    setError(null);
    try {
      const body = await request("/api/v1/preferences");
      const next = body.data.preferences as Preferences;
      setTheme(next.theme);
      setEditorFontFamily(next.editorFontFamily);
      setEditorFontSize(next.editorFontSize);
      setEditorLineHeight(next.editorLineHeight);
      setFocusModeDefault(next.focusModeDefault);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load preferences.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPreferences();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveMessage(null);
    setError(null);
    const parsed = validation.updateUserPreferencesSchema.safeParse({
      theme,
      editorFontFamily,
      editorFontSize,
      editorLineHeight,
      focusModeDefault,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid preferences.");
      return;
    }
    setIsSaving(true);
    try {
      await request("/api/v1/preferences", {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      setSaveMessage("Preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save preferences.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="registration-screen">
        <section className="registration-card">
          <h1>Loading settings…</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-screen">
      <section className="registration-card" style={{ width: "min(100%, 48rem)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Settings</h1>
          <button type="button" onClick={onBack}>
            Back
          </button>
        </div>
        {error ? (
          <p className="registration-error" role="alert">
            {error}
          </p>
        ) : null}
        {saveMessage ? <p role="status">{saveMessage}</p> : null}

        <form onSubmit={handleSave} style={{ display: "grid", gap: "1rem" }}>
          <label>
            Theme
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as Preferences["theme"])}
            >
              <option value="SYSTEM">System</option>
              <option value="LIGHT">Light</option>
              <option value="DARK">Dark</option>
            </select>
          </label>
          <label>
            Editor font family
            <input
              value={editorFontFamily}
              onChange={(event) => setEditorFontFamily(event.target.value)}
            />
          </label>
          <label>
            Editor font size
            <input
              type="number"
              value={editorFontSize}
              onChange={(event) => setEditorFontSize(Number(event.target.value))}
            />
          </label>
          <label>
            Editor line height
            <input
              type="number"
              step="0.1"
              value={editorLineHeight}
              onChange={(event) => setEditorLineHeight(Number(event.target.value))}
            />
          </label>
          <label>
            Focus mode by default
            <input
              type="checkbox"
              checked={focusModeDefault}
              onChange={(event) => setFocusModeDefault(event.target.checked)}
            />
          </label>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save preferences"}
          </button>
        </form>
      </section>
    </main>
  );
}
