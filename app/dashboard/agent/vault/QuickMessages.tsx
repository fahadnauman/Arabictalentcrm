"use client";

import { useState, useEffect } from "react";

interface QuickMsg {
  id: string;
  title: string;
  content: string;
}

const DEFAULT_MSGS: QuickMsg[] = [
  {
    id: "1",
    title: "Course Details (Standard)",
    content: "Hi! Our Standard Arabic Course covers speaking, listening, reading, and writing. The fee is AED 1,500 per month for 12 sessions. Would you like to know the current schedule?",
  },
  {
    id: "2",
    title: "Follow-up (Thinking)",
    content: "Hello! Just checking in to see if you had any questions about our programs. I'd be happy to arrange a quick trial call if that helps you decide!",
  },
  {
    id: "3",
    title: "Payment Link",
    content: "Great! You can complete your deposit/payment securely via this link: [Insert Link]. Let me know once it's done so I can confirm your enrollment.",
  }
];

export default function QuickMessages() {
  const [messages, setMessages] = useState<QuickMsg[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("arabic_talent_quick_msgs");
    if (saved) {
      try { setMessages(JSON.parse(saved)); }
      catch { setMessages(DEFAULT_MSGS); }
    } else {
      setMessages(DEFAULT_MSGS);
    }
  }, []);

  const saveToStorage = (msgs: QuickMsg[]) => {
    setMessages(msgs);
    localStorage.setItem("arabic_talent_quick_msgs", JSON.stringify(msgs));
  };

  const handleCopy = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error("Failed to copy");
    }
  };

  const startEdit = (msg: QuickMsg) => {
    setEditingId(msg.id);
    setEditTitle(msg.title);
    setEditContent(msg.content);
  };

  const saveEdit = () => {
    const updated = messages.map(m => m.id === editingId ? { ...m, title: editTitle, content: editContent } : m);
    saveToStorage(updated);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {messages.map(msg => (
        <div key={msg.id} style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem"
        }}>
          {editingId === msg.id ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input 
                value={editTitle} onChange={e => setEditTitle(e.target.value)}
                style={inputSty} placeholder="Message Title"
              />
              <textarea 
                value={editContent} onChange={e => setEditContent(e.target.value)}
                style={{ ...inputSty, minHeight: 80, resize: "vertical" }} placeholder="Message content..."
              />
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button onClick={cancelEdit} style={btnSecondary}>Cancel</button>
                <button onClick={saveEdit} style={btnPrimary}>Save</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "0.9rem", color: "#f0f0ff", fontWeight: 700 }}>
                  {msg.title}
                </h4>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button onClick={() => startEdit(msg)} style={iconBtn} title="Edit">
                    ✎
                  </button>
                  <button 
                    onClick={() => handleCopy(msg.id, msg.content)} 
                    style={{ ...iconBtn, color: copiedId === msg.id ? "#20C997" : "#8b8aa8", borderColor: copiedId === msg.id ? "rgba(32,201,151,0.3)" : "rgba(255,255,255,0.15)" }} 
                    title="Copy"
                  >
                    {copiedId === msg.id ? "✓" : "📋"}
                  </button>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#a7a6c5", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {msg.content}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const inputSty: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
  padding: "0.5rem 0.75rem", color: "#f0f0ff", fontSize: "0.85rem",
  fontFamily: "inherit", outline: "none",
};

const btnPrimary: React.CSSProperties = {
  background: "linear-gradient(135deg,#7c3aed,#9333ea)", color: "white",
  border: "none", borderRadius: 6, padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer"
};

const btnSecondary: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)", color: "#c4c3dc",
  border: "none", borderRadius: 6, padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer"
};

const iconBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
  color: "#8b8aa8", borderRadius: 6, width: 28, height: 28, display: "flex",
  alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.85rem"
};
