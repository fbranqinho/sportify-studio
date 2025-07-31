
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { getAuth, signOut } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, getDocs, orderBy, limit, updateDoc } from "firebase/firestore";
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
import { DashboardNav } from "@/components/dashboard-nav";
import { Icons } from "@/components/icons";
import type { User, UserRole, Notification, OwnerProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Settings, Check } from "lucide-react";
import { app, db } from "@/lib/firebase";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { UserProvider, useUser } from "@/hooks/use-user";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

function NotificationBell() {
  const { user } = useUser();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | undefined;

    const handleSnapshot = (snapshot: any) => {
        const notifs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Notification));
        // Sort notifications by date client-side
        notifs.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        setNotifications(notifs);
        const unread = notifs.filter(n => !n.read).length;
        setUnreadCount(unread);
    };

    const handleError = (error: any) => {
         console.error("Error fetching notifications (check Firestore indexes):", error);
    };

    if (user.role === 'OWNER') {
        const q = query(collection(db, "ownerProfiles"), where("userRef", "==", user.id), limit(1));
        getDocs(q).then(profileSnapshot => {
            if (!profileSnapshot.empty) {
                const ownerProfileId = profileSnapshot.docs[0].id;
                // Query without ordering, as it requires a composite index
                const notifQuery = query(
                    collection(db, "notifications"),
                    where("ownerProfileId", "==", ownerProfileId),
                    limit(10)
                );
                unsubscribe = onSnapshot(notifQuery, handleSnapshot, handleError);
            }
        });
    } else {
        const notifQuery = query(
          collection(db, "notifications"),
          where("userId", "==", user.id),
          orderBy("createdAt", "desc"),
          limit(10)
        );
        unsubscribe = onSnapshot(notifQuery, handleSnapshot, handleError);
    }

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [user]);

  const handleMarkAsRead = async (notificationId: string) => {
    const notifRef = doc(db, "notifications", notificationId);
    await updateDoc(notifRef, { read: true });
  };
  
  const handleOpenChange = (open: boolean) => {
      setIsPopoverOpen(open);
      if(open && unreadCount > 0) {
          // Mark all visible notifications as read
          notifications.forEach(n => {
              if(!n.read) {
                  handleMarkAsRead(n.id);
              }
          })
      }
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-lg">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
                 {notifications.length > 0 ? (
                    <div className="space-y-4">
                        {notifications.map(n => (
                            <Link href={n.link} key={n.id} className="block hover:bg-muted -mx-2 px-2 py-2 rounded-md" onClick={() => handleMarkAsRead(n.id)}>
                                <div className="flex items-start gap-3">
                                    <div className={`mt-1 h-2 w-2 rounded-full ${!n.read ? 'bg-primary' : 'bg-transparent'}`} />
                                    <div className="flex-1">
                                        <p className={`text-sm font-medium ${!n.read ? 'font-semibold' : ''}`}>{n.message}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {n.createdAt ? formatDistanceToNow(new Date(n.createdAt.seconds * 1000), { addSuffix: true }) : 'just now'}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        You have no notifications.
                    </div>
                )}
            </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}


function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const auth = getAuth(app);

  React.useEffect(() => {
    if (!loading && user && !user.profileCompleted) {
      router.push("/complete-profile");
    }
  }, [user, loading, router]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (user && !user.profileCompleted) {
    return (
       <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting to complete your profile...</p>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar variant="sidebar" collapsible="icon">
          <SidebarHeader className="items-center justify-center gap-2 data-[collapsible=icon]:-ml-1 data-[collapsible=icon]:justify-center">
            <Link href="/" className="flex items-center gap-2 font-headline text-2xl font-bold text-primary">
              <Icons.logo className="size-20" />
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
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
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
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 flex-col p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <DashboardContent>{children}</DashboardContent>
    </UserProvider>
  )
}
