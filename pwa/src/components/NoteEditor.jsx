import { useEffect, useState } from "react";

export default function NoteEditor({ note, onSave, onCancel, saving }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    setTitle(note?.title || "");
    setContent(note?.content || "");
  }, [note]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...note, title: title.trim(), content });
  };

  return (
    <form className="editor card" onSubmit={handleSubmit}>
      <input
        className="input"
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        className="input textarea"
        placeholder="Write your note…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
      />
      <div className="editor__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn--success" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
