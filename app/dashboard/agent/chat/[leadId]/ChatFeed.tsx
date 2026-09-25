"use client";

import {
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
  useMemo,
} from "react";
import { sendMessage, recordOutboundMedia, SentMessage } from "@/app/actions/message";
import { getRandomGreeting } from "@/lib/spintax";
import { updateLeadInfo } from "@/app/actions/lead";
import { useRouter } from "next/navigation";
import UpdateFollowUpModal from "./UpdateFollowUpModal";
import VoiceNotePlayer from "./VoiceNotePlayer";
import styles from "../../agent.module.css";
import chatStyles from "./chat.module.css";

// ── Types ────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id:         string;
  body:       string;
  direction:  "INBOUND" | "OUTBOUND";
  sentAt:     string; // ISO string
  senderName: string | null;
  status?:    "pending" | "sent" | "failed" | string;
  pending?:   boolean;
  failed?:    boolean;
  mediaUrl?:  string | null;
  mediaType?: string | null;
  isStatusReply?: boolean;
  retryData?: {
    type: "text" | "media";
    body?: string;
    file?: File | Blob;
    filename?: string;
    mimeType?: string;
  };
}

interface Props {
  leadId:            string;
  leadPhone:         string;
  leadName?:         string;
  agentName:         string;
  initialMsgs:       ChatMessage[];
  activeFollowUpId?: string | null;
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

const VPS_DIRECT_UPLOAD_URL =
  process.env.NEXT_PUBLIC_VPS_DIRECT_UPLOAD_URL ||
  "https://143.198.182.24.sslip.io/direct-upload";

function SingleTickIcon({ color = "#8696a0", className, style }: { color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="15"
      height="11"
      viewBox="0 0 16 11"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <path
        d="M11.07 1.25L4.85 7.47L2.18 4.8"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DoubleTickIcon({ color = "#8696a0", className, style }: { color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      width="16"
      height="11"
      viewBox="0 0 16 11"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <path
        d="M9.82 1.25L3.6 7.47L0.93 4.8"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.07 1.25L7.85 7.47L6.4 6.02"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────────
export default function ChatFeed({
  leadId,
  leadPhone,
  leadName,
  agentName,
  initialMsgs,
  activeFollowUpId,
}: Props) {
  const router                    = useRouter();
  const [messages, setMessages]   = useState<ChatMessage[]>(initialMsgs);
  const [text, setText]           = useState("");
  const [showMenu, setShowMenu]   = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [isPending, startTx]      = useTransition();
  const [errorId, setErrorId]     = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "locked">("idle");
  const [recordDuration, setRecordDuration] = useState(0);
  const [cancelThresholdReached, setCancelThresholdReached] = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const mediaRecorderRef          = useRef<MediaRecorder | null>(null);
  const audioChunksRef            = useRef<Blob[]>([]);
  const mediaStreamRef            = useRef<MediaStream | null>(null);
  const isCancelledRef            = useRef(false);
  const recordTimerRef            = useRef<NodeJS.Timeout | null>(null);
  const recordStartTimeRef        = useRef(0);
  const pointerOriginRef          = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef        = useRef<number | null>(null);

  // Clean up recording stream & timer on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Auto-scroll to latest message
  const scrollDown = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollDown(); }, [messages.length, scrollDown]);

  // Sync state with server revalidations (e.g. router.refresh)
  useEffect(() => {
    setMessages((prev) => {
      const pendingOrFailed = prev.filter(
        (m) => m.status === "pending" || m.status === "failed" || m.pending || m.failed
      );
      if (pendingOrFailed.length === 0) {
        return initialMsgs.map((m) => ({ ...m, status: m.status || "SENT" }));
      }
      const initialIds = new Set(initialMsgs.map((m) => m.id));
      const stillPending = pendingOrFailed.filter((m) => !initialIds.has(m.id));
      return [
        ...initialMsgs.map((m) => ({ ...m, status: m.status || "SENT" })),
        ...stillPending,
      ];
    });
  }, [initialMsgs]);

  // Auto-polling: fetch fresh messages every 3 seconds (refreshInterval: 3000)
  useEffect(() => {
    let isMounted = true;
    const refreshInterval = 3000;

    async function pollMessages() {
      try {
        const res = await fetch(`/api/leads/${leadId}/messages?_t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });
        if (!res.ok) return;
        const freshMsgs: ChatMessage[] = await res.json();
        if (!isMounted) return;

        setMessages((prev) => {
          const prevMap = new Map(prev.map((m) => [m.id, m]));
          let hasChanges = prev.length !== freshMsgs.length;

          if (!hasChanges) {
            for (const fresh of freshMsgs) {
              const old = prevMap.get(fresh.id);
              if (!old) {
                hasChanges = true;
                break;
              }
              const prevStatus = String(old.status ?? "").trim().toUpperCase();
              const freshStatus = String(fresh.status ?? "").trim().toUpperCase();
              if (prevStatus !== freshStatus) {
                hasChanges = true;
                break;
              }
            }
          }

          if (!hasChanges) {
            return prev;
          }

          const freshIds = new Set(freshMsgs.map((m) => m.id));
          const stillPending = prev.filter(
            (m) => (m.pending || m.failed || m.status === "pending" || m.status === "failed") && !freshIds.has(m.id)
          );

          return [
            ...freshMsgs.map((m) => ({ ...m, status: (m.status || "SENT").toUpperCase() })),
            ...stillPending,
          ];
        });

        // Trigger router refresh to sync server components in background
        router.refresh();
      } catch (err) {
        // Silently ignore transient network polling errors
      }
    }

    const intervalId = setInterval(pollMessages, refreshInterval);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [leadId, router]);

  // Trigger 1: Synchronize 'Mark as Read' with host device whenever the chat window is opened
  useEffect(() => {
    fetch(`/api/leads/${leadId}/read`, { method: "POST" }).catch(() => {});
  }, [leadId]);

  // Auto-resize textarea up to 5 lines
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 125) + "px";
  }

  function handleSend(customBody?: string, retryId?: string) {
    const bodyToSend = (typeof customBody === "string" ? customBody : text).trim();
    if (!bodyToSend) return;

    // Trigger 2: Instantly sync 'Mark as Read' right before an agent sends an outbound reply
    fetch(`/api/leads/${leadId}/read`, { method: "POST" }).catch(() => {});

    const tempId = retryId || `pending-${Date.now()}`;

    if (retryId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, status: "pending", pending: true, failed: false }
            : m
        )
      );
    } else {
      // 1. Instantly append temporary optimistic message object with 'pending' status
      const optimistic: ChatMessage = {
        id:         tempId,
        body:       bodyToSend,
        direction:  "OUTBOUND",
        sentAt:     new Date().toISOString(),
        senderName: agentName,
        status:     "pending",
        pending:    true,
        failed:     false,
        retryData:  { type: "text", body: bodyToSend },
      };

      setMessages((prev) => [...prev, optimistic]);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

    scrollDown();

    // 2. Execute background fetch to server
    (async () => {
      try {
        const res = await sendMessage(leadId, bodyToSend);
        if (!res.success) {
          const httpStatus = res.status || 500;
          const rawResponse = res.rawResponse || res.error || "Unknown server response";
          console.log("Chat Message Error - HTTP status code:", httpStatus);
          console.log("Chat Message Error - raw error response:", rawResponse);
          console.error("[Chat Message Failure]", { status: httpStatus, rawResponse, error: res.error });
          setErrorMessage(`⚠ Failed to send message (HTTP ${httpStatus}): ${res.error || rawResponse}`);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    status: "failed",
                    pending: false,
                    failed: true,
                    retryData: { type: "text", body: bodyToSend },
                  }
                : m
            )
          );
          setErrorId(tempId);
          return;
        }

        // Server responded 200/201 -> Update specific message to 'sent'
        const saved = res.data;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...saved,
                  status: "SENT",
                  pending: false,
                  failed: false,
                }
              : m
          )
        );
        setErrorId(null);
        setErrorMessage(null);
      } catch (err: any) {
        const httpStatus = err?.status || err?.statusCode || err?.response?.status || (typeof err?.digest === "string" ? `Server Action Error (${err.digest})` : 500);
        const rawResponse = err?.response?.data || (err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        console.log("Chat Message Error - HTTP status code:", httpStatus);
        console.log("Chat Message Error - raw error response:", rawResponse);
        console.error("[Chat Message Exception]", { status: httpStatus, rawResponse, error: err, digest: err?.digest });
        setErrorMessage(`⚠ Failed to send message (Status: ${httpStatus}): ${err?.message || "Check console"}`);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: "failed",
                  pending: false,
                  failed: true,
                  retryData: { type: "text", body: bodyToSend },
                }
              : m
          )
        );
        setErrorId(tempId);
      }
    })();
  }

  async function processUpload(
    file: File | Blob,
    filename: string,
    mimeType: string,
    retryId?: string
  ) {
    setIsUploading(true);
    const tempId = retryId || `pending-media-${Date.now()}`;
    const localPreviewUrl = URL.createObjectURL(file);

    if (retryId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                status: "pending",
                pending: true,
                failed: false,
                mediaUrl: m.mediaUrl || localPreviewUrl,
              }
            : m
        )
      );
    } else {
      // 1. Instantly append temporary optimistic media object with 'pending' status
      const isVisualOpt = mimeType.startsWith("image/") || mimeType.startsWith("video/");
      const optimistic: ChatMessage = {
        id:         tempId,
        body:       isVisualOpt ? "" : filename,
        direction:  "OUTBOUND",
        sentAt:     new Date().toISOString(),
        senderName: agentName,
        status:     "pending",
        pending:    true,
        failed:     false,
        mediaUrl:   localPreviewUrl,
        mediaType:  mimeType,
        retryData:  { type: "media", file, filename, mimeType },
      };

      setMessages((prev) => [...prev, optimistic]);
    }

    scrollDown();

    try {
      const cleanPhone = (leadPhone || "").replace(/\D/g, "");
      if (!cleanPhone) {
        throw new Error("Missing recipient phone number for lead");
      }

      const lowerName = filename.toLowerCase();
      let rawMime = (mimeType || (file as File).type || "").split(";")[0].trim().toLowerCase();

      // Normalize MIME from filename if missing or generic
      if (!rawMime || rawMime === "application/octet-stream") {
        if (lowerName.endsWith(".mp4") || lowerName.endsWith(".m4v")) rawMime = "video/mp4";
        else if (lowerName.endsWith(".mov")) rawMime = "video/quicktime";
        else if (lowerName.endsWith(".webm")) rawMime = "video/webm";
        else if (lowerName.endsWith(".png")) rawMime = "image/png";
        else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) rawMime = "image/jpeg";
        else if (lowerName.endsWith(".webp")) rawMime = "image/webp";
        else if (lowerName.endsWith(".pdf")) rawMime = "application/pdf";
        else if (lowerName.endsWith(".ogg") || lowerName.endsWith(".opus")) rawMime = "audio/ogg";
        else if (lowerName.endsWith(".mp3")) rawMime = "audio/mpeg";
        else if (lowerName.endsWith(".wav")) rawMime = "audio/wav";
        else if (lowerName.endsWith(".m4a")) rawMime = "audio/mp4";
      }

      const isVideo =
        rawMime.startsWith("video/") ||
        lowerName.endsWith(".mp4") ||
        lowerName.endsWith(".m4v") ||
        lowerName.endsWith(".mov") ||
        lowerName.endsWith(".webm");

      const isAudio =
        !isVideo &&
        (rawMime.startsWith("audio/") ||
         rawMime === "audio/ogg" ||
         rawMime === "audio/webm" ||
         rawMime.includes("opus") ||
         lowerName.endsWith(".ogg") ||
         lowerName.endsWith(".mp3") ||
         lowerName.endsWith(".wav") ||
         lowerName.endsWith(".m4a") ||
         lowerName.startsWith("voice_note."));

      const isImage = !isVideo && !isAudio && rawMime.startsWith("image/");

      const targetMime = isVideo
        ? "video/mp4"
        : isAudio
        ? (rawMime || "audio/ogg")
        : (rawMime || "application/octet-stream");

      const computedMediatype = isVideo ? "video" : isImage ? "image" : isAudio ? "audio" : "document";

      let finalFileName: string;
      if (isVideo) {
        const base = filename.replace(/\.[^/.]+$/, "");
        finalFileName = `${base || "video"}.mp4`;
      } else if (isAudio) {
        const isVoice =
          filename === "Voice Note" ||
          filename.startsWith("voice_note.") ||
          rawMime.includes("ogg") ||
          rawMime.includes("webm") ||
          rawMime.includes("opus");

        finalFileName = isVoice ? "voice_note.ogg" : (filename.includes(".") ? filename : `${filename}.ogg`);
      } else {
        finalFileName = filename;
      }

      // 1. Dispatch upload
      let evoData: any = null;
      let recordRes: any = null;

      if (isAudio) {
        // WhatsApp Push-To-Talk (PTT) Voice Note: Route through server upload handler with native PTT flags
        const uploadFormData = new FormData();
        uploadFormData.append("file", file, finalFileName);
        uploadFormData.append("leadId", leadId);
        uploadFormData.append("caption", finalFileName);

        const res = await fetch("/api/messages/upload", {
          method: "POST",
          body: uploadFormData,
        });

        const uploadJson = await res.json().catch(() => null);

        if (!res.ok) {
          const httpStatus = res.status || 500;
          const rawResponse = uploadJson?.error || uploadJson?.rawResponse || JSON.stringify(uploadJson);
          console.error("[Voice Note PTT Upload Error]", { status: httpStatus, rawResponse });
          setErrorMessage(`⚠ Voice note upload failed (HTTP ${httpStatus}): ${rawResponse || "Check console"}`);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    status: "failed",
                    pending: false,
                    failed: true,
                    retryData: { type: "media", file, filename, mimeType },
                  }
                : m
            )
          );
          setErrorId(tempId);
          return;
        }

        if (uploadJson?.success && uploadJson?.message) {
          const saved: ChatMessage = {
            id: uploadJson.message.id,
            body: uploadJson.message.body,
            direction: uploadJson.message.direction,
            sentAt: uploadJson.message.sentAt,
            senderName: uploadJson.message.senderName || agentName,
            status: "SENT",
            mediaUrl: localPreviewUrl,
            mediaType: uploadJson.message.mediaType,
          };
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...saved, pending: false, failed: false } : m))
          );
          setErrorId(null);
          setErrorMessage(null);
        }
      } else {
        // 2. Non-audio files: Direct POST to VPS Nginx endpoint (bypasses Vercel 4.5MB payload limit)
        const isVisualMedia = computedMediatype === "image" || computedMediatype === "video";
        const formData = new FormData();
        formData.append("file", file, finalFileName);
        formData.append("number", cleanPhone);
        formData.append("mediatype", computedMediatype);
        if (!isVisualMedia) {
          formData.append("mimetype", targetMime);
          formData.append("fileName", finalFileName);
          formData.append("caption", finalFileName);
        }

        const res = await fetch(VPS_DIRECT_UPLOAD_URL, {
          method: "POST",
          body: formData,
        });

        evoData = await res.json().catch(() => null);

        if (!res.ok) {
          const httpStatus = res.status || 500;
          const rawResponse = evoData?.response?.message || evoData?.error || (typeof evoData === "string" ? evoData : JSON.stringify(evoData));
          console.log("Direct VPS Upload Error - exact HTTP status code:", httpStatus);
          console.log("Direct VPS Upload Error - raw error response:", rawResponse);
          console.error("[Direct VPS Upload Error]", {
            status: httpStatus,
            rawResponse,
            error: evoData?.error,
          });
          setErrorMessage(`⚠ Upload failed (HTTP ${httpStatus}): ${evoData?.error || rawResponse || "Check console for details"}`);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    status: "failed",
                    pending: false,
                    failed: true,
                    retryData: { type: "media", file, filename, mimeType },
                  }
                : m
            )
          );
          setErrorId(tempId);
          return;
        }

        // Server responded with 200/201 -> Update specific message to 'sent'
        try {
          const evoMetadata = {
            key: { id: evoData?.key?.id || null },
            keyId: evoData?.key?.id || null,
            status: evoData?.status || "SENT",
          };
          recordRes = await recordOutboundMedia(leadId, isVisualMedia ? "" : finalFileName, targetMime, evoMetadata);
        } catch (saErr) {
          console.warn("recordOutboundMedia Server Action exception (handled gracefully):", saErr);
        }

        if (recordRes?.success && recordRes?.data) {
          const saved: ChatMessage = recordRes.data;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...saved,
                    mediaUrl: localPreviewUrl, // Maintain local preview for agent
                    status: "SENT",
                    pending: false,
                    failed: false,
                  }
                : m
            )
          );
        } else {
          // Successful WhatsApp delivery with graceful optimistic update
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: evoData?.key?.id || tempId,
                    mediaUrl: localPreviewUrl,
                    status: "SENT",
                    pending: false,
                    failed: false,
                  }
                : m
            )
          );
        }
        setErrorId(null);
        setErrorMessage(null);
      }
    } catch (err: any) {
      const httpStatus = err?.status || err?.statusCode || 500;
      const rawResponse = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.log("Direct Upload Exception - exact HTTP status code:", httpStatus);
      console.log("Direct Upload Exception - raw error response:", rawResponse);
      console.error("[Direct Upload Exception]", {
        status: httpStatus,
        rawResponse,
        error: err,
        message: err?.message,
      });
      setErrorMessage(`⚠ Upload failed (Status: ${httpStatus}): ${err?.message || "Check console"}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                status: "failed",
                pending: false,
                failed: true,
                retryData: { type: "media", file, filename, mimeType },
              }
            : m
        )
      );
      setErrorId(tempId);
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    let mimeType = file.type || "application/octet-stream";
    if (file.name.toLowerCase().endsWith(".mp4")) {
      mimeType = "video/mp4";
    }

    processUpload(file, file.name, mimeType);
    e.target.value = ""; // Reset input
  }

  // ── WhatsApp-style voice recorder ─────────────────────────────────────────
  async function startVoiceRecording() {
    try {
      isCancelledRef.current = false;
      setCancelThresholdReached(false);
      setRecordDuration(0);
      recordStartTimeRef.current = Date.now();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Force the audio format to audio/ogg; codecs=opus for WhatsApp native PTT
      let preferredMime = "audio/ogg; codecs=opus";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/ogg; codecs=opus")) {
          preferredMime = "audio/ogg; codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          preferredMime = "audio/ogg";
        } else if (MediaRecorder.isTypeSupported("audio/webm; codecs=opus")) {
          preferredMime = "audio/webm; codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          preferredMime = "audio/mp4";
        }
      }

      const recorderOptions: MediaRecorderOptions = preferredMime ? { mimeType: preferredMime } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (isCancelledRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const actualMime = recorder.mimeType || preferredMime || "audio/ogg; codecs=opus";
        const blob = new Blob(audioChunksRef.current, { type: "audio/ogg" });
        audioChunksRef.current = [];

        // Strictly rename to voice_note.ogg for WhatsApp PTT transcoding
        const filename = "voice_note.ogg";
        processUpload(blob, filename, "audio/ogg");
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setRecordingState("recording");

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone access denied or unavailable.");
      stopRecording(true);
    }
  }

  function stopRecording(cancel: boolean) {
    isCancelledRef.current = cancel;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recorder:", e);
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setRecordingState("idle");
    setRecordDuration(0);
    setCancelThresholdReached(false);
    pointerOriginRef.current = null;
    activePointerIdRef.current = null;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
      activePointerIdRef.current = e.pointerId;
    } catch (err) {}
    pointerOriginRef.current = { x: e.clientX, y: e.clientY };
    startVoiceRecording();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement | HTMLButtonElement>) {
    if (!pointerOriginRef.current || recordingState !== "recording") return;
    const deltaX = pointerOriginRef.current.x - e.clientX;
    const deltaY = pointerOriginRef.current.y - e.clientY;

    if (deltaX > 75) {
      setCancelThresholdReached(true);
    } else {
      setCancelThresholdReached(false);
    }

    if (deltaY > 60) {
      setRecordingState("locked");
      if (activePointerIdRef.current != null) {
        try {
          e.currentTarget.releasePointerCapture(activePointerIdRef.current);
        } catch (err) {}
        activePointerIdRef.current = null;
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement | HTMLButtonElement>) {
    if (recordingState === "locked") return;
    if (recordingState === "recording") {
      const elapsedMs = Date.now() - recordStartTimeRef.current;
      if (cancelThresholdReached || elapsedMs < 500) {
        stopRecording(true);
      } else {
        stopRecording(false);
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

  const handleRetry = useCallback(
    (msg: ChatMessage) => {
      setErrorId(null);
      setErrorMessage(null);
      if (msg.retryData?.type === "text" && msg.retryData.body) {
        handleSend(msg.retryData.body, msg.id);
      } else if (
        msg.retryData?.type === "media" &&
        msg.retryData.file &&
        msg.retryData.filename &&
        msg.retryData.mimeType
      ) {
        processUpload(
          msg.retryData.file,
          msg.retryData.filename,
          msg.retryData.mimeType,
          msg.id
        );
      } else if (msg.body) {
        handleSend(msg.body, msg.id);
      }
    },
    [leadId, agentName, leadPhone, scrollDown]
  );

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
          const isPendingMsg = msg.status === "pending" || msg.pending;
          const isFailedMsg = msg.status === "failed" || msg.failed;
          const statusKey = String(msg.status ?? "").trim().toUpperCase();

          return (
            <div
              key={`${msg.id}-${statusKey}`}
              className={`${chatStyles.bubbleWrap} ${isOut ? chatStyles.bubbleWrapOut : chatStyles.bubbleWrapIn}`}
            >
              
              {!isOut && (
                <div className={chatStyles.inAvatar}>●</div>
              )}

              <div className={`${chatStyles.bubble} ${isOut ? chatStyles.bubbleOut : chatStyles.bubbleIn} ${isPendingMsg ? chatStyles.bubblePending : ""} ${isFailedMsg ? chatStyles.bubbleFailed : ""}`}>
                
                {/* Status Reply Badge */}
                {msg.isStatusReply && (
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#20C997", marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "0.3rem", background: "rgba(32,201,151,0.1)", padding: "0.2rem 0.5rem", borderRadius: "10px", width: "fit-content" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                    Replying to Status
                  </div>
                )}

                {/* Visual Media Rendering */}
                {(() => {
                  const mType = (msg.mediaType || "").toLowerCase();
                  const isImg = 
                    mType.startsWith("image/") ||
                    mType === "imagemessage" ||
                    mType.includes("image");

                  const isVid =
                    mType.startsWith("video/") ||
                    mType === "videomessage" ||
                    mType.includes("video");

                  const isAud =
                    !isVid && (
                      mType.startsWith("audio/") ||
                      mType === "audiomessage" ||
                      mType.includes("audio") ||
                      mType.includes("ogg") ||
                      mType.includes("opus") ||
                      mType.includes("webm") ||
                      mType.includes("wav") ||
                      mType.includes("m4a") ||
                      mType.includes("voice")
                    );

                  const isDoc =
                    mType.startsWith("application/") ||
                    mType === "documentmessage" ||
                    mType.includes("pdf") ||
                    mType.includes("document");

                  const hasMedia = isImg || isVid || isAud || isDoc || !!msg.mediaUrl;
                  const mediaSrc = msg.mediaUrl || (hasMedia ? `/api/media/${msg.id}` : null);

                  const isMediaFileName =
                    hasMedia &&
                    (isImg || isVid) &&
                    /\.(jpg|jpeg|png|webp|gif|mp4|mov|webm|mkv|3gp|avi)$/i.test(msg.body.trim());

                  const isFallbackText = 
                    !msg.body ||
                    msg.body.trim() === "Media Attachment" || 
                    msg.body.trim().startsWith("voice_note.") || 
                    msg.body.trim() === "Voice Note" ||
                    isMediaFileName;

                  const showCaption = !isFallbackText && msg.body.trim().length > 0;

                  return (
                    <>
                      {hasMedia && mediaSrc && (
                        <div style={{ marginBottom: showCaption ? "0.45rem" : "0.15rem" }}>
                          {isImg ? (
                            <a href={mediaSrc} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                              <img
                                src={mediaSrc}
                                alt={showCaption ? msg.body : "Image attachment"}
                                loading="lazy"
                                style={{
                                  maxWidth: "100%",
                                  maxHeight: "340px",
                                  borderRadius: "10px",
                                  display: "block",
                                  objectFit: "cover",
                                  border: "1px solid rgba(255,255,255,0.12)",
                                  cursor: "pointer",
                                  transition: "transform 0.15s ease",
                                }}
                              />
                            </a>
                          ) : isVid ? (
                            <video
                              controls
                              preload="metadata"
                              src={mediaSrc}
                              style={{
                                maxWidth: "100%",
                                maxHeight: "320px",
                                borderRadius: "10px",
                                display: "block",
                                border: "1px solid rgba(255,255,255,0.12)",
                              }}
                            />
                          ) : isAud ? (
                            <div style={{ padding: "0.15rem 0", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <VoiceNotePlayer src={mediaSrc} isOutbound={isOut} />
                            </div>
                          ) : (
                            <a
                              href={mediaSrc}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                padding: "0.5rem 0.75rem",
                                background: "rgba(255,255,255,0.06)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "8px",
                                textDecoration: "none",
                                color: "#20C997",
                              }}
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10 9 9 9 8 9"/>
                              </svg>
                              <span style={{ fontSize: "0.82rem", fontWeight: 600, wordBreak: "break-all" }}>
                                {showCaption ? msg.body : "Document Attachment"}
                              </span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Display actual text message/caption only (never fallback 'Media Attachment' text) */}
                      {(!hasMedia || showCaption) && (
                        <p className={chatStyles.bubbleText}>
                          {isFallbackText ? "" : msg.body}
                        </p>
                      )}
                    </>
                  );
                })()}
                <div className={chatStyles.bubbleMeta}>
                  <span className={chatStyles.bubbleTime}>{fmtTime(msg.sentAt)}</span>
                  {isOut && (
                    <span className={chatStyles.bubbleStatus}>
                      {msg.status === "failed" || msg.status === "FAILED" || msg.failed ? (
                        <span className={chatStyles.statusFailed}>
                          <span>⚠ Failed</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(msg);
                            }}
                            className={chatStyles.retryBtn}
                            title="Retry sending message"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                            Retry
                          </button>
                        </span>
                      ) : msg.status === "pending" || msg.status === "PENDING" || msg.status === "QUEUED" || msg.status === "0" || msg.pending ? (
                        <span className={chatStyles.statusClock} title="Sending…">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </span>
                      ) : (() => {
                        const raw = String(msg.status ?? "").trim().toUpperCase();
                        // Ack 3 = Read (Double Blue), Ack 4 = Played (Voice Note Double Blue)
                        const isPlayed = raw === "4" || raw === "PLAYED";
                        const isRead = raw === "3" || raw === "READ" || isPlayed;
                        // Ack 2 = Delivered (Double Grey)
                        const isDelivered = raw === "2" || raw === "DELIVERED";

                        // Absolute fallback 1: If message.status === "READ" (or ack === 3), render double blue tick
                        if (isRead) {
                          return (
                            <span
                              key={`read-${msg.id}-${raw}`}
                              className={chatStyles.statusRead}
                              style={{ color: "#53bdeb", display: "inline-flex", alignItems: "center" }}
                              title={isPlayed ? "Played" : "Read"}
                            >
                              <DoubleTickIcon color="#53bdeb" />
                            </span>
                          );
                        }

                        // Absolute fallback 2: If message.status === "DELIVERED" (or ack === 2), render double grey tick
                        if (isDelivered) {
                          return (
                            <span
                              key={`deliv-${msg.id}-${raw}`}
                              className={chatStyles.statusDelivered}
                              style={{ color: "#8696a0", display: "inline-flex", alignItems: "center" }}
                              title="Delivered"
                            >
                              <DoubleTickIcon color="#8696a0" />
                            </span>
                          );
                        }

                        // Default / Ack 1: Single grey tick (Sent)
                        return (
                          <span
                            key={`sent-${msg.id}-${raw}`}
                            className={chatStyles.statusSent}
                            style={{ color: "#8696a0", display: "inline-flex", alignItems: "center" }}
                            title="Sent"
                          >
                            <SingleTickIcon color="#8696a0" />
                          </span>
                        );
                      })()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ));
  }, [messages, handleRetry]);

  return (
    <>
      {/* ── Message feed ──────────────────────────────────────── */}
      <div className={chatStyles.feed}>
        {renderedMessages}

        {/* Error notice */}
        {errorId && (
          <div className={chatStyles.errorBanner}>
            {errorMessage || "⚠ Message failed to send. Check browser console (F12) for exact HTTP status & raw response."}
          </div>
        )}

        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* ── Dedicated Follow-Up Action Bar (Above Input) ─────── */}
      <div className={chatStyles.footerTopBar}>
        <button
          type="button"
          onClick={() => setShowFollowUpModal(true)}
          disabled={isPending || isUploading}
          className={chatStyles.updateFollowUpBtn}
          title="Update Follow-Up Status & Outcome (Not Responding, Interested, Callback...)"
        >
          <span>⏰</span>
          <span>Update Follow-Up Outcome</span>
        </button>
      </div>

      {/* ── Input bar ─────────────────────────────────────────── */}
      <div className={chatStyles.inputBar}>
        {recordingState !== "idle" ? (
          /* WhatsApp-Style Recording Bar */
          <div className={chatStyles.recordBar}>
            <div className={chatStyles.recordLeft}>
              <div className={chatStyles.pulseDot} />
              <span className={chatStyles.recordTimer}>
                {Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, "0")}
              </span>
            </div>

            {recordingState === "recording" && (
              <div
                className={chatStyles.slideCancelHint}
                style={{ color: cancelThresholdReached ? "#f87171" : "#9ca3af" }}
              >
                {cancelThresholdReached ? "Release to cancel" : "◀ Slide left to cancel"}
              </div>
            )}

            {recordingState === "locked" && (
              <button
                type="button"
                onClick={() => stopRecording(true)}
                className={chatStyles.cancelRecordBtn}
                title="Cancel voice recording"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Cancel</span>
              </button>
            )}

            {recordingState === "locked" ? (
              <button
                type="button"
                onClick={() => stopRecording(false)}
                className={chatStyles.prominentSendBtn}
                title="Send voice note"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            ) : (
              <div
                className={`${chatStyles.micRecordBtn} ${chatStyles.micRecordBtnActive}`}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => stopRecording(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                <div className={chatStyles.lockHint}>
                  ▲ Slide up to lock
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Normal Input Mode with Expansive Field & Dynamic Send Button */
          <>
            {/* Quick Menu Button */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                disabled={isPending || isUploading}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "rgba(32,201,151,0.12)",
                  border: "1px solid rgba(32,201,151,0.35)",
                  color: "#20C997",
                  fontSize: "1.3rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                title="Quick actions"
              >
                +
              </button>

              {/* Quick Menu Popup */}
              {showMenu && (
                <div style={{
                  position: "absolute",
                  bottom: "125%",
                  left: 0,
                  background: "#0a0a14",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "14px",
                  padding: "0.6rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  minWidth: "190px",
                  zIndex: 20,
                  boxShadow: "0 -4px 24px rgba(0,0,0,0.6)",
                }}>
                  <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "#8b8aa8", padding: "0.2rem 0.5rem", fontWeight: 700 }}>
                    Quick Actions
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const greeting = getRandomGreeting();
                      setText((prev) => (prev ? `${prev} ${greeting}` : greeting));
                      setShowMenu(false);
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                      }
                    }}
                    style={{
                      padding: "0.5rem 0.65rem",
                      borderRadius: "8px",
                      border: "1px solid rgba(32, 201, 151, 0.25)",
                      background: "rgba(32, 201, 151, 0.1)",
                      color: "#20C997",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <span>💬</span>
                    <span>Anti-Ban Greeting</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowFollowUpModal(true);
                    }}
                    style={{
                      padding: "0.5rem 0.65rem",
                      borderRadius: "8px",
                      border: "1px solid rgba(251, 146, 60, 0.25)",
                      background: "rgba(251, 146, 60, 0.1)",
                      color: "#fb923c",
                      textAlign: "left",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <span>⏰</span>
                    <span>Update Follow-Up</span>
                  </button>

                  <div style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "#8b8aa8", padding: "0.4rem 0.5rem 0.2rem", fontWeight: 700 }}>
                    Set Course Interest
                  </div>
                  {QUICK_COURSES.map((course) => (
                    <button
                      type="button"
                      key={course}
                      onClick={() => handleSetCourse(course)}
                      style={{
                        padding: "0.45rem 0.6rem",
                        borderRadius: "8px",
                        border: "none",
                        background: "rgba(255,255,255,0.03)",
                        color: "#f1f0ff",
                        textAlign: "left",
                        fontSize: "0.8rem",
                        cursor: "pointer",
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
              accept="image/*,video/*,.mp4,audio/*,application/pdf"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending || isUploading}
              className={chatStyles.iconActionBtn}
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

            {/* Expansive Text Input Field (Full Width Flexbox) */}
            <div className={chatStyles.inputWrap}>
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

            {/* Dynamic Swap: Prominent Send Button if text typed, WhatsApp Mic if empty */}
            {text.trim().length > 0 ? (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={isPending}
                className={chatStyles.prominentSendBtn}
                title="Send (Enter)"
              >
                {isPending ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                    </path>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            ) : (
              <button
                type="button"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => stopRecording(true)}
                disabled={isPending || isUploading}
                className={chatStyles.micRecordBtn}
                title="Hold to record, slide left to cancel, swipe up to lock"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      {showFollowUpModal && (
        <UpdateFollowUpModal
          leadId={leadId}
          leadName={leadName || "Lead"}
          activeFollowUpId={activeFollowUpId}
          onClose={() => setShowFollowUpModal(false)}
        />
      )}
    </>
  );
}
