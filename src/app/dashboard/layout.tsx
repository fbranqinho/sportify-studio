"use client";

import Link from "next/link";
import * as React from "react";
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
import { UserRoleSwitcher } from "@/components/user-role-switcher";
import { DashboardNav } from "@/components/dashboard-nav";
import { Icons } from "@/components/icons";
import type { UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Bell, Settings } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = React.useState<UserRole>("PLAYER");

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
  };

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
          <SidebarFooter className="items-center gap-4 group-data-[collapsible=icon]:flex-col">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:flex-col">
              <Avatar className="size-10">
                <AvatarImage src="https://placehold.co/100x100.png" alt="@shadcn" />
                <AvatarFallback>FP</AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="font-semibold font-headline">First Player</p>
                <p className="text-sm text-muted-foreground">{role.toLowerCase()}</p>
              </div>
            </div>
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
          <main className="flex-1 flex-col p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
