import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        // If this account has a pending 90-day deletion, logging back in
        // IS the "I changed my mind" signal per the agreed design — cancel
        // it automatically, no prompt needed.
        (async () => {
          try {
            const profileSnap = await getDoc(doc(db, "users", u.uid));
            if (profileSnap.exists() && profileSnap.data().deletionRequested === true) {
              const cancelPendingDeletion = httpsCallable(functions, "cancelPendingDeletion");
              await cancelPendingDeletion();
            }
          } catch {
            // Non-fatal — if this check fails, the scheduled sweep still
            // won't run for 90 days, so there's no urgency to retry here.
          }
        })();
      }
    });
    return unsubscribe;
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
