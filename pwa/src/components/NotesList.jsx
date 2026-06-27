export default function NotesList({ notes, selectedId, query, onQueryChange, onSelect, onNew }) {
  const filtered = notes.filter((note) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (note.title || "").toLowerCase().includes(q) ||
      (note.content || "").toLowerCase().includes(q)
    );
  });

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <input
          className="input search"
          type="search"
          placeholder="Search notes…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search notes"
        />
        <button className="btn btn--primary" onClick={onNew}>
          + New
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">No notes found.</p>
      ) : (
        <ul className="note-list">
          {filtered.map((note) => (
            <li
              key={note.id}
              className={`note-item ${note.id === selectedId ? "note-item--active" : ""} ${
                note._pending ? "note-item--pending" : ""
              }`}
              onClick={() => onSelect(note)}
            >
              {note.photo && <img className="note-item__thumb" src={note.photo} alt="" />}
              <h3 className="note-item__title">{note.title || "Untitled"}</h3>
              <p className="note-item__preview">{(note.content || "").slice(0, 80) || "No content"}</p>
              {note._pending && <span className="badge">unsynced</span>}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
