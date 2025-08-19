
import * as React from "react";
import { getDay, getHours, getMonth, getYear, isBefore, startOfDay, getDate } from "date-fns";
import type { Match, Pitch, Promo, Reservation, User } from "@/types";
import { getPlayerCapacity } from "@/lib/utils";

export interface SlotInfo {
  status: 'Available' | 'Pending' | 'Booked' | 'OpenForPlayers' | 'OpenForTeam' | 'Past' | 'Live';
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

export function useSlotStatus({ day, time, pitch, user, reservations, matches, promos }: UseSlotStatusProps): SlotInfo {
  const slotStatus = React.useMemo(() => {
    const [slotHours] = time.split(':').map(Number);
    const slotDateTime = new Date(day);
    slotDateTime.setHours(slotHours, 0, 0, 0);

    // 1. Is the slot in the past?
    if (isBefore(slotDateTime, new Date())) {
      return { status: 'Past', price: pitch.basePrice || 0 };
    }

    // 2. Find reservation and match for this specific slot.
    const reservation = reservations.find(r => {
      const resDate = new Date(r.date);
      // Ignore cancelled reservations for slot availability checks
      if (r.status === 'Canceled') return false;

      return getYear(resDate) === getYear(slotDateTime) &&
             getMonth(resDate) === getMonth(slotDateTime) &&
             getDate(resDate) === getDate(slotDateTime) &&
             getHours(resDate) === getHours(slotDateTime);
    });

    const match = reservation ? matches.find(m => m.reservationRef === reservation.id) : undefined;

    // 3. Handle slots that have a reservation.
    if (reservation) {
      // 3a. If the reservation is still pending owner approval, the slot is pending.
      if (reservation.status === 'Pending') {
        return { status: 'Pending', reservation, price: reservation.totalAmount };
      }
      
      // If there's a match associated
      if (match) {
        if (match.status === 'InProgress') {
          return { status: 'Live', match, reservation, price: reservation.totalAmount };
        }
        if (match.status === 'Finished' || match.status === 'Cancelled') {
          return { status: 'Booked', match, reservation, price: reservation.totalAmount };
        }
        
        // If the reservation is NOT paid, it might be open for actions
        if (reservation.paymentStatus !== 'Paid') {
          const isPracticeMatch = !!match.teamARef && !match.teamBRef;

          // Opportunity to Challenge
          if (
            isPracticeMatch &&
            match.allowChallenges &&
            user.role === 'MANAGER' &&
            match.managerRef !== user.id
          ) {
            return { status: 'OpenForTeam', match, reservation, price: 0 };
          }
          
          // Opportunity to Apply as Player
          const totalPlayers = (match.teamAPlayers?.length || 0) + (match.teamBPlayers?.length || 0);
          const capacity = getPlayerCapacity(pitch.sport);
          if (
            isPracticeMatch &&
            match.allowExternalPlayers &&
            user.role === 'PLAYER' &&
            totalPlayers < capacity
          ) {
            return { status: 'OpenForPlayers', match, reservation, price: reservation.totalAmount / capacity };
          }

           // If no other action is available but it's not paid, it's pending payment/players.
           return { status: 'Pending', reservation, match, price: reservation.totalAmount };
        }
      }
      
      // 3b. If not interactive, it's definitively booked if paid or has two teams.
      if (reservation.paymentStatus === 'Paid' || (match && match.teamBRef)) {
          return { status: 'Booked', match, reservation, price: reservation.totalAmount };
      }

      // 3c. Fallback if a reservation exists but none of the above conditions are met.
      return { status: 'Pending', match, reservation, price: reservation.totalAmount };
    }
    
    // 4. Handle available slots.
    if (!reservation) {
        const dayOfWeek = getDay(day);
        const applicablePromo = promos
            .filter(p => {
                const validFrom = startOfDay(new Date(p.validFrom));
                const validTo = startOfDay(new Date(p.validTo));
                const currentDay = startOfDay(day);
                
                return currentDay >= validFrom && currentDay <= validTo &&
                       p.applicableDays.includes(dayOfWeek) &&
                       p.applicableHours.includes(slotHours) &&
                       (p.pitchIds.length === 0 || p.pitchIds.includes(pitch.id));
            })
            .sort((a, b) => b.discountPercent - a.discountPercent)[0];

        const basePrice = pitch.basePrice || 0;
        const finalPrice = applicablePromo ? basePrice * (1 - applicablePromo.discountPercent / 100) : basePrice;

        return { status: 'Available', promotion: applicablePromo, price: finalPrice };
    }

    // 5. Fallback for any other case
    return { status: 'Booked', reservation, price: reservation?.totalAmount || pitch.basePrice };

  }, [day, time, pitch, user, reservations, matches, promos]);

  return slotStatus;
}
