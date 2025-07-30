

import type { LucideIcon } from "lucide-react";
import type { FieldValue } from "firebase/firestore";

export type UserRole = "PLAYER" | "MANAGER" | "OWNER" | "PROMOTER" | "REFEREE" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileCompleted: boolean;
  mobile?: string;
  birthDate?: string; // ISO 8601 string
  premiumPlan?: string;
  premiumPlanExpireDate?: string; // ISO 8601 string
}

export type DominantFoot = "left" | "right" | "both";
export type PlayerPosition = "Goalkeeper" | "Defender" | "Midfielder" | "Forward";

export interface PlayerProfile {
  id: string;
  userRef: string; // User ID
  nickname: string;
  city: string;
  position: PlayerPosition;
  dominantFoot: DominantFoot;
  photoUrl?: string;
  recentForm: ("W" | "D" | "L")[];

  // Attributes
  finishing: number;
  shotPower: number;
  longShots: number;
  heading: number;
  curve: number;
  marking: number;
  standingTackle: number;
  slidingTackle: number;
  crossing: number;
  shortPassing: number;
  longPassing: number;
  acceleration: number;
  stamina: number;
  strength: number;
  balance: number;
  agility: number;
  jumping: number;
  vision: number;
  aggression: number;
  reactions: number;
  interceptions: number;
  composure: number;
  ballControl: number;
  firstTouch: number;
  dribbling: number;
  defending: number;
  attacking: number;
  pace: number;
  overall: number;

  // Stats
  yellowCards: number;
  redCards: number;
  injuries: number;
  goals: number;
  assists: number;
  victories: number;
  defeats: number;
  draws: number;
  mvps: number;
  teamOfWeek: number;
  playerOfYear: number;

  // Status
  injured: boolean;
  suspended: boolean;
  availableToPlay: boolean;
  availableToJoinTeams: boolean;
}

export interface ManagerProfile {
    id: string;
    userRef: string; // User ID
    name: string;
    teams: string[]; // Team IDs
    tactics?: string;
    victories: number;
    defeats: number;
    draws: number;
}

export interface OwnerProfile {
    id: string;
    userRef?: string; // User ID
    pitches: string[]; // Pitch IDs
    description?: string;
    companyName?: string;
    companyNif?: string;
    companyAddress?: string;
    companyDocumentUrl?: string;
    latitude: number;
    longitude: number;
}

export interface PromoterProfile {
    id: string;
    userRef: string; // User ID
    company: string;
    photoUrl?: string;
    competitionsRef: string[]; // Competition IDs
}

export interface RefereeProfile {
    id: string;
    userRef: string; // User ID
    nickname: string;
    city: string;
    photoUrl?: string;
    yellowCards: number;
    redCards: number;
    matchesOfficiated: number;
    matches: string[]; // Match IDs
}

export interface AdminProfile {
  id: string;
  userRef: string; // User ID
  permissions: string[];
}

export interface TeamPlayer {
  playerId: string;
  number: number | null;
}

export interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  managerId: string; // User ID of the manager
  players: TeamPlayer[];
  playerIds: string[]; // For querying purposes
  city: string;
  motto?: string;
  foundationYear: number;
  competitions: string[]; // Competition IDs
  wins: number;
  draws: number;
  losses: number;
  yellowCards: number;
  redCards: number;
  suspensions: number;
  latePayments: number;
  debts: number;
}

export type InvitationStatus = "pending" | "accepted" | "declined";

export interface TeamInvitation {
    id: string;
    teamId: string;
    teamName: string;
    playerId: string;
    playerName: string;
    managerId: string;
    status: InvitationStatus;
    invitedAt: FieldValue;
    respondedAt?: FieldValue;
}


export type PitchSport = "fut7" | "fut11" | "fut5" | "futsal";

export interface Pitch {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
  photoUrl?: string;
  ownerRef: string; // OwnerProfile ID
  sport: PitchSport;
  coords: { lat: number; lng: number };
}

export type ReservationStatus = "Pending" | "Confirmed" | "Scheduled" | "Canceled";

export interface Reservation {
  id: string;
  date: string; // ISO 8601 string
  status: ReservationStatus;
  pitchId: string; 
  pitchName: string; 
  ownerProfileId: string; // OwnerProfile ID
  paymentRefs: string[]; 
  totalAmount: number;
  promoRef?: string; 
  
  // Actor details - denormalized for easier display
  actorId: string;
  actorName: string;
  actorRole: UserRole;

  // Add refs for different roles who can book
  managerRef?: string;
  playerRef?: string;
}


export type MatchStatus = "Scheduled" | "InProgress" | "Finished" | "Cancelled";

export interface MatchPlayerStat {
    playerRef: string; // PlayerProfile ID
    team: "A" | "B";
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    injured: boolean;
}

export interface Match {
    id: string;
    date: string; // ISO 8601 string
    teamARef?: string; // Team ID
    teamBRef?: string; // Team ID
    scoreA?: number;
    scoreB?: number;
    pitchRef?: string; // Pitch ID
    status?: MatchStatus;
    attendance?: number;
    playersStats: MatchPlayerStat[];
    refereeId?: string;
}

export type CompetitionFormat = "tournament" | "cup" | "pre-season";

export interface Competition {
  id: string;
  name: string;
  logoUrl?: string;
  startDate: string; // ISO 8601 string
  endDate: string; // ISO 8601 string
  pitches: string[]; // Pitch IDs
  teams: string[]; // Team IDs
  format: CompetitionFormat;
}

export type PaymentStatus = "Paid" | "Pending" | "Overdue" | "Cancelled";
export type PaymentType = "subscription" | "booking" | "fine" | "tournament_fee";

export interface Payment {
  id:string;
  playerRef?: string; // PlayerProfile ID
  ownerRef?: string; // OwnerProfile ID
  managerRef?: string; // ManagerProfile ID
  matchRef?: string; // Match ID
  competitionRef?: string; // Competition ID
  teamRef?: string; // Team ID
  type: PaymentType;
  amount: number;
  date?: string; // ISO 8601 string
  expirationDate?: string; // ISO 8601 string
  status: PaymentStatus;
  reminder?: boolean;
}

export interface Promo {
    id: string;
    name: string;
    discountPercent: number;
    validFrom: string; // ISO 8601 string
    validTo: string; // ISO 8601 string
    validHours: number[]; // e.g., [8, 9, 10] for 8h-10h
}

// For UI components
export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  label?: string;
};

export interface EnrichedPlayerSearchResult {
    profile: PlayerProfile;
    user: User;
}
