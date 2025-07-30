"use server";

import { getLocationRecommendations, type LocationRecommendationsInput } from "@/ai/flows/location-recommendations";

export async function getRecommendationsAction(input: LocationRecommendationsInput) {
    try {
        const result = await getLocationRecommendations(input);
        return result;
    } catch (error) {
        console.error("Error getting recommendations:", error);
        // In a real app, you'd want more robust error handling
        throw new Error("Failed to get recommendations from AI.");
    }
}
