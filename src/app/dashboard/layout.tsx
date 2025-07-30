
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { getAuth, signOut } from "firebase/auth";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
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
import type { UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Settings } from "lucide-react";
import { app } from "@/lib/firebase";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = React.useState<UserRole>("PLAYER");
  const [name, setName] = React.useState("User");
  const router = useRouter();
  const auth = getAuth(app);

  React.useEffect(() => {
    // Check for mock user role in local storage for testing
    const mockRole = localStorage.getItem('mockUserRole') as UserRole;
    const mockName = localStorage.getItem('mockUserName');
    if (mockRole) {
      setRole(mockRole);
    }
    if (mockName) {
      setName(mockName);
    }

    const unsubscribe = auth.onAuthStateChanged(user => {
        if (user) {
            // If a real user is logged in, you'd fetch their role from Firestore
            // For now, we'll keep the mock logic simple
            if (!mockRole) {
                // Fetch user data from firestore and set role and name
            }
        } else if (!mockRole) {
            router.push('/login');
        }
    });

    return () => unsubscribe();
  }, [router]);


  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('mockUserRole', newRole);
    // This is a simple mock implementation, a real app would update the user in the DB
    // and might require re-authentication or a page reload to get new data.
    // For now, we find the first user with the new role and switch to them.
    const newUser = mockData.users.find(u => u.role === newRole);
    if (newUser) {
        localStorage.setItem('mockUserId', newUser.id);
        localStorage.setItem('mockUserName', newUser.name);
        setName(newUser.name);
        // Force a reload of the page to fetch new data for the new user role.
        window.location.reload();
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('mockUserId');
      localStorage.removeItem('mockUserRole');
      localStorage.removeItem('mockUserName');
      router.push("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };
  
  // Pass role to children that are React components
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { role } as any);
    }
    return child;
  });


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
            <DashboardNav role={role} />
          </SidebarContent>
          <SidebarFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex w-full cursor-pointer items-center gap-3 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:py-2 hover:bg-sidebar-accent rounded-md">
                   <Avatar className="size-10">
                    <AvatarImage src="https://placehold.co/100x100.png" alt="@shadcn" data-ai-hint="male profile"/>
                    <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="group-data-[collapsible=icon]:hidden">
                    <p className="font-semibold font-headline">{name}</p>
                    <p className="text-sm text-muted-foreground">{role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()}</p>
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
              <UserRoleSwitcher role={role} onRoleChange={handleRoleChange} />
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
