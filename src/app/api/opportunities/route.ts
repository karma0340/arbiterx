
import { NextResponse } from "next/server";
import { getArbitrageOpportunities } from "@/services/oddsService";

export const dynamic = 'force-dynamic' // defaults to auto

export async function GET() {
  try {
    const opportunities = await getArbitrageOpportunities();
    return NextResponse.json({
      connected: true,
      count: opportunities.length,
      opportunities,
    });
  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      { connected: false, error: "Failed to fetch opportunities." },
      { status: 500 }
    );
  }
}
