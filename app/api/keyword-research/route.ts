import { NextResponse } from "next/server";
import { getKeywordResearchResponse } from "@/lib/keyword-research-service";
import type { KeywordResearchFormState } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      payload?: KeywordResearchFormState;
    };

    if (!body.payload) {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
    }

    const result = await getKeywordResearchResponse(body.payload);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Serverfehler";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
