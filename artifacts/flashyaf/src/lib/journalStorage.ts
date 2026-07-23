import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type JournalStoragePref = "cloud" | "local";

export interface JournalEntry {
  id: string;
  userId: string;
  date: string;
  time: string;
  stage: string;
  notes: string;
  createdAt: number;
}

const LOCAL_KEY = "flashyaf_heat_log";
const PREF_KEY = "flashyaf_journal_storage_pref";

export function getJournalPreference(): JournalStoragePref | null {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === "cloud" || v === "local" ? v : null;
  } catch {
    return null;
  }
}

export function setJournalPreference(pref: JournalStoragePref): void {
  try { localStorage.setItem(PREF_KEY, pref); } catch { /* storage unavailable */ }
}

function loadLocalAll(): JournalEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalAll(entries: JournalEntry[]): void {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(entries)); } catch { /* storage unavailable */ }
}

// ── Save a journal entry according to the user's chosen storage location ──
export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  const pref = getJournalPreference() ?? "cloud"; // default to the safer, synced option
  if (pref === "cloud") {
    try {
      await setDoc(doc(db, "users", entry.userId, "journalEntries", entry.id), entry);
      return;
    } catch {
      // Fall back to local if the cloud write fails (e.g. offline), so the
      // note is never silently lost.
    }
  }
  const all = loadLocalAll();
  all.push(entry);
  saveLocalAll(all);
}

// ── Load all journal entries for this user, from wherever they're stored ──
export async function loadJournalEntries(userId: string): Promise<JournalEntry[]> {
  const pref = getJournalPreference() ?? "cloud";
  const localEntries = loadLocalAll().filter((e) => e.userId === userId);

  if (pref === "local") {
    return localEntries.sort((a, b) => b.createdAt - a.createdAt);
  }

  try {
    const snap = await getDocs(
      query(collection(db, "users", userId, "journalEntries"), orderBy("createdAt", "desc"))
    );
    const cloudEntries = snap.docs.map((d) => d.data() as JournalEntry);
    // Include any older local-only notes too, so nothing from before the
    // switch to cloud storage goes missing.
    const merged = [...cloudEntries, ...localEntries.filter(
      (le: JournalEntry) => !cloudEntries.some((ce: JournalEntry) => ce.id === le.id)
    )];
    return merged.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return localEntries.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function deleteJournalEntry(userId: string, id: string): Promise<void> {
  try { await deleteDoc(doc(db, "users", userId, "journalEntries", id)); } catch { /* may not exist in cloud */ }
  const all = loadLocalAll().filter((e) => e.id !== id);
  saveLocalAll(all);
}