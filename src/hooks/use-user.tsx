
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

          // Listen for changes on both the user and their stripe customer document
          const unsubUser = onSnapshot(userDocRef, async (userDoc) => {
            if (userDoc.exists()) {
              const userData = { id: userDoc.id, ...userDoc.data() } as User;
              
              // Now check for Stripe role
              const customerDocRef = doc(db, "customers", fbUser.uid);
              const customerDoc = await getDoc(customerDocRef);

              if (customerDoc.exists()) {
                  const customerData = customerDoc.data();
                  const subscriptions = customerData.subscriptions;
                  if (subscriptions && subscriptions.length > 0) {
                      // Find an active subscription
                      const activeSub = subscriptions.find((sub: any) => sub.status === 'active');
                      if (activeSub) {
                          // Get the role from the first price's metadata
                          const role = activeSub.items[0]?.price?.product?.metadata?.stripeRole;
                          if (role) {
                              userData.premiumPlan = role;
                          }
                      }
                  }
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
        // Only push to login if not already on a public page
        const publicPages = ['/login', '/signup', '/'];
        if (!publicPages.includes(window.location.pathname)) {
            router.push("/login");
        }
      }
      // Set loading to false after initial check is done
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
