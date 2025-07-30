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
  Calendar,
  Contact,
} from "lucide-react";

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["PLAYER", "MANAGER", "OWNER", "PROMOTER", "REFEREE", "ADMIN"] },
  { title: "Stats", href: "/dashboard/stats", icon: BarChart3, roles: ["PLAYER"] },
  { title: "Teams", href: "/dashboard/teams", icon: Users, roles: ["PLAYER", "MANAGER", "PROMOTER"] },
  { title: "Games", href: "/dashboard/games", icon: Calendar, roles: ["PLAYER", "MANAGER", "OWNER", "REFEREE"] },
  { title: "Payments", href: "/dashboard/payments", icon: Landmark, roles: ["PLAYER", "MANAGER", "OWNER", "PROMOTER"] },
  { title: "Competitions", href: "/dashboard/competitions", icon: Award, roles: ["MANAGER", "PROMOTER"] },
  { title: "My Fields", href: "/dashboard/fields", icon: Shield, roles: ["OWNER"] },
  { title: "Promotions", href: "/dashboard/promos", icon: Ticket, roles: ["OWNER"] },
  { title: "Network", href: "/dashboard/network", icon: Contact, roles: ["PROMOTER"] },
];

interface DashboardNavProps {
  role: UserRole;
}

export function DashboardNav({ role }: DashboardNavProps) {
  const pathname = usePathname();
  const filteredNavItems = navItems.filter(item => item.roles.includes(role));

  return (
    <nav className="p-2">
      <SidebarMenu>
        {filteredNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href}
                className="font-semibold"
                tooltip={item.title}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}
