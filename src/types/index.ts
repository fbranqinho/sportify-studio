import type { LucideIcon } from "lucide-react";

export type UserRole = "PLAYER" | "MANAGER" | "OWNER" | "PROMOTER" | "REFEREE";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  label?: string;
};

export type Location = {
  locationId: string;
  locationName: string;
  description: string;
  sportsOffered: string;
  address: string;
  availableTimes: string;
  pricing: string;
  suitabilityScore: number;
  image?: string;
  imageHint?: string;
};
