//location-recommendations.ts
'use server';
/**
 * @fileOverview Recommends nearby fields based on user preferences and skill level.
 *
 * - getLocationRecommendations - A function that handles the location recommendation process.
 * - LocationRecommendationsInput - The input type for the getLocationRecommendations function.
 * - LocationRecommendationsOutput - The return type for the getLocationRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LocationRecommendationsInputSchema = z.object({
  userId: z.string().describe('The ID of the user requesting recommendations.'),
  pastGamePreferences: z
    .string()
    .describe(
      'A comma-separated list of the user past game preferences (e.g., football, basketball).' + 
      'If the user has no game preferences, this field should be an empty string.'
    ),
  skillLevel: z.string().describe('The skill level of the user (e.g., beginner, intermediate, advanced).'),
  currentLocation: z.string().describe('The current location of the user (e.g., city, coordinates).'),
});
export type LocationRecommendationsInput = z.infer<typeof LocationRecommendationsInputSchema>;

const LocationRecommendationsOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      locationId: z.string().describe('The ID of the recommended location.'),
      locationName: z.string().describe('The name of the recommended location.'),
      description: z.string().describe('A short description of the location.'),
      sportsOffered: z.string().describe('A comma-separated list of sports offered at the location.'),
      address: z.string().describe('The address of the location.'),
      availableTimes: z.string().describe('A comma-separated list of available times at the location.'),
      pricing: z.string().describe('The pricing information for renting the location.'),
      suitabilityScore: z.number().describe('A score indicating how well the location matches the user preferences and skill level.'),
    })
  ).describe('A list of recommended locations for the user, along with their details.'),
});
export type LocationRecommendationsOutput = z.infer<typeof LocationRecommendationsOutputSchema>;

export async function getLocationRecommendations(input: LocationRecommendationsInput): Promise<LocationRecommendationsOutput> {
  return locationRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'locationRecommendationsPrompt',
  input: {schema: LocationRecommendationsInputSchema},
  output: {schema: LocationRecommendationsOutputSchema},
  prompt: `You are an AI assistant designed to recommend sports locations to users based on their preferences, skill level, and current location.

  Given the following information about the user:
  - User ID: {{{userId}}}
  - Past Game Preferences: {{{pastGamePreferences}}}
  - Skill Level: {{{skillLevel}}}
  - Current Location: {{{currentLocation}}}

  Recommend a list of sports locations that are suitable for the user. Each location should include:
  - locationId: A unique identifier for the location.
  - locationName: The name of the location.
  - description: A brief overview of the location.
  - sportsOffered: A comma-separated list of sports available at the location.
  - address: The full street address of the location.
  - availableTimes: A comma-separated list of available times for booking.
  - pricing: The cost of renting the location.
  - suitabilityScore: A numerical score (0-1) representing how well the location matches the user's preferences and skill level.

  Ensure the recommendations are tailored to the user's past game preferences and skill level, and that the locations are within a reasonable distance from the user's current location.

  Output the recommendations in the following JSON format:
  {{#toJson recommendations}}{{{this}}}{{/toJson}}`,
});

const locationRecommendationsFlow = ai.defineFlow(
  {
    name: 'locationRecommendationsFlow',
    inputSchema: LocationRecommendationsInputSchema,
    outputSchema: LocationRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
