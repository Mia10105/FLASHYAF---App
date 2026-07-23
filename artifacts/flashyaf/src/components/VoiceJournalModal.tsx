import { useState, useRef, useEffect } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";

interface Props {
  flashId: string;
  userId: string;
  onClose: () => void;
  onSaved: (url: string) => void;
}

type State = "idle" | "recording" | "preview" | "uploading" | "saved" | "error";
const MAX_SEC = 60;

export default function VoiceJournalModal({ flashId, userId, onClose, onSaved }: Props) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const mrRef   = useRef<MediaRecorder | null>(null);
  const chunks  = useRef<Blob[]>([]);
  const timer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const stream  = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function startRecording() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mr = new MediaRecorder(s, { mimeType: "audio/webm" });
      mrRef.current = mr;
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        setBlobUrl(URL.createObjectURL(blob));
        setState("preview");
      };
      mr.start(250);
      setState("recording");
      setElapsed(0);
      timer.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= MAX_SEC - 1) { stopRecording(); return MAX_SEC; }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setErrMsg("Microphone access denied. Please allow mic access and try again.");
      setState("error");
    }
  }

  function stopRecording() {
    if (timer.current) clearInterval(timer.current);
    mrRef.current?.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
  }

  async function saveNote() {
    if (!blobUrl || chunks.current.length === 0) return;
    setState("uploading");
    try {
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      const sRef = storageRef(storage, `flashAudio/${userId}/${flashId}.webm`);
      await uploadBytes(sRef, blob);
      const url = await getDownloadURL(sRef);
      await updateDoc(doc(db, "users", userId, "flashes", flashId), { audioNoteUrl: url });
      setState("saved");
      onSaved(url);
    } catch {
      setErrMsg("Save failed. Your Firebase Storage may need to be enabled. Check your Firebase console.");
      setState("error");
    }
  }

  const pct = (elapsed / MAX_SEC) * 100;
  const remaining = MAX_SEC - elapsed;

  return (
    <div style={m.backdrop} onClick={onClose}>
      <div style={m.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={m.handle} />
        <p style={m.title}>🎙️ Flash Journal</p>

        <p style={m.sub}>
          {state === "idle"      && "Speak for up to 60 seconds. What are you feeling right now?"}
          {state === "recording" && `Recording… ${remaining}s remaining`}
          {state === "preview"   && "Listen back. Save it or re-record."}
          {state === "uploading" && "Saving your voice note…"}
          {state === "saved"     && "✓ Voice note saved to your flash record."}
          {state === "error"     && errMsg}
        </p>

        {state === "recording" && (
          <div style={m.vizRow}>
            {[14, 26, 18, 36, 22, 30, 16, 24, 32, 12].map((h, i) => (
              <div key={i} style={{
                ...m.vizBar,
                height: `${h}px`,
                animationDelay: `${i * 90}ms`,
              }} />
            ))}
          </div>
        )}

        {state === "recording" && (
          <div style={m.progTrack}>
            <div style={{ ...m.progFill, width: `${pct}%` }} />
          </div>
        )}

        {state === "preview" && blobUrl && (
          <audio controls src={blobUrl} style={m.audio} />
        )}

        <div style={m.actions}>
          {state === "idle" && (
            <button style={m.recBtn} onClick={startRecording}>🎙️ Start Recording</button>
          )}
          {state === "recording" && (
            <button style={m.stopBtn} onClick={stopRecording}>⏹ Stop Recording</button>
          )}
          {state === "preview" && (<>
            <button style={m.saveBtn} onClick={saveNote}>💾 Save Voice Note</button>
            <button style={m.ghostBtn} onClick={() => { setBlobUrl(null); setState("idle"); setElapsed(0); }}>
              🔄 Re-record
            </button>
          </>)}
          {state === "saved" && (
            <button style={m.doneBtn} onClick={onClose}>✓ Done</button>
          )}
          {state === "error" && (
            <button style={m.ghostBtn} onClick={() => setState("idle")}>Try Again</button>
          )}
        </div>

        <button style={m.cancel} onClick={onClose}>
          {state === "saved" ? "Close" : "Cancel — Skip Note"}
        </button>
      </div>
    </div>
  );
}

const m: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, zIndex: 400,
    background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    background: "#1C1C1C", borderRadius: "24px 24px 0 0",
    padding: "20px 24px 48px", width: "100%", maxWidth: "480px",
    border: "1px solid rgba(255,255,255,0.1)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
  },
  handle: {
    width: "40px", height: "4px", borderRadius: "2px",
    background: "rgba(255,255,255,0.2)", flexShrink: 0, marginBottom: "4px",
  },
  title: { color: "#fff", fontSize: "20px", fontWeight: 900, margin: 0 },
  sub: {
    color: "rgba(255,255,255,0.45)", fontSize: "14px",
    textAlign: "center", lineHeight: 1.55, margin: 0,
  },
  vizRow: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: "5px", height: "44px",
  },
  vizBar: {
    width: "5px", borderRadius: "3px", background: "#C0392B",
    animation: "vizPulse 0.65s ease-in-out infinite alternate",
  },
  progTrack: {
    width: "100%", height: "4px", borderRadius: "2px",
    background: "rgba(255,255,255,0.1)",
  },
  progFill: {
    height: "100%", borderRadius: "2px",
    background: "linear-gradient(90deg, #C0392B, #FF6B35)",
    transition: "width 1s linear",
  },
  audio: { width: "100%", borderRadius: "12px" },
  actions: { display: "flex", flexDirection: "column", gap: "10px", width: "100%" },
  recBtn: {
    background: "linear-gradient(135deg, #C0392B, #E74C3C)",
    border: "none", borderRadius: "100px", color: "#fff",
    fontSize: "16px", fontWeight: 800, padding: "18px",
    cursor: "pointer", width: "100%", fontFamily: "'Inter', sans-serif",
    boxShadow: "0 0 24px rgba(192,57,43,0.5)",
  },
  stopBtn: {
    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "100px", color: "#fff",
    fontSize: "16px", fontWeight: 700, padding: "18px",
    cursor: "pointer", width: "100%", fontFamily: "'Inter', sans-serif",
  },
  saveBtn: {
    background: "linear-gradient(135deg, #1ABC9C, #16A085)",
    border: "none", borderRadius: "100px", color: "#fff",
    fontSize: "16px", fontWeight: 800, padding: "18px",
    cursor: "pointer", width: "100%", fontFamily: "'Inter', sans-serif",
    boxShadow: "0 0 20px rgba(26,188,156,0.38)",
  },
  ghostBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "100px", color: "rgba(255,255,255,0.5)",
    fontSize: "14px", fontWeight: 600, padding: "14px",
    cursor: "pointer", width: "100%", fontFamily: "'Inter', sans-serif",
  },
  doneBtn: {
    background: "rgba(26,188,156,0.12)", border: "1px solid rgba(26,188,156,0.3)",
    borderRadius: "100px", color: "#1ABC9C",
    fontSize: "16px", fontWeight: 800, padding: "18px",
    cursor: "pointer", width: "100%", fontFamily: "'Inter', sans-serif",
  },
  cancel: {
    background: "transparent", border: "none",
    color: "rgba(255,255,255,0.22)", fontSize: "13px",
    fontWeight: 600, cursor: "pointer", padding: "4px",
    fontFamily: "'Inter', sans-serif",
  },
};
