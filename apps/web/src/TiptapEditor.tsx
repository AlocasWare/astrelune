import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";

type TiptapEditorProps = {
  content: Record<string, unknown>;
  onChange?: (content: Record<string, unknown>) => void;
  editable?: boolean;
};

export function TiptapEditor({ content, onChange, editable = true }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content,
    editable,
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getJSON() as Record<string, unknown>);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(content);
  }, [content, editor]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="tiptap-editor">
      <div className="tiptap-toolbar">
        <button
          type="button"
          className={editor.isActive("bold") ? "is-active" : undefined}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
          aria-pressed={editor.isActive("bold")}
        >
          B
        </button>
        <button
          type="button"
          className={editor.isActive("italic") ? "is-active" : undefined}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
          aria-pressed={editor.isActive("italic")}
        >
          I
        </button>
        <button
          type="button"
          className={editor.isActive("underline") ? "is-active" : undefined}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
          aria-pressed={editor.isActive("underline")}
        >
          U
        </button>
        <button
          type="button"
          className={editor.isActive("heading", { level: 1 }) ? "is-active" : undefined}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          aria-label="Heading 1"
          aria-pressed={editor.isActive("heading", { level: 1 })}
        >
          H1
        </button>
        <button
          type="button"
          className={editor.isActive("heading", { level: 2 }) ? "is-active" : undefined}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Heading 2"
          aria-pressed={editor.isActive("heading", { level: 2 })}
        >
          H2
        </button>
        <button
          type="button"
          className={editor.isActive("bulletList") ? "is-active" : undefined}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
          aria-pressed={editor.isActive("bulletList")}
        >
          •
        </button>
        <button
          type="button"
          className={editor.isActive("orderedList") ? "is-active" : undefined}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
          aria-pressed={editor.isActive("orderedList")}
        >
          1.
        </button>
        <button
          type="button"
          className={editor.isActive("blockquote") ? "is-active" : undefined}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Blockquote"
          aria-pressed={editor.isActive("blockquote")}
        >
          “
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          aria-label="Undo"
          disabled={!editor.can().undo()}
        >
          ↶
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          aria-label="Redo"
          disabled={!editor.can().redo()}
        >
          ↷
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
