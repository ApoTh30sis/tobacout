// app/api/auth/statRouter/route.ts  (Next.js App Router)
// Drop this file in at app/api/auth/statRouter/route.ts — no other changes needed.

import { NextRequest, NextResponse } from "next/server";
import { analyzeSmokingRisk } from "../smokingRisk"; // adjust path to match your project

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { age, yearsSmoked, cigarettesPerDay, stateabbr } = body as {
      age?: string;
      yearsSmoked?: string;
      cigarettesPerDay?: string;
      stateabbr?: string;
    };

    if (!age || !yearsSmoked || !cigarettesPerDay) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: age, yearsSmoked, cigarettesPerDay" },
        { status: 400 }
      );
    }

    // analyzeSmokingRisk is now async — it fetches CDC data then builds the timeline
    const result = await analyzeSmokingRisk({
      age,
      yearsSmoked,
      cigarettesPerDay,
      stateabbr: stateabbr ?? "US",
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[statRouter] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}