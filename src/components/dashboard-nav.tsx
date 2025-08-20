

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { NavItem, UserRole } from "@/types";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Landmark,
  Ticket,
  Shield,
  Award,
  Map,
  Contact,
  CalendarCheck,
  Gamepad2,
  Calendar,
} from "lucide-react";

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["PLAYER", "MANAGER", "OWNER", "PROMOTER", "REFEREE", "ADMIN"] },
  { title: "Play Now", href: "/dashboard/games", icon: Map, roles: ["PLAYER", "MANAGER", "REFEREE"] },
  { title: "My Teams", href: "/dashboard/teams", icon: Users, roles: ["PLAYER", "MANAGER"] },
  { title: "My Games", href: "/dashboard/my-games", icon: Gamepad2, roles: ["PLAYER", "MANAGER", "REFEREE"] },
  { title: "My Stats", href: "/dashboard/stats", icon: BarChart3, roles: ["PLAYER"] },
  { title: "My Payments", href: "/dashboard/payments", icon: Landmark, roles: ["PLAYER", "MANAGER", "OWNER", "PROMOTER"] },
  { title: "My Competitions", href: "/dashboard/competitions", icon: Award, roles: ["MANAGER", "PROMOTER"] },
  // Owner specific ordered items
  { title: "My Schedule", href: "/dashboard/schedule", icon: CalendarCheck, roles: ["OWNER"] },
  { title: "My Pitches", href: "/dashboard/pitches", icon: Shield, roles: ["OWNER"] },
  { title: "My Promotions", href: "/dashboard/promos", icon: Ticket, roles: ["OWNER"] },
  // Promoter specific
  { title: "Network", href: "/dashboard/network", icon: Contact, roles: ["PROMOTER"] },
];

interface DashboardNavProps {
  role: UserRole;
}

export function DashboardNav({ role }: DashboardNavProps) {
  const pathname = usePathname();
  
  const ownerNavOrder: NavItem[] = [
    navItems.find(item => item.href === "/dashboard")!,
    navItems.find(item => item.href === "/dashboard/schedule")!,
    navItems.find(item => item.href === "/dashboard/pitches")!,
    navItems.find(item => item.href === "/dashboard/payments")!,
    navItems.find(item => item.href === "/dashboard/promos")!,
  ]

  let filteredNavItems: NavItem[];

  if (role === 'OWNER') {
      filteredNavItems = ownerNavOrder;
  } else {
      filteredNavItems = navItems.filter(item => item.roles.includes(role));
  }

  // A bit of a hack to rename the nav item dynamically without changing the array structure
  const findPitchItem = filteredNavItems.find(item => item.href === "/dashboard/games");
  if (findPitchItem) {
      if (role === 'PLAYER' || role === 'REFEREE') {
          findPitchItem.title = "Find a Game";
          findPitchItem.icon = Gamepad2;
      }
       if (role === 'MANAGER') {
          findPitchItem.title = "Find a Pitch";
          findPitchItem.icon = Map;
      }
  }


  return (
    <nav className="p-2">
      <SidebarMenu>
        {filteredNavItems.map((item) => {
          const isGameDetailsPage = /^\/dashboard\/games\/[a-zA-Z0-9]+$/.test(pathname);
          const isPitchesDetailsPage = /^\/dashboard\/pitches\/[a-zA-Z0-9]+$/.test(pathname);

          let isActive = false;
          if (isGameDetailsPage) {
              isActive = item.href === '/dashboard/my-games';
          } else if(isPitchesDetailsPage) {
              isActive = item.href === '/dashboard/games';
          }
          else {
              isActive = pathname.startsWith(item.href) && (item.href === '/dashboard' ? pathname === '/dashboard' : true);
          }
          
          return (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  className="font-semibold"
                  tooltip={item.title}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </nav>
  );
}
