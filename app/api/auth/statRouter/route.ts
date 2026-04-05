import { NextResponse } from "next/server";
import { analyzeSmokingRisk } from "../smokingRisk";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await analyzeSmokingRisk(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("statRouter POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Invalid request body.",
      },
      { status: 400 }
    );
  }
}
