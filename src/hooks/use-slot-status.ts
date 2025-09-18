import * as React from "react";
import { getDay, getHours, getMonth, getYear, isBefore, startOfDay, getDate } from "date-fns";
import type { Match, Pitch, Promo, Reservation, User } from "@/types";
import { getPlayerCapacity } from "@/lib/utils";

export interface SlotInfo {
    status: "Available" | "Pending" | "Booked" | "OpenForPlayers" | "OpenForTeam" | "Past" | "Live";
    match?: Match;
    reservation?: Reservation;
    promotion?: Promo;
    price: number;
}

interface UseSlotStatusProps {
    day: Date;
    time: string;
    pitch: Pitch;
    user: User;
    reservations: Reservation[];
    matches: Match[];
    promos: Promo[];
}

export function useSlotStatus({
                                  day,
                                  time,
                                  pitch,
                                  user,
                                  reservations,
                                  matches,
                                  promos,
                              }: UseSlotStatusProps): SlotInfo {
    const slotStatus = React.useMemo((): SlotInfo => {
        const [slotHours] = time.split(":").map(Number);
        const slotDateTime = new Date(day);
        slotDateTime.setHours(slotHours, 0, 0, 0);

        // 1) Passado
        if (isBefore(slotDateTime, new Date())) {
            return {
                status: "Past",
                price: pitch.basePrice || 0,
                match: undefined,
                reservation: undefined,
                promotion: undefined,
            };
        }

        // 2) Procurar reserva e jogo para o slot
        const reservation = reservations.find((r) => {
            const resDate = r.date.toDate();
            if (r.status === "Canceled") return false;

            return (
                getYear(resDate) === getYear(slotDateTime) &&
                getMonth(resDate) === getMonth(slotDateTime) &&
                getDate(resDate) === getDate(slotDateTime) &&
                getHours(resDate) === getHours(slotDateTime)
            );
        });

        const match = reservation ? matches.find((m) => m.reservationRef === reservation.id) : undefined;

        // 3) Slot reservado (com ou sem match)
        if (reservation) {
            // 3.1) Jogo a decorrer
            if (match?.status === "InProgress") {
                return {
                    status: "Live",
                    match,
                    reservation,
                    price: reservation.totalAmount,
                    promotion: undefined,
                };
            }

            // 3.2) Oportunidades relacionadas com o match (se existir)
            if (match) {
                const isPracticeMatch = !!match.teamARef && !match.teamBRef;

                // Desafio para managers
                if (
                    isPracticeMatch &&
                    match.allowChallenges &&
                    user.role === "MANAGER" &&
                    match.managerRef !== user.id
                ) {
                    return {
                        status: "OpenForTeam",
                        match,
                        reservation,
                        price: 0,
                        promotion: undefined,
                    };
                }

                // Vagas para jogadores externos
                if (isPracticeMatch && match.allowExternalPlayers && user.role === "PLAYER") {
                    const totalPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
                    const capacity = getPlayerCapacity(pitch.sport);
                    if (capacity > 0 && totalPlayers < capacity) {
                        return {
                            status: "OpenForPlayers",
                            match,
                            reservation,
                            price: reservation.totalAmount / capacity,
                            promotion: undefined,
                        };
                    }
                }
            }

            // 3.3) Estado financeiro da reserva
            if (reservation.paymentStatus === "Paid") {
                return {
                    status: "Booked",
                    match,
                    reservation,
                    price: reservation.totalAmount,
                    promotion: undefined,
                };
            }

            return {
                status: "Pending",
                reservation,
                match,
                price: reservation.totalAmount,
                promotion: undefined,
            };
        }

        // 4) Slot disponível (sem reserva)
        const dayOfWeek = getDay(day);
        const applicablePromo = promos
            .filter((p) => {
                const validFrom = startOfDay(p.validFrom.toDate());
                const validTo = startOfDay(p.validTo.toDate());
                const currentDay = startOfDay(day);

                return (
                    currentDay >= validFrom &&
                    currentDay <= validTo &&
                    p.applicableDays.includes(dayOfWeek) &&
                    p.applicableHours.includes(slotHours) &&
                    (p.pitchIds.length === 0 || p.pitchIds.includes(pitch.id))
                );
            })
            .sort((a, b) => b.discountPercent - a.discountPercent)[0];

        const basePrice = pitch.basePrice || 0;
        const finalPrice = applicablePromo ? basePrice * (1 - applicablePromo.discountPercent / 100) : basePrice;

        return {
            status: "Available",
            promotion: applicablePromo,
            price: finalPrice,
            match: undefined,
            reservation: undefined,
        };
    }, [day, time, pitch, user, reservations, matches, promos]);

    return slotStatus;
}