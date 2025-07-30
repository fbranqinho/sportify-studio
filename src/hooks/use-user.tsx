
"use client";

import * as React from "react";
import { getAuth, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import type { User } from "@/types";
import { useRouter } from "next/navigation";

interface UserContextType {
  user: User | null;
  loading: boolean;
  firebaseUser: FirebaseUser | null;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = React.useState<FirebaseUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const auth = getAuth(app);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const userDocRef = doc(db, "users", fbUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = { id: userDoc.id, ...userDoc.data() } as User;
            setUser(userData);
          } else {
             console.error("No user document found in Firestore, logging out.");
             await signOut(auth);
             setUser(null);
             router.push("/login");
          }
        } catch(error) {
            console.error("Error fetching user document:", error);
            setUser(null);
        }

      } else {
        setUser(null);
        // Only push to login if not already on a public page
        const publicPages = ['/login', '/signup', '/'];
        if (!publicPages.includes(window.location.pathname)) {
            router.push("/login");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, router]);

  const value = { user, firebaseUser, loading };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = React.useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
