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
    const { command, peers, adminLocation } = await request.json();

    if (typeof command !== "string" || !peers || !adminLocation) {
      return NextResponse.json(
        { error: "Missing required fields: command, peers, and adminLocation are required." },
        { status: 400 }
      );
    }

    const prompt = `You are an AI agent controlling a real-time radar room.
Parse the admin's natural language command and return a structured JSON action.

Admin Command: "${command}"
Current Admin Location: ${JSON.stringify(adminLocation)}
Active Peers List (containing peerId/uid, nickname/name, lat, lng, ts): ${JSON.stringify(peers, null, 2)}

Translate the command into one of the following actions:
1. FOCUS_PEER: When the admin wants to zoom in, focus on, show, highlight, or center a specific peer/person (e.g. "show Raj", "zoom in on Raj", "find Raj"). Identify the targetPeerId from the active peers list based on matching names/nicknames.
2. SET_RADIUS: When the admin wants to change, set, update, increase or decrease the alert radius threshold (e.g. "set alert radius to 500 meters", "make the zone 1km wide"). Extract the radiusMeters value.
3. BROADCAST_MESSAGE: When the admin wants to announce, tell, notify, send a message to everyone (e.g. "tell everyone to meet at the gate", "broadcast 'dinner time'"). Extract the message text.
4. LIST_PEERS: When the admin asks a question about peers (e.g. "who is closest to me?", "list all contacts", "how many people are active?"). Compute the answer if needed and include a helpful natural language explanation in the "reply" field.
5. UNKNOWN: Default fallback.

Respond ONLY with a raw JSON object and nothing else. Do not wrap it in markdown blocks, backticks, or any conversational text. The response must follow this schema:
{
  "action": "FOCUS_PEER" | "SET_RADIUS" | "BROADCAST_MESSAGE" | "LIST_PEERS" | "UNKNOWN",
  "targetPeerId": "string (only if FOCUS_PEER)",
  "radiusMeters": "number (only if SET_RADIUS)",
  "message": "string (only if BROADCAST_MESSAGE)",
  "reply": "string (brief summary of what you did or the answer to the query)"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
          temperature: 0.1,
          maxOutputTokens: 2048,
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
    const parsedAction = JSON.parse(cleanJsonText);

    return NextResponse.json(parsedAction, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to parse command";
    console.error("AI command error:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
