
// src/lib/mock-data.ts
import type {
  User,
  PlayerProfile,
  ManagerProfile,
  OwnerProfile,
  PromoterProfile,
  RefereeProfile,
  AdminProfile,
  Team,
  Pitch,
  Competition,
  Match,
  Payment,
  Reservation,
  TeamInvitation,
  Promo,
  UserRole,
} from "@/types";

const users: User[] = [
  { id: "user-player-1", name: "Bruno Fernandes", email: "bruno@test.com", role: "PLAYER", profileCompleted: true },
  { id: "user-manager-1", name: "José Mourinho", email: "jose@test.com", role: "MANAGER", profileCompleted: true },
  { id: "user-owner-1", name: "Jorge Mendes", email: "jorge@test.com", role: "OWNER", profileCompleted: true },
  { id: "user-promoter-1", name: "Pinto da Costa", email: "pinto@test.com", role: "PROMOTER", profileCompleted: true },
  { id: "user-referee-1", name: "Pedro Proença", email: "pedro@test.com", role: "REFEREE", profileCompleted: true },
  { id: "user-admin-1", name: "Admin User", email: "admin@test.com", role: "ADMIN", profileCompleted: true },
];

const playerProfiles: PlayerProfile[] = [
  {
    id: "pp-1",
    userRef: "user-player-1",
    nickname: "Bruno",
    city: "Porto",
    position: "Midfielder",
    dominantFoot: "right",
    recentForm: ["W", "D", "W", "L", "W"],
    finishing: 85, shotPower: 88, longShots: 90, heading: 60, curve: 85, marking: 65, standingTackle: 70, slidingTackle: 60,
    crossing: 88, shortPassing: 92, longPassing: 91, acceleration: 78, stamina: 92, strength: 70, balance: 75,
    agility: 80, jumping: 72, vision: 94, aggression: 78, reactions: 88, interceptions: 72, composure: 86,
    ballControl: 91, firstTouch: 89, dribbling: 85, defending: 68, attacking: 87, pace: 79, overall: 89,
    yellowCards: 5, redCards: 0, injuries: 1, goals: 12, assists: 15, victories: 20, defeats: 5, draws: 5,
    mvps: 8, teamOfWeek: 10, playerOfYear: 1,
    injured: false, suspended: false, availableToPlay: true, availableToJoinTeams: true,
  },
];

const managerProfiles: ManagerProfile[] = [
  { id: "mp-1", userRef: "user-manager-1", name: "José Mourinho", teams: ["team-1"], tactics: "4-2-3-1", victories: 150, defeats: 40, draws: 60 },
];

const ownerProfiles: OwnerProfile[] = [
    { id: "op-1", userRef: "user-owner-1", pitches: ["pitch-1", "pitch-2"], companyName: "Fields Inc.", latitude: 41.1579, longitude: -8.6291 },
];

const promoterProfiles: PromoterProfile[] = [
    { id: "promo-p-1", userRef: "user-promoter-1", company: "Super Events", competitionsRef: ["comp-1"] },
];

const refereeProfiles: RefereeProfile[] = [
    { id: "rp-1", userRef: "user-referee-1", nickname: "Proença", city: "Lisbon", yellowCards: 250, redCards: 20, matchesOfficiated: 500, matches: ["match-1"] },
];

const adminProfiles: AdminProfile[] = [
    { id: "ap-1", userRef: "user-admin-1", permissions: ["manage_users", "manage_content"] },
];

const teams: Team[] = [
  {
    id: "team-1",
    name: "Dragões FC",
    managerRef: "mp-1",
    players: [{ playerId: "pp-1", number: 8 }],
    city: "Porto",
    foundationYear: 2023,
    competitions: ["comp-1"],
    wins: 20, draws: 5, losses: 5,
    yellowCards: 30, redCards: 1, suspensions: 2,
    latePayments: 1, debts: 150,
  },
];

const pitches: Pitch[] = [
    { id: "pitch-1", name: "Estádio do Dragão", address: "Via Futebol Clube do Porto", city: "Porto", capacity: 50000, ownerRef: "op-1", sport: "fut11" },
    { id: "pitch-2", name: "Campo da Constituição", address: "Rua da Constituição", city: "Porto", capacity: 1000, ownerRef: "op-1", sport: "fut7" },
];

const competitions: Competition[] = [
    { id: "comp-1", name: "Liga Amadora do Porto", startDate: "2024-09-01", endDate: "2025-05-30", pitches: ["pitch-1", "pitch-2"], teams: ["team-1"], format: "tournament" },
];

const matches: Match[] = [
  {
    id: "match-1",
    date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(), // One week from now
    teamARef: "team-1",
    teamBRef: "team-2-placeholder", // Placeholder for another team
    pitchRef: "pitch-1",
    status: "Scheduled",
    playersStats: [],
    refereeId: "rp-1",
  },
];

const payments: Payment[] = [
  { id: "payment-1", playerRef: "pp-1", teamRef: "team-1", type: "fine", amount: 15, date: "2024-05-01", expirationDate: "2024-05-31", status: "Overdue", reminder: true },
];

const reservations: Reservation[] = [
    { id: "res-1", date: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString(), status: "Confirmed", pitchRef: "pitch-2", ownerRef: "op-1", managerRef: "mp-1", paymentRefs: [], totalAmount: 75 },
];

const teamInvitations: TeamInvitation[] = [
    { id: "inv-1", teamId: "team-1", playerId: "user-player-1-placeholder", managerId: "mp-1", status: "pending", invitedAt: new Date().toISOString() },
];

const promos: Promo[] = [
    { id: "promo-1", name: "Early Bird Discount", discountPercent: 20, validFrom: "2024-01-01T00:00:00Z", validTo: "2024-12-31T23:59:59Z", validHours: [8, 9, 10] },
];


export const mockData = {
    users,
    playerProfiles,
    managerProfiles,
    ownerProfiles,
    promoterProfiles,
    refereeProfiles,
    adminProfiles,
    teams,
    pitches,
    competitions,
    matches,
    payments,
    reservations,
    teamInvitations,
    promos,
};
