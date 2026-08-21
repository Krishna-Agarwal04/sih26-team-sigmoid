import { NextResponse } from "next/server";
import { recordCrossing } from "@/lib/store/walks";
import type { WalkCrossingInput } from "@/lib/types";

export async function POST(request: Request) {
  const crossing = (await request.json()) as WalkCrossingInput;
  const stored = await recordCrossing(crossing);
  return NextResponse.json({ ok: true, stored }, { status: 201 });
}
