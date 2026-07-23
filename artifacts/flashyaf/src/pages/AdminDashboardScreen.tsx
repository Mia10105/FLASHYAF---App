import { useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Flash } from "@/types/flash";

interface PendingStory {
  id: string; text: string; authorFirstName: string; city: string;
  userId: string; timestamp: number; resonates: number;
}
interface PendingHumor {
  id: string; text: string; authorFirstName: string; city: string;
  userId: string; timestamp: number;
}
interface PendingEnc {
  id: string; text: string; authorFirstName: string; city: string;
  userId: string; timestamp: number;
}
interface PendingCommunityPost {
  id: string; text: string; authorName: string;
  userId: string; timestamp: number; status: "pending" | "flagged";
}
interface PendingMoment {
  id: string; text: string; authorName: string;
  userId: string; timestamp: number;
}

interface Props {
  onBack: () => void;
}

interface FeedbackEntry {
  id: string;
  userId: string;
  userEmail: string;
  timestamp: number;
  loves: string;
  needsImprovement: string;
  missing: string;
  rating: number;
}

interface UserRow {
  uid: string;
  email: string;
  displayName: string | null;
  createdAt: number | null;
  lastActiveAt: number | null;
  flashCount: number;
  referralCode: string | null;
  referralCount: number;
}

function fmtDate(ms: number | null) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function tsToMs(ts: unknown): number | null {
  if (!ts) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts === "object" && ts !== null && "seconds" in ts) {
    return (ts as { seconds: number }).seconds * 1000;
  }
  return null;
}

export default function AdminDashboardScreen({ onBack }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [allFlashes, setAllFlashes] = useState<Flash[]>([]);
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([]);
  const [newsletterCount, setNewsletterCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [pendingStories, setPendingStories] = useState<PendingStory[]>([]);
  const [pendingHumor, setPendingHumor] = useState<PendingHumor[]>([]);
  const [pendingEnc, setPendingEnc] = useState<PendingEnc[]>([]);
  const [pendingPosts, setPendingPosts] = useState<PendingCommunityPost[]>([]);
  const [pendingMoments, setPendingMoments] = useState<PendingMoment[]>([]);

  useEffect(() => {
    async function load() {
      const usersSnap = await getDocs(collection(db, "users"));
      const userMap: Record<string, UserRow> = {};
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        userMap[d.id] = {
          uid: d.id,
          email: data.email || "unknown",
          displayName: data.displayName || null,
          createdAt: tsToMs(data.createdAt),
          lastActiveAt: tsToMs(data.lastActiveAt),
          flashCount: 0,
          referralCode: data.referralCode || null,
          referralCount: data.referralCount || 0,
        };
      });

      const flashesSnap = await getDocs(
        query(collectionGroup(db, "flashes"), orderBy("startTime", "asc"))
      );
      const flashes: Flash[] = flashesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as Flash));

      flashes.forEach((f) => {
        if (userMap[f.userId]) {
          userMap[f.userId].flashCount++;
          const flashEnd = f.endTime || f.startTime;
          const current = userMap[f.userId].lastActiveAt;
          if (!current || flashEnd > current) {
            userMap[f.userId].lastActiveAt = flashEnd;
          }
        }
      });

      const feedbackSnap = await getDocs(
        query(collection(db, "feedback"), orderBy("timestamp", "desc"))
      );
      const feedback: FeedbackEntry[] = feedbackSnap.docs.map((d) => ({
        id: d.id,
        userId: d.data().userId || "",
        userEmail: d.data().userEmail || "unknown",
        timestamp: d.data().timestamp || 0,
        loves: d.data().loves || "",
        needsImprovement: d.data().needsImprovement || "",
        missing: d.data().missing || "",
        rating: d.data().rating || 0,
      }));

      // Fix 4 — Load pending/flagged community feed posts
      const [pendingCommSnap, flaggedCommSnap] = await Promise.all([
        getDocs(query(collection(db, "community"), where("status", "==", "pending"))),
        getDocs(query(collection(db, "community"), where("status", "==", "flagged"))),
      ]).catch(() => [null, null]);
      const allCommPending: PendingCommunityPost[] = [];
      for (const snap of [pendingCommSnap, flaggedCommSnap]) {
        if (snap) {
          snap.docs.forEach((d) => allCommPending.push({
            id: d.id,
            text: d.data().text || "",
            authorName: d.data().authorName || "Anonymous",
            userId: d.data().userId || "",
            timestamp: d.data().timestamp || 0,
            status: d.data().status || "pending",
          }));
        }
      }
      allCommPending.sort((a, b) => a.timestamp - b.timestamp);
      setPendingPosts(allCommPending);

      // Load pending community review queues
      const [storiesSnap, humorSnap, encSnap] = await Promise.all([
        getDocs(query(collection(db, "stories"), where("status", "==", "pending"), orderBy("timestamp", "asc"))),
        getDocs(query(collection(db, "humorSubmissions"), where("status", "==", "pending"), orderBy("timestamp", "asc"))),
        getDocs(query(collection(db, "encouragementSubmissions"), where("status", "==", "pending"), orderBy("timestamp", "asc"))),
      ]).catch(() => [null, null, null]);

      if (storiesSnap) setPendingStories(storiesSnap.docs.map((d) => ({ id: d.id, text: d.data().text || "", authorFirstName: d.data().authorFirstName || "Anonymous", city: d.data().city || "", userId: d.data().userId || "", timestamp: d.data().timestamp || 0, resonates: d.data().resonates || 0 })));
      if (humorSnap) setPendingHumor(humorSnap.docs.map((d) => ({ id: d.id, text: d.data().text || "", authorFirstName: d.data().authorFirstName || "Anonymous", city: d.data().city || "", userId: d.data().userId || "", timestamp: d.data().timestamp || 0 })));
      if (encSnap) setPendingEnc(encSnap.docs.map((d) => ({ id: d.id, text: d.data().text || "", authorFirstName: d.data().authorFirstName || "Anonymous", city: d.data().city || "", userId: d.data().userId || "", timestamp: d.data().timestamp || 0 })));

      // Load pending hot moments
      getDocs(query(collection(db, "hotMoments"), where("status", "==", "pending"), orderBy("timestamp", "asc")))
        .then((snap) => setPendingMoments(snap.docs.map((d) => ({ id: d.id, text: d.data().text || "", authorName: d.data().authorName || "Anonymous", userId: d.data().userId || "", timestamp: d.data().timestamp || 0 }))))
        .catch(() => {});

      // Newsletter subscriber count
      getCountFromServer(collection(db, "newsletter"))
        .then((snap) => setNewsletterCount(snap.data().count))
        .catch(() => setNewsletterCount(0));

      setUsers(Object.values(userMap).sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0)));
      setAllFlashes(flashes);
      setFeedbackEntries(feedback);
      setLoading(false);
    }
    load();
  }, []);

  const totalUsers = users.length;
  const totalFlashes = allFlashes.length;

  const avgDuration =
    totalFlashes > 0
      ? allFlashes.reduce((s, f) => s + f.durationSeconds, 0) / totalFlashes
      : 0;

  let avgFlashesPerUserPerDay = 0;
  if (users.length > 0) {
    const perUserPerDay = users.map((u) => {
      if (u.flashCount === 0 || !u.createdAt) return 0;
      const daysSinceSignup = Math.max(
        1,
        (Date.now() - u.createdAt) / (1000 * 60 * 60 * 24)
      );
      return u.flashCount / daysSinceSignup;
    });
    avgFlashesPerUserPerDay =
      perUserPerDay.reduce((a, b) => a + b, 0) / perUserPerDay.length;
  }

  async function approveItem(collection_: string, id: string) {
    await updateDoc(doc(db, collection_, id), { status: "approved" }).catch(() => {});
    if (collection_ === "stories") setPendingStories((p) => p.filter((x) => x.id !== id));
    if (collection_ === "humorSubmissions") setPendingHumor((p) => p.filter((x) => x.id !== id));
    if (collection_ === "encouragementSubmissions") setPendingEnc((p) => p.filter((x) => x.id !== id));
  }

  async function rejectItem(collection_: string, id: string) {
    await updateDoc(doc(db, collection_, id), { status: "rejected" }).catch(() => {});
    if (collection_ === "stories") setPendingStories((p) => p.filter((x) => x.id !== id));
    if (collection_ === "humorSubmissions") setPendingHumor((p) => p.filter((x) => x.id !== id));
    if (collection_ === "encouragementSubmissions") setPendingEnc((p) => p.filter((x) => x.id !== id));
  }

  // Fix 4 — community post moderation
  async function approveCommunityPost(id: string) {
    await updateDoc(doc(db, "community", id), { status: "approved" }).catch(() => {});
    setPendingPosts((p) => p.filter((x) => x.id !== id));
  }
  async function rejectCommunityPost(id: string) {
    await updateDoc(doc(db, "community", id), { status: "rejected" }).catch(() => {});
    setPendingPosts((p) => p.filter((x) => x.id !== id));
  }

  function exportCSV() {
    const headers = [
      "userId", "userEmail", "flashId", "startTime", "endTime",
      "durationSeconds", "stagesCompleted", "maxStage",
    ];

    const rows = allFlashes.map((f) => {
      const maxStage = f.stages.reduce(
        (max, s) => {
          const order = ["STARTED", "PEAK", "COOLING_DOWN", "BACK_TO_NORMAL"];
          return order.indexOf(s.stage) > order.indexOf(max) ? s.stage : max;
        },
        "STARTED" as string
      );
      const userEmail = users.find((u) => u.uid === f.userId)?.email || f.userId;
      return [
        f.userId, userEmail, f.id || "",
        new Date(f.startTime).toISOString(),
        new Date(f.endTime).toISOString(),
        f.durationSeconds, f.stages.length, maxStage,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flashyaf-research-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <div style={styles.headerCenter}>
          <p style={styles.appName}>FLASHYAF™</p>
          <p style={styles.headerTitle}>Research Dashboard</p>
        </div>
        <button style={styles.exportBtn} onClick={exportCSV} disabled={loading || totalFlashes === 0}>
          ⬇ CSV
        </button>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>
          <p style={styles.loadingText}>Loading all user data...</p>
        </div>
      ) : (
        <div style={styles.scroll}>

          {/* Top Referrers */}
          {(() => {
            const topReferrers = [...users]
              .filter((u) => u.referralCount > 0)
              .sort((a, b) => b.referralCount - a.referralCount)
              .slice(0, 10);
            if (topReferrers.length === 0) return null;
            return (
              <div style={styles.sectionCard}>
                <p style={styles.sectionTitle}>📢 Top Referrers</p>
                {topReferrers.map((u, i) => (
                  <div key={u.uid} style={styles.referrerRow}>
                    <span style={{
                      ...styles.referrerRank,
                      background: i === 0 ? "rgba(255,215,0,0.2)" : i === 1 ? "rgba(192,192,192,0.15)" : i === 2 ? "rgba(205,127,50,0.15)" : "rgba(255,255,255,0.06)",
                      color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,0.4)",
                    }}>#{i + 1}</span>
                    <div style={styles.referrerInfo}>
                      <span style={styles.emailText} title={u.email}>{u.email}</span>
                      {u.referralCode && <span style={styles.subText}>Code: {u.referralCode}</span>}
                    </div>
                    <div style={styles.referralBadge}>
                      <span style={styles.referralBadgeNum}>{u.referralCount}</span>
                      <span style={styles.referralBadgeLabel}>referred</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div style={styles.statsGrid}>
            <StatBox label="Total Users" value={totalUsers.toString()} accent="var(--color-cool)" />
            <StatBox label="Total Flashes" value={totalFlashes.toString()} accent="var(--color-primary)" />
            <StatBox label="Avg Duration" value={totalFlashes > 0 ? fmtDuration(avgDuration) : "—"} accent="var(--color-accent)" />
            <StatBox
              label="Avg Flashes / User / Day"
              value={avgFlashesPerUserPerDay > 0 ? avgFlashesPerUserPerDay.toFixed(1) : "—"}
              accent="var(--color-accent)"
            />
            <StatBox
              label="Newsletter Subscribers"
              value={newsletterCount !== null ? newsletterCount.toString() : "—"}
              accent="#1ABC9C"
            />
          </div>

          <div style={styles.sectionCard}>
            <p style={styles.sectionTitle}>👥 All Users</p>
            {users.length === 0 ? (
              <p style={styles.emptyNote}>No users found.</p>
            ) : (
              <div style={styles.tableWrap}>
                <div style={{ ...styles.tableRow, ...styles.tableHeader }}>
                  <span style={{ ...styles.col, flex: "1 1 0", minWidth: 0 }}>Email</span>
                  <span style={{ ...styles.col, flex: "0 0 70px", textAlign: "center" as const }}>Flashes</span>
                  <span style={{ ...styles.col, flex: "0 0 80px", textAlign: "right" as const }}>Last Active</span>
                </div>
                {users.map((u) => (
                  <div key={u.uid} style={styles.tableRow}>
                    <div style={{ ...styles.col, flex: "1 1 0", minWidth: 0 }}>
                      <span style={styles.emailText} title={u.email}>{u.email}</span>
                      {u.createdAt && (
                        <span style={styles.subText}>Joined {fmtDate(u.createdAt)}</span>
                      )}
                    </div>
                    <div style={{ ...styles.col, flex: "0 0 70px", alignItems: "center" }}>
                      <span style={styles.flashCountBadge}>{u.flashCount}</span>
                    </div>
                    <div style={{ ...styles.col, flex: "0 0 80px", alignItems: "flex-end" }}>
                      <span style={styles.subText}>{fmtDate(u.lastActiveAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Hot Moments Review ── */}
          <div style={{ ...styles.sectionCard, border: pendingMoments.length > 0 ? "1px solid rgba(255,107,53,0.35)" : "1px solid rgba(255,255,255,0.07)" }}>
            <p style={styles.sectionTitle}>
              🔥 Hot Moments Review
              {pendingMoments.length > 0 && <span style={{ ...styles.pendingBadge, background: "rgba(255,107,53,0.15)", color: "rgba(255,107,53,0.9)", border: "1px solid rgba(255,107,53,0.3)" }}>{pendingMoments.length} pending</span>}
            </p>
            {pendingMoments.length === 0 ? (
              <p style={styles.emptyNote}>No hot moments awaiting review.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pendingMoments.map((m) => (
                  <div key={m.id} style={styles.reviewCard}>
                    <div style={styles.reviewMeta}>
                      <span style={styles.reviewAuthor}>{m.authorName}</span>
                      <span style={styles.reviewDate}>{fmtDate(m.timestamp)}</span>
                    </div>
                    <p style={styles.reviewText}>{m.text}</p>
                    <div style={styles.reviewActions}>
                      <button style={styles.approveBtn} onClick={async () => { await updateDoc(doc(db, "hotMoments", m.id), { status: "approved" }).catch(() => {}); setPendingMoments((p) => p.filter((x) => x.id !== m.id)); }}>✓ Approve</button>
                      <button style={styles.rejectBtn} onClick={async () => { await updateDoc(doc(db, "hotMoments", m.id), { status: "rejected" }).catch(() => {}); setPendingMoments((p) => p.filter((x) => x.id !== m.id)); }}>✕ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Community Feed Review ── */}
          <div style={{ ...styles.sectionCard, border: pendingPosts.length > 0 ? "1px solid rgba(255,69,0,0.3)" : "1px solid rgba(255,255,255,0.07)" }}>
            <p style={styles.sectionTitle}>
              💬 Community Feed Review
              {pendingPosts.length > 0 && <span style={{ ...styles.pendingBadge, background: "rgba(255,69,0,0.15)", color: "rgba(255,120,60,0.9)", border: "1px solid rgba(255,69,0,0.3)" }}>{pendingPosts.length} pending</span>}
            </p>
            {pendingPosts.length === 0 ? (
              <p style={styles.emptyNote}>No feed posts awaiting review.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pendingPosts.map((post) => (
                  <div key={post.id} style={styles.reviewCard}>
                    <div style={styles.reviewMeta}>
                      <span style={styles.reviewAuthor}>{post.authorName}</span>
                      <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {post.status === "flagged" && <span style={{ color: "#FF6B35", fontWeight: 700, fontSize: "10px", letterSpacing: "0.5px" }}>⚠ FLAGGED</span>}
                        <span style={styles.reviewDate}>{fmtDate(post.timestamp)}</span>
                      </span>
                    </div>
                    <p style={styles.reviewText}>{post.text}</p>
                    <div style={styles.reviewActions}>
                      <button style={styles.approveBtn} onClick={() => approveCommunityPost(post.id)}>✓ Approve</button>
                      <button style={styles.rejectBtn} onClick={() => rejectCommunityPost(post.id)}>✕ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Pending Stories Review ── */}
          <div style={{ ...styles.sectionCard, border: pendingStories.length > 0 ? "1px solid rgba(255,215,0,0.25)" : "1px solid rgba(255,255,255,0.07)" }}>
            <p style={styles.sectionTitle}>
              📖 Story Review Queue
              {pendingStories.length > 0 && <span style={styles.pendingBadge}>{pendingStories.length} pending</span>}
            </p>
            {pendingStories.length === 0 ? (
              <p style={styles.emptyNote}>No stories awaiting review.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {pendingStories.map((story) => (
                  <div key={story.id} style={styles.reviewCard}>
                    <div style={styles.reviewMeta}>
                      <span style={styles.reviewAuthor}>{story.authorFirstName} · {story.city}</span>
                      <span style={styles.reviewDate}>{fmtDate(story.timestamp)}</span>
                    </div>
                    <p style={styles.reviewText}>{story.text}</p>
                    <div style={styles.reviewActions}>
                      <button style={styles.approveBtn} onClick={() => approveItem("stories", story.id)}>✓ Approve & Feature</button>
                      <button style={styles.rejectBtn} onClick={() => rejectItem("stories", story.id)}>✕ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Pending Humor Review ── */}
          <div style={{ ...styles.sectionCard, border: pendingHumor.length > 0 ? "1px solid rgba(255,107,53,0.25)" : "1px solid rgba(255,255,255,0.07)" }}>
            <p style={styles.sectionTitle}>
              😂 Humor Bank Review
              {pendingHumor.length > 0 && <span style={{ ...styles.pendingBadge, background: "rgba(255,107,53,0.15)", color: "rgba(255,107,53,0.9)", border: "1px solid rgba(255,107,53,0.3)" }}>{pendingHumor.length} pending</span>}
            </p>
            {pendingHumor.length === 0 ? (
              <p style={styles.emptyNote}>No humor lines awaiting review.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pendingHumor.map((h) => (
                  <div key={h.id} style={styles.reviewCard}>
                    <div style={styles.reviewMeta}>
                      <span style={styles.reviewAuthor}>{h.authorFirstName} · {h.city}</span>
                      <span style={styles.reviewDate}>{fmtDate(h.timestamp)}</span>
                    </div>
                    <p style={styles.reviewText}>"{h.text}"</p>
                    <div style={styles.reviewActions}>
                      <button style={styles.approveBtn} onClick={() => approveItem("humorSubmissions", h.id)}>✓ Add to Humor Bank</button>
                      <button style={styles.rejectBtn} onClick={() => rejectItem("humorSubmissions", h.id)}>✕ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Pending Encouragement Review ── */}
          <div style={{ ...styles.sectionCard, border: pendingEnc.length > 0 ? "1px solid rgba(142,68,173,0.3)" : "1px solid rgba(255,255,255,0.07)" }}>
            <p style={styles.sectionTitle}>
              💜 Encouragement Bank Review
              {pendingEnc.length > 0 && <span style={{ ...styles.pendingBadge }}>{pendingEnc.length} pending</span>}
            </p>
            {pendingEnc.length === 0 ? (
              <p style={styles.emptyNote}>No encouragements awaiting review.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {pendingEnc.map((e) => (
                  <div key={e.id} style={styles.reviewCard}>
                    <div style={styles.reviewMeta}>
                      <span style={styles.reviewAuthor}>{e.authorFirstName} · {e.city}</span>
                      <span style={styles.reviewDate}>{fmtDate(e.timestamp)}</span>
                    </div>
                    <p style={styles.reviewText}>"{e.text}"</p>
                    <div style={styles.reviewActions}>
                      <button style={styles.approveBtn} onClick={() => approveItem("encouragementSubmissions", e.id)}>✓ Add to Enc. Bank</button>
                      <button style={styles.rejectBtn} onClick={() => rejectItem("encouragementSubmissions", e.id)}>✕ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Beta Tester Feedback */}
          <div style={styles.sectionCard}>
            <p style={styles.sectionTitle}>📝 Beta Tester Feedback ({feedbackEntries.length})</p>
            {feedbackEntries.length === 0 ? (
              <p style={styles.emptyNote}>No feedback submitted yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {feedbackEntries.map((fb) => (
                  <div key={fb.id} style={styles.feedbackCard}>
                    <div style={styles.feedbackHeader}>
                      <span style={styles.feedbackEmail}>{fb.userEmail}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={styles.feedbackRating}>
                          {"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}
                        </span>
                        <span style={styles.feedbackDate}>{fmtDate(fb.timestamp)}</span>
                      </div>
                    </div>
                    {fb.loves && (
                      <div style={styles.feedbackField}>
                        <span style={styles.feedbackFieldLabel}>💜 Loves</span>
                        <span style={styles.feedbackFieldValue}>{fb.loves}</span>
                      </div>
                    )}
                    {fb.needsImprovement && (
                      <div style={styles.feedbackField}>
                        <span style={styles.feedbackFieldLabel}>🔧 Needs improvement</span>
                        <span style={styles.feedbackFieldValue}>{fb.needsImprovement}</span>
                      </div>
                    )}
                    {fb.missing && (
                      <div style={styles.feedbackField}>
                        <span style={styles.feedbackFieldLabel}>✨ Missing</span>
                        <span style={styles.feedbackFieldValue}>{fb.missing}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.noteCard}>
            <p style={styles.noteText}>
              🔬 <strong>Research note:</strong> CSV export includes userId, email, flash timestamps, duration, stages completed, and max stage per flash. Suitable for anonymization and pattern analysis.
            </p>
          </div>

          <div style={{ height: "32px" }} />
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ ...styles.statBox, borderColor: accent + "44" }}>
      <span style={{ ...styles.statValue, color: accent }}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "var(--color-bg)",
    display: "flex",
    flexDirection: "column",
    maxWidth: "480px",
    margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 16px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    flexShrink: 0,
    gap: "8px",
  },
  backBtn: {
    background: "var(--color-card)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "100px",
    color: "var(--color-text)",
    fontSize: "12px",
    fontWeight: 600,
    padding: "8px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  headerCenter: {
    textAlign: "center",
    flex: 1,
  },
  appName: {
    color: "var(--color-accent)",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "2px",
    margin: "0 0 2px",
  },
  headerTitle: {
    color: "var(--color-text)",
    fontSize: "16px",
    fontWeight: 800,
    margin: 0,
  },
  exportBtn: {
    background: "rgba(26,188,156,0.15)",
    border: "1px solid rgba(26,188,156,0.35)",
    borderRadius: "100px",
    color: "var(--color-cool)",
    fontSize: "12px",
    fontWeight: 700,
    padding: "8px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  loadingBox: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "var(--color-text-muted)",
    fontSize: "14px",
  },
  scroll: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  statBox: {
    background: "var(--color-card)",
    border: "1px solid",
    borderRadius: "14px",
    padding: "16px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  statValue: {
    fontSize: "24px",
    fontWeight: 900,
    lineHeight: 1,
  },
  statLabel: {
    color: "var(--color-text-muted)",
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  sectionCard: {
    background: "var(--color-card)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "18px",
    padding: "18px",
  },
  sectionTitle: {
    color: "var(--color-text)",
    fontSize: "15px",
    fontWeight: 800,
    margin: "0 0 14px",
  },
  tableWrap: {
    display: "flex",
    flexDirection: "column",
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    gap: "8px",
  },
  tableHeader: {
    padding: "0 0 10px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    color: "var(--color-text-muted)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  col: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    overflow: "hidden",
  },
  emailText: {
    color: "var(--color-text)",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "block",
  },
  subText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "11px",
    whiteSpace: "nowrap",
  },
  flashCountBadge: {
    background: "rgba(192,57,43,0.2)",
    color: "var(--color-primary)",
    borderRadius: "100px",
    padding: "3px 10px",
    fontSize: "13px",
    fontWeight: 800,
  },
  noteCard: {
    background: "rgba(245,166,35,0.06)",
    border: "1px solid rgba(245,166,35,0.18)",
    borderRadius: "14px",
    padding: "14px 16px",
  },
  noteText: {
    color: "var(--color-text-muted)",
    fontSize: "12px",
    lineHeight: 1.6,
    margin: 0,
  },
  emptyNote: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "13px",
    textAlign: "center",
    padding: "12px 0",
    margin: 0,
  },
  referrerRow: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  referrerRank: {
    width: "32px", height: "32px", borderRadius: "8px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "12px", fontWeight: 800, flexShrink: 0,
  },
  referrerInfo: {
    flex: 1, display: "flex", flexDirection: "column", gap: "2px", minWidth: 0,
  },
  referralBadge: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "1px", flexShrink: 0,
  },
  referralBadgeNum: {
    color: "#8E44AD", fontSize: "20px", fontWeight: 900, lineHeight: 1,
  },
  referralBadgeLabel: {
    color: "rgba(142,68,173,0.6)", fontSize: "9px", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.5px",
  },
  pendingBadge: {
    display: "inline-block", marginLeft: "8px",
    background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)",
    borderRadius: "100px", color: "rgba(255,215,0,0.9)",
    fontSize: "10px", fontWeight: 800, padding: "2px 10px",
    verticalAlign: "middle",
  },
  reviewCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px",
  },
  reviewMeta: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
  },
  reviewAuthor: {
    color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 700,
  },
  reviewDate: {
    color: "rgba(255,255,255,0.3)", fontSize: "11px",
  },
  reviewText: {
    color: "rgba(255,255,255,0.82)", fontSize: "13px", lineHeight: 1.55, margin: 0,
  },
  reviewActions: {
    display: "flex", gap: "8px",
  },
  approveBtn: {
    flex: 1, borderRadius: "10px", cursor: "pointer",
    background: "rgba(26,188,156,0.15)", border: "1px solid rgba(26,188,156,0.35)",
    color: "#1ABC9C", fontSize: "12px", fontWeight: 800,
    padding: "9px 8px", fontFamily: "'Inter', sans-serif",
  },
  rejectBtn: {
    flex: 1, borderRadius: "10px", cursor: "pointer",
    background: "rgba(231,76,60,0.1)", border: "1px solid rgba(231,76,60,0.25)",
    color: "#E74C3C", fontSize: "12px", fontWeight: 800,
    padding: "9px 8px", fontFamily: "'Inter', sans-serif",
  },
  feedbackCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(245,166,35,0.15)",
    borderRadius: "14px",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  feedbackHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
    flexWrap: "wrap" as const,
  },
  feedbackEmail: {
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    flex: 1,
    minWidth: 0,
  },
  feedbackRating: {
    color: "#F5A623",
    fontSize: "13px",
    letterSpacing: "1px",
    flexShrink: 0,
  },
  feedbackDate: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "11px",
    flexShrink: 0,
  },
  feedbackField: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  feedbackFieldLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  feedbackFieldValue: {
    color: "rgba(255,255,255,0.75)",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};
