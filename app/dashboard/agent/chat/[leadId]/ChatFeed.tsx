"use client";

import {
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
  useMemo,
} from "react";
import { sendMessage, SentMessage } from "@/app/actions/message";
import { updateLeadInfo } from "@/app/actions/lead";
import styles from "../../agent.module.css";
import chatStyles from "./chat.module.css";

// ── Types ────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id:         string;
  body:       string;
  direction:  "INBOUND" | "OUTBOUND";
  sentAt:     string; // ISO string
  senderName: string | null;
  pending?:   boolean;
  failed?:    boolean;
  mediaUrl?:  string | null;
  mediaType?: string | null;
  isStatusReply?: boolean;
}

interface Props {
  leadId:      string;
  agentName:   string;
  initialMsgs: ChatMessage[];
}

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour:   "2-digit",
    minute: "2-digit",
  });
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

interface MsgGroup { date: string; messages: ChatMessage[] }

function groupByDate(messages: ChatMessage[]): MsgGroup[] {
  const groups: MsgGroup[] = [];
  for (const m of messages) {
    const dateStr = fmtDate(m.sentAt);
    const last = groups[groups.length - 1];
    if (last && last.date === dateStr) {
      last.messages.push(m);
    } else {
      groups.push({ date: dateStr, messages: [m] });
    }
  }
  return groups;
}

const QUICK_COURSES = ["Business Arabic", "General Arabic", "Kids Arabic", "Beginner Arabic"];

// ── Component ────────────────────────────────────────────────────────────
export default function ChatFeed({ leadId, agentName, initialMsgs }: Props) {
  const [messages, setMessages]   = useState<ChatMessage[]>(initialMsgs);
  const [text, setText]           = useState("");
  const [showMenu, setShowMenu]   = useState(false);
  const [isPending, startTx]      = useTransition();
  const [errorId, setErrorId]     = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const mediaRecorderRef          = useRef<MediaRecorder | null>(null);
  const audioChunksRef            = useRef<Blob[]>([]);

  // Auto-scroll to latest message
  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollDown(); }, [messages.length, scrollDown]);

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleSend() {
    const body = text.trim();
    if (!body || isPending) return;

    const tempId = `pending-${Date.now()}`;
    const optimistic: ChatMessage = {
      id:         tempId,
      body,
      direction:  "OUTBOUND",
      sentAt:     new Date().toISOString(),
      senderName: agentName,
      pending:    true,
    };

    // 1. Optimistic update — shows immediately
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // 2. Background save — replaces temp with persisted record
    startTx(async () => {
      try {
        const saved: SentMessage = await sendMessage(leadId, body);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...saved, pending: false }
              : m
          )
        );
        setErrorId(null);
      } catch {
        // Mark the message as failed
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, pending: false, failed: true } : m
          )
        );
        setErrorId(tempId);
      }
    });
  }

  function processUpload(base64: string, mimeType: string, filename: string) {
    setIsUploading(true);
    const tempId = `pending-media-${Date.now()}`;
    const optimistic: ChatMessage = {
      id:         tempId,
      body:       filename,
      direction:  "OUTBOUND",
      sentAt:     new Date().toISOString(),
      senderName: agentName,
      pending:    true,
      mediaUrl:   base64, // Local preview
      mediaType:  mimeType,
    };

    setMessages((prev) => [...prev, optimistic]);

    startTx(async () => {
      try {
        const saved: SentMessage = await sendMessage(leadId, filename, base64, mimeType);
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...saved, pending: false } : m));
        setErrorId(null);
      } catch {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, pending: false, failed: true } : m));
        setErrorId(tempId);
      } finally {
        setIsUploading(false);
      }
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      processUpload(base64, file.type, file.name);
    };
    reader.onerror = () => setIsUploading(false);
    reader.readAsDataURL(file);
    e.target.value = ""; // Reset input
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            processUpload(base64, 'audio/webm', 'Voice Note');
          };
          reader.readAsDataURL(blob);
          stream.getTracks().forEach(track => track.stop());
        };

        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        console.error("Microphone access denied:", err);
        alert("Microphone access denied or unavailable.");
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSetCourse(course: string) {
    setShowMenu(false);
    startTx(async () => {
      try {
        await updateLeadInfo(leadId, { name: "", company: "", notes: "", courseType: course });
        
        // Drop a system notification bubble directly into the chat feed
        const sysMsg: ChatMessage = {
          id: `sys-${Date.now()}`,
          body: `⚡ Course updated to: ${course}`,
          direction: "OUTBOUND",
          sentAt: new Date().toISOString(),
          senderName: "System",
        };
        setMessages(prev => [...prev, sysMsg]);
      } catch (err) {
        console.error(err);
      }
    });
  }

  const charCount = text.length;

  const renderedMessages = useMemo(() => {
    const grouped = groupByDate(messages);
    if (grouped.length === 0) {
      return (
        <div className={chatStyles.emptyFeed}>
          <div className={chatStyles.emptyIcon}>
            {/* WhatsApp-style chat bubble SVG */}
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="rgba(32,201,151,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className={chatStyles.emptyTitle}>No messages yet</p>
          <p className={chatStyles.emptyBody}>
            WhatsApp messages via Twilio will appear here.<br />
            You can also type a note below to start the thread.
          </p>
        </div>
      );
    }
    return grouped.map((group) => (
      <div key={group.date}>
        {/* ── Date divider ───────────────────────────────── */}
        <div className={chatStyles.dateDivider}>
          <span>{group.date}</span>
        </div>
        {group.messages.map((msg) => {
          const isOut = msg.direction === "OUTBOUND";
          return (
            <div key={msg.id} className={`${chatStyles.bubbleWrap} ${isOut ? chatStyles.bubbleWrapOut : chatStyles.bubbleWrapIn}`}>
              
              {!isOut && (
                <div className={chatStyles.inAvatar}>●</div>
              )}

              <div className={`${chatStyles.bubble} ${isOut ? chatStyles.bubbleOut : chatStyles.bubbleIn} ${msg.pending ? chatStyles.bubblePending : ""} ${msg.failed ? chatStyles.bubbleFailed : ""}`}>
                
                {/* Status Reply Badge */}
                {msg.isStatusReply && (
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#20C997", marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "0.3rem", background: "rgba(32,201,151,0.1)", padding: "0.2rem 0.5rem", borderRadius: "10px", width: "fit-content" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                    Replying to Status
                  </div>
                )}

                {msg.mediaUrl && (
                  <div style={{ marginBottom: "0.5rem" }}>
                    {msg.mediaType?.startsWith("image/") ? (
                      <img src={msg.mediaUrl} alt="attachment" style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }} />
                    ) : msg.mediaType?.startsWith("audio/") ? (
                      <audio controls src={msg.mediaUrl} style={{ width: "100%", maxWidth: "250px" }} />
                    ) : (
                      <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px", textDecoration: "none", color: "#20C997" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, wordBreak: "break-all" }}>{msg.body || "Document Attachment"}</span>
                      </a>
                    )}
                  </div>
                )}
                {!msg.mediaUrl && <p className={chatStyles.bubbleText}>{msg.body}</p>}
                <div className={chatStyles.bubbleMeta}>
                  <span className={chatStyles.bubbleTime}>{fmtTime(msg.sentAt)}</span>
                  {isOut && (
                    <span className={chatStyles.bubbleStatus}>
                      {msg.failed  ? "⚠ Failed"   :
                       msg.pending ? "○ Sending…" :
                       "✓✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ));
  }, [messages]);

  return (
    <>
      {/* ── Message feed ──────────────────────────────────────── */}
      <div className={chatStyles.feed}>
        {renderedMessages}

        {/* Error notice */}
        {errorId && (
          <div className={chatStyles.errorBanner}>
            ⚠ Message failed to send. Check your connection and try again.
          </div>
        )}

        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* ── Input bar ─────────────────────────────────────────── */}
      <div className={chatStyles.inputBar} style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
        
        {/* Quick Menu Button */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={isPending || isUploading}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(32,201,151,0.15)", border: "1px solid rgba(32,201,151,0.4)",
              color: "#20C997", fontSize: "1.2rem", fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0
            }}
          >
            +
          </button>
          
          {/* Quick Menu Popup */}
          {showMenu && (
            <div style={{
              position: "absolute", bottom: "120%", left: 0,
              background: "#0a0a14", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px", padding: "0.5rem",
              display: "flex", flexDirection: "column", gap: "0.3rem",
              minWidth: "160px", zIndex: 10,
              boxShadow: "0 -4px 20px rgba(0,0,0,0.5)"
            }}>
              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "#8b8aa8", padding: "0.2rem 0.5rem", fontWeight: 700 }}>
                Set Course Interest
              </div>
              {QUICK_COURSES.map(course => (
                <button
                  key={course}
                  onClick={() => handleSetCourse(course)}
                  style={{
                    padding: "0.5rem", borderRadius: "8px", border: "none",
                    background: "rgba(255,255,255,0.03)", color: "#f1f0ff",
                    textAlign: "left", fontSize: "0.8rem", cursor: "pointer"
                  }}
                >
                  {course}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attachment Button */}
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: "none" }} 
          onChange={handleFileChange}
          accept="image/*,audio/*,application/pdf"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending || isUploading}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "transparent", border: "none",
            color: "#8b8aa8",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, padding: 0
          }}
          title="Attach file"
        >
          {isUploading ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#20C997" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
              </path>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </button>

        {/* Voice Note Button */}
        <button
          onClick={toggleRecording}
          disabled={isPending || isUploading}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: isRecording ? "rgba(248,113,113,0.15)" : "transparent",
            border: "none",
            color: isRecording ? "#f87171" : "#8b8aa8",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, padding: 0,
            animation: isRecording ? "pulse 1.5s infinite" : "none"
          }}
          title={isRecording ? "Stop recording" : "Record voice note"}
        >
          {isRecording ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </button>

        <div className={chatStyles.inputWrap} style={{ flexGrow: 1 }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            disabled={isPending}
            className={chatStyles.input}
            maxLength={4000}
          />
          {charCount > 200 && (
            <span className={chatStyles.charCount}>{charCount}/4000</span>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim() || isPending}
          className={chatStyles.sendBtn}
          title="Send (Enter)"
        >
          {isPending ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
              </path>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
