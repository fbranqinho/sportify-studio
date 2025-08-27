

import type { LucideIcon } from "lucide-react";
import type { FieldValue, Timestamp } from "firebase/firestore";

export type UserRole = "PLAYER" | "MANAGER" | "OWNER" | "PROMOTER" | "REFEREE" | "ADMIN";

export interface User {
  id: string;
  name: string;
  name_lowercase?: string;
  email: string;
  role: UserRole;
  profileCompleted: boolean;
  mobile?: string;
  birthDate?: string; // ISO 8601 string
  premiumPlan?: string;
  premiumPlanExpireDate?: string; // ISO 8601 string
  createdAt: Timestamp;
  stripeRole?: string; // Added for Stripe subscription role
}

export type DominantFoot = "left" | "right" | "both";
export type PlayerPosition = "Goalkeeper" | "Defender" | "Midfielder" | "Forward";
export type PlayerExperience = "Amateur" | "Federated" | "Ex-Federated";

export interface PlayerProfile {
  id: string;
  userRef: string; // User ID
  nickname: string;
  city: string;
  position: PlayerPosition;
  dominantFoot: DominantFoot;
  photoUrl?: string;
  recentForm: ("W" | "D" | "L")[];
  createdAt?: Timestamp;
  experience: PlayerExperience;
  height?: number; // in cm
  weight?: number; // in kg

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

export type ManagerFootballType = 'fut7' | 'fut5' | 'futsal';

export interface ManagerProfile {
    id: string;
    userRef: string; // User ID
    name: string;
    teams: string[]; // Team IDs
    typeOfFootball?: ManagerFootballType;
    tactics?: string;
    victories: number;
    defeats: number;
    draws: number;
}

export interface OwnerProfile {
    id: string;
    userRef: string; // User ID
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
  playerId: string; // This is the userRef (User ID)
  number: number | null;
}

export interface Team {
  id: string;
  name: string;
  name_lowercase: string;
  logoUrl?: string;
  managerId: string; // User ID of the manager
  players: TeamPlayer[];
  playerIds: string[]; // Array of User IDs for querying purposes
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
  recentForm: ("W" | "D" | "L")[];
}

export type InvitationStatus = "pending" | "accepted" | "declined";

export interface TeamInvitation {
    id: string;
    teamId: string;
    teamName: string;
    playerId: string; // User ID of the invited player
    playerName: string;
    managerId: string;
    status: InvitationStatus;
    invitedAt: FieldValue;
    respondedAt?: FieldValue;
}

export interface MatchInvitation {
    id: string;
    matchId: string;
    teamId: string;
    playerId: string;
    managerId: string;
    status: InvitationStatus;
    invitedAt: FieldValue;
    respondedAt?: FieldValue;
}


export type PitchSport = "fut7" | "fut11" | "fut5" | "futsal";
export type Tactic = 
    | "Fut7_3-2-1" | "Fut7_2-3-1" | "Fut7_3-1-2" | "Fut7_2-2-2"
    | "Fut5_2-1-1" | "Fut5_1-2-1"
    | "Futsal_1-2-1" | "Futsal_2-2" | "Futsal_4-0";


export interface Pitch {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
  photoUrl?: string;
  ownerRef: string; // OwnerProfile ID
  sport: PitchSport;
  basePrice: number;
  coords: { lat: number; lng: number };
  allowPostGamePayments?: boolean;
}

export type ReservationStatus = "Pending" | "Confirmed" | "Scheduled" | "Canceled";
export type ReservationPaymentStatus = "Pending" | "Paid" | "Cancelled" | "Split";


export interface Reservation {
  id: string;
  date: string; // ISO 8601 string
  status: ReservationStatus;
  paymentStatus: ReservationPaymentStatus;
  pitchId: string; 
  pitchName: string; 
  ownerProfileId: string; // OwnerProfile ID
  paymentRefs: string[]; 
  totalAmount: number;
  promoRef?: string; 
  allowCancellationsAfterPayment?: boolean;
  
  // Actor details - denormalized for easier display
  actorId: string;
  actorName: string;
  actorRole: UserRole;

  // Add refs for different roles who can book
  managerRef?: string;
  playerRef?: string;
  teamRef?: string; // Optional: To associate reservation with a specific team
  createdAt?: Timestamp;
}


export type MatchStatus = "Collecting players" | "Scheduled" | "InProgress" | "Finished" | "Cancelled" ;

export type MatchEventType = "Goal" | "Assist" | "YellowCard" | "RedCard";

export interface MatchEvent {
  id: string; // Unique ID for the event
  type: MatchEventType;
  playerId: string;
  playerName: string;
  teamId: string;
  timestamp: Timestamp;
  minute?: number;
}

export type Formation = {
  [position: string]: string | null; // playerId or null
};

export interface TeamMatchDetails {
    tactic?: Tactic;
    captainId?: string;
    penaltyTakerId?: string;
    cornerTakerId?: string;
    freeKickTakerId?: string;
    formation?: Formation;
}

export interface Match {
    id: string;
    date: string; // ISO 8601 string
    teamARef: string | null;
    teamBRef: string | null;
    invitedTeamId?: string | null; // ID of the team invited, used with PendingOpponent status
    teamAPlayers: string[]; // Array of User IDs
    teamBPlayers: string[]; // Array of User IDs
    teamADetails?: TeamMatchDetails;
    teamBDetails?: TeamMatchDetails;
    playerApplications?: string[]; // Array of user IDs who applied to play
    scoreA: number;
    scoreB: number;
    pitchRef: string;
    status: MatchStatus;
    attendance: number;
    refereeId: string | null;
    managerRef: string | null;
    allowExternalPlayers?: boolean;
    allowChallenges?: boolean;
    reservationRef?: string; // ID of the reservation that created this match
    events?: MatchEvent[];
    finishTime?: Timestamp | null;
    mvpPlayerId?: string | null;
}

export interface TeamChallenge {
  id: string;
  challengerTeamId: string;
  challengerTeamName: string;
  challengerManagerId: string;
  status: 'pending' | 'accepted' | 'declined';
  challengedAt: Timestamp;
}


export interface MvpVote {
  id: string;
  voterId: string;
  votedForId: string;
  timestamp: FieldValue;
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

export type PaymentType = "subscription" | "booking" | "fine" | "tournament_fee" | "booking_split";
export type PaymentStatus = "Pending" | "Paid" | "Cancelled" | "Refunded";


export interface Payment {
  id:string;
  actorId?: string; // User ID of the person who has to pay (manager or player)
  playerRef?: string; // PlayerProfile ID
  ownerRef?: string; // OwnerProfile ID
  managerRef?: string; // ManagerProfile ID
  matchRef?: string; // Match ID
  competitionRef?: string; // Competition ID
  teamRef?: string; // Team ID
  reservationRef?: string; // Reservation ID
  type: PaymentType;
  amount: number;
  date: string; // ISO 8601 string
  expirationDate?: string; // ISO 8601 string
  status: PaymentStatus;
  notes?: string;
  reminder?: boolean;
  pitchName?: string;
  teamName?: string;
}

export interface Promo {
  id: string;
  ownerProfileId: string;
  name: string;
  discountPercent: number;
  validFrom: string; // ISO 8601 Date
  validTo: string; // ISO 8601 Date
  // Integer representation of day of week, 0 (Sunday) to 6 (Saturday)
  applicableDays: number[];
  // Hour of the day, 0-23
  applicableHours: number[];
  // Which pitches this promotion applies to. If empty, applies to all.
  pitchIds: string[];
  createdAt: FieldValue;
}


export interface Notification {
    id: string;
    userId?: string;
    ownerProfileId?: string; // To notify owners without needing their userId
    message: string;
    link: string;
    read: boolean;
    createdAt: Timestamp;
    type?: 'Challenge' | 'ChallengeResponse' | 'Generic';
    payload?: any;
}

// For UI components
export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  label?: string;
  premium?: boolean;
};

export interface EnrichedPlayerSearchResult {
    profile: PlayerProfile;
    user: User;
}
