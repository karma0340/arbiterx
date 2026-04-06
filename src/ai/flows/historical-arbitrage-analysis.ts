// src/ai/flows/historical-arbitrage-analysis.ts
'use server';

/**
 * @fileOverview Analyzes historical arbitrage data using generative AI to suggest optimal staking strategies.
 *
 * - analyzeHistoricalArbitrage - A function that analyzes historical arbitrage data and suggests staking strategies.
 * - HistoricalArbitrageAnalysisInput - The input type for the analyzeHistoricalArbitrage function.
 * - HistoricalArbitrageAnalysisOutput - The return type for the analyzeHistoricalArbitrage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HistoricalArbitrageAnalysisInputSchema = z.object({
  historicalData: z
    .string()
    .describe('Historical arbitrage data, including dates, arbitrage percentages, and volumes.'),
  riskTolerance: z
    .string()
    .describe(
      'The users risk tolerance, as a string (e.g., High, Medium, Low)'
    ),
  liquidityConsiderations: z
    .string()
    .describe(
      'Any specific liquidity considerations or constraints to take into account.'
    ),
});
export type HistoricalArbitrageAnalysisInput = z.infer<
  typeof HistoricalArbitrageAnalysisInputSchema
>;

const HistoricalArbitrageAnalysisOutputSchema = z.object({
  suggestedStrategy: z.string().describe('The suggested optimal staking strategy.'),
  rationale: z.string().describe('The rationale behind the suggested strategy.'),
  riskAssessment: z
    .string()
    .describe('An assessment of the risks associated with the suggested strategy.'),
});
export type HistoricalArbitrageAnalysisOutput = z.infer<
  typeof HistoricalArbitrageAnalysisOutputSchema
>;

export async function analyzeHistoricalArbitrage(
  input: HistoricalArbitrageAnalysisInput
): Promise<HistoricalArbitrageAnalysisOutput> {
  return historicalArbitrageAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'historicalArbitrageAnalysisPrompt',
  input: {schema: HistoricalArbitrageAnalysisInputSchema},
  output: {schema: HistoricalArbitrageAnalysisOutputSchema},
  prompt: `You are an expert in arbitrage betting, skilled in analyzing historical data to derive optimal staking strategies.

  Based on the historical arbitrage data provided, and taking into account the user's risk tolerance and liquidity considerations, suggest an optimal staking strategy.

  Historical Data: {{{historicalData}}}
  Risk Tolerance: {{{riskTolerance}}}
  Liquidity Considerations: {{{liquidityConsiderations}}}

  Consider factors such as arbitrage percentage, volume, and the consistency of opportunities over time.

  Provide a clear rationale for your suggested strategy, and assess the risks associated with it.
  Format the response in a structured manner.
  `,
});

const historicalArbitrageAnalysisFlow = ai.defineFlow(
  {
    name: 'historicalArbitrageAnalysisFlow',
    inputSchema: HistoricalArbitrageAnalysisInputSchema,
    outputSchema: HistoricalArbitrageAnalysisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
