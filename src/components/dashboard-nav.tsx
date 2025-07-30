
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
  Mail,
  Swords,
} from "lucide-react";

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["PLAYER", "MANAGER", "OWNER", "PROMOTER", "REFEREE", "ADMIN"] },
  { title: "Find Game", href: "/dashboard/games", icon: Map, roles: ["PLAYER", "MANAGER", "OWNER", "REFEREE"] },
  { title: "Fields", href: "/dashboard/fields", icon: Shield, roles: ["OWNER"] },
  { title: "Schedule", href: "/dashboard/schedule", icon: CalendarCheck, roles: ["OWNER"] },
  { title: "Stats", href: "/dashboard/stats", icon: BarChart3, roles: ["PLAYER"] },
  { title: "My Teams", href: "/dashboard/teams", icon: Users, roles: ["PLAYER", "MANAGER", "PROMOTER"] },
  { title: "My Invitations", href: "/dashboard/invitations", icon: Mail, roles: ["PLAYER"] },
  { title: "My Games", href: "/dashboard/my-games", icon: Gamepad2, roles: ["PLAYER", "MANAGER", "REFEREE"] },
  { title: "My Payments", href: "/dashboard/payments", icon: Landmark, roles: ["PLAYER", "MANAGER", "OWNER", "PROMOTER"] },
  { title: "My Competitions", href: "/dashboard/competitions", icon: Award, roles: ["MANAGER", "PROMOTER"] },
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
