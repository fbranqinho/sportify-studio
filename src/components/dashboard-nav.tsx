

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
import { useUser } from "@/hooks/use-user";

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["PLAYER", "MANAGER", "OWNER", "PROMOTER", "REFEREE", "ADMIN"] },
  { title: "Play Now", href: "/dashboard/games", icon: Gamepad2, roles: ["PLAYER", "MANAGER", "REFEREE"] },
  { title: "My Teams", href: "/dashboard/teams", icon: Users, roles: ["PLAYER", "MANAGER"] },
  { title: "My Games", href: "/dashboard/my-games", icon: Gamepad2, roles: ["PLAYER", "MANAGER", "REFEREE"] },
  { title: "My Stats", href: "/dashboard/stats", icon: BarChart3, roles: ["PLAYER"], premium: true },
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
  const { user } = useUser();
  
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
      filteredNavItems = navItems.filter(item => {
        const roleMatch = item.roles.includes(role);
        if (!roleMatch) return false;
        // If item requires premium, check user plan
        if (item.premium) {
            return !!user?.premiumPlan;
        }
        return true;
      });
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
