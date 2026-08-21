"use client";

import { useState, useEffect } from "react";

interface LibraryItem {
  id: string;
  title: string;
  content: string; // Used for content or link
  meta?: string; // Used for file size or type info
}

interface Props {
  storageKey: string;
  defaultItems: LibraryItem[];
  icon: React.ReactNode;
  title: string;
  isLinks?: boolean;
}

export default function EditableLibrary({ storageKey, defaultItems, icon, title, isLinks = false }: Props) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editMeta, setEditMeta] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { setItems(JSON.parse(saved)); }
      catch { setItems(defaultItems); }
    } else {
      setItems(defaultItems);
    }
  }, [storageKey, defaultItems]);

  const saveToStorage = (newItems: LibraryItem[]) => {
    setItems(newItems);
    localStorage.setItem(storageKey, JSON.stringify(newItems));
  };

  const startEdit = (item: LibraryItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditMeta(item.meta || "");
  };

  const saveEdit = () => {
    const updated = items.map(m => m.id === editingId ? { ...m, title: editTitle, content: editContent, meta: editMeta } : m);
    saveToStorage(updated);
    setEditingId(null);
  };

  const addNew = () => {
    const newItem = { id: Date.now().toString(), title: "New Entry", content: "Details..." };
    saveToStorage([newItem, ...items]);
    startEdit(newItem);
  };

  const deleteItem = (id: string) => {
    saveToStorage(items.filter(m => m.id !== id));
  };

  const cancelEdit = () => {
    // If we were editing a "New Entry" that was just created and we cancel without changing, maybe delete it. 
    // But keeping it simple: just cancel edit state.
    setEditingId(null);
  };

  return (
    <section style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <h2 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#4e4d6a", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {icon} {title}
        </h2>
        <button onClick={addNew} style={{
          background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
          color: "#a78bfa", borderRadius: 6, padding: "0.2rem 0.6rem", fontSize: "0.7rem", cursor: "pointer", fontWeight: 600
        }}>
          + Add New
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {items.length === 0 && (
          <p style={{ fontSize: "0.8rem", color: "#4e4d6a", margin: 0 }}>No items yet.</p>
        )}
        {items.map(item => (
          <div key={item.id} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem"
          }}>
            {editingId === item.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inputSty} placeholder="Title" />
                {isLinks ? (
                  <input value={editContent} onChange={e => setEditContent(e.target.value)} style={inputSty} placeholder="Link URL" />
                ) : (
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} style={{ ...inputSty, minHeight: 60, resize: "vertical" }} placeholder="Content..." />
                )}
                {isLinks && (
                  <input value={editMeta} onChange={e => setEditMeta(e.target.value)} style={inputSty} placeholder="Meta info (e.g. PDF · 2MB)" />
                )}
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between" }}>
                  <button onClick={() => deleteItem(item.id)} style={{ ...btnSecondary, color: "#f87171" }}>Delete</button>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={cancelEdit} style={btnSecondary}>Cancel</button>
                    <button onClick={saveEdit} style={btnPrimary}>Save</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: "0.9rem", color: "#f0f0ff", fontWeight: 700 }}>
                    {item.title}
                  </h4>
                  <button onClick={() => startEdit(item)} style={iconBtn} title="Edit">✎</button>
                </div>
                {isLinks ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                    <a href={item.content || "#"} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "#20C997", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                      {item.content || "No link"}
                    </a>
                    {item.meta && (
                      <span style={{ fontSize: "0.7rem", color: "#8b8aa8", background: "rgba(255,255,255,0.05)", padding: "0.2rem 0.5rem", borderRadius: 4 }}>
                        {item.meta}
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#a7a6c5", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {item.content}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const inputSty: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
  padding: "0.5rem 0.75rem", color: "#f0f0ff", fontSize: "0.85rem", fontFamily: "inherit", outline: "none",
};
const btnPrimary: React.CSSProperties = {
  background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "white", border: "none", borderRadius: 6, padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer"
};
const btnSecondary: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)", color: "#c4c3dc", border: "none", borderRadius: 6, padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer"
};
const iconBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#8b8aa8", borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.85rem"
};
