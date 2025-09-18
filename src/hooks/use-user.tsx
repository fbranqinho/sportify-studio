
"use client";

import * as React from "react";
import { getAuth, onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
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
        const userDocRef = doc(db, "users", fbUser.uid);
        const unsubUser = onSnapshot(userDocRef, async (userDoc) => {
          if (userDoc.exists()) {
            const userData = { id: userDoc.id, ...userDoc.data() } as User;
            
            // Get custom claims from the ID token
            const idTokenResult = await fbUser.getIdTokenResult(true); // Force refresh
            const stripeRole = idTokenResult.claims.stripeRole as string | undefined;

            userData.premiumPlan = stripeRole || undefined;
            
            setUser(userData);
          } else {
            console.log("User document not found yet for uid:", fbUser.uid);
            setUser(null); // Explicitly set user to null if document doesn't exist
          }
           setLoading(false); // Set loading to false once we have a definitive answer
        });
        return () => unsubUser();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

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
