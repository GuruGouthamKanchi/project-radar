import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const { sosPeer, allPeers } = await request.json();

    if (!sosPeer || !allPeers) {
      return NextResponse.json(
        { error: "Missing required fields: sosPeer and allPeers are required." },
        { status: 400 }
      );
    }

    const prompt = `You are an emergency coordinator for a location tracking system.
A peer at latitude: ${sosPeer.lat}, longitude: ${sosPeer.lng} (nickname: ${sosPeer.nickname || 'Unknown'}) triggered SOS.
Other peers are at: ${JSON.stringify(allPeers, null, 2)}

Who is closest to the SOS peer? What should nearby peers do? Provide a 2-sentence clear alert advising closest contacts of the emergency and immediate action.
Respond ONLY with a raw JSON object and nothing else. Do not wrap it in markdown blocks, backticks, or any conversational text. The response must follow this schema:
{
  "triageMessage": "A 2-sentence alert message (e.g. 'Jane is closest to the SOS sender. Proceed immediately to coordinate [lat, lng] to assist.')",
  "closestPeerId": "The peerId of the closest peer from the list, or null if none"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
    }

    const resData = await response.json();
    const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("Invalid response structure from Gemini API");
    }

    // Strip any markdown backticks in case model ignores instructions
    const cleanJsonText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsedTriage = JSON.parse(cleanJsonText);

    return NextResponse.json(parsedTriage, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to run SOS triage";
    console.error("SOS triage error:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
