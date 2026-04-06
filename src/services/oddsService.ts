
import type { ArbitrageOpportunity } from "@/lib/types";
import { mockOpportunities } from "@/lib/mock-data";

/**
 * Combine data into arbitrage opportunities
 */
export async function getArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
  // In a real app, you'd fetch from various sources and normalize data.
  // For now, we'll return mock data to avoid hydration errors.
  
  // Adding a delay to simulate network latency
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return mockOpportunities;
}
