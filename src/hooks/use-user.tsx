
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
        try {
          const userDocRef = doc(db, "users", fbUser.uid);

          const unsubUser = onSnapshot(userDocRef, async (userDoc) => {
            if (userDoc.exists()) {
              const userData = { id: userDoc.id, ...userDoc.data() } as User;
              
              // Get custom claims from the ID token
              const idTokenResult = await fbUser.getIdTokenResult();
              const stripeRole = idTokenResult.claims.stripeRole as string | undefined;

              if (stripeRole) {
                userData.premiumPlan = stripeRole;
              }
              
              setUser(userData);
            } else {
              console.error("No user document found in Firestore, logging out.");
              await signOut(auth);
              setUser(null);
              router.push("/login");
            }
          });

          return () => unsubUser(); // Return the user snapshot listener for cleanup

        } catch(error) {
            console.error("Error fetching user document:", error);
            setUser(null);
            setLoading(false);
        }
      } else {
        setUser(null);
        const publicPages = ['/login', '/signup', '/'];
        if (!publicPages.includes(window.location.pathname)) {
            router.push("/login");
        }
      }
       if (loading) {
            setLoading(false);
       }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
