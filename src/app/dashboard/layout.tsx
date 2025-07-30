
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { getAuth, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserRoleSwitcher } from "@/components/user-role-switcher";
import { DashboardNav } from "@/components/dashboard-nav";
import { Icons } from "@/components/icons";
import type { User, UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Settings } from "lucide-react";
import { app, db } from "@/lib/firebase";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const auth = getAuth(app);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = { id: userDoc.id, ...userDoc.data() } as User;
          setUser(userData);
          if (!userData.profileCompleted) {
            router.push("/complete-profile");
          }
        } else {
          console.error("No user document found in Firestore, logging out.");
          await signOut(auth);
          router.push("/login");
        }
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, auth]);


  const handleRoleChange = (newRole: UserRole) => {
    if (user) {
      setUser({ ...user, role: newRole });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };
  
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child) && user) {
      return React.cloneElement(child, { role: user.role, userId: user.id } as any);
    }
    return child;
  });

  if (loading || !user || (user && !user.profileCompleted)) {
      return (
          <div className="flex items-center justify-center min-h-screen">
              <p>Loading...</p>
          </div>
      )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar variant="sidebar" collapsible="icon">
          <SidebarHeader className="items-center justify-center gap-2 data-[collapsible=icon]:-ml-1 data-[collapsible=icon]:justify-center">
            <Link href="/" className="flex items-center gap-2 font-headline text-2xl font-bold text-primary">
              <Icons.logo className="size-8" />
              <span className="duration-300 group-data-[collapsible=icon]:hidden">
                Sportify
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <DashboardNav role={user.role} />
          </SidebarContent>
          <SidebarFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex w-full cursor-pointer items-center gap-3 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-2 hover:bg-sidebar-accent rounded-md">
                   <Avatar className="size-10">
                    <AvatarImage src="https://placehold.co/100x100.png" alt={user.name} data-ai-hint="male profile"/>
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="group-data-[collapsible=icon]:hidden">
                    <p className="font-semibold font-headline">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()}</p>
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mb-2 ml-2" side="right" align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:text-red-500 focus:bg-red-50">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1">
              <UserRoleSwitcher role={user.role} onRoleChange={handleRoleChange} />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Notifications</span>
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 flex-col p-4 sm:p-6">{childrenWithProps}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
