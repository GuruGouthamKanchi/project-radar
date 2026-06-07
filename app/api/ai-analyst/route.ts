import { NextResponse } from "next/server";
import { haversine } from "@/lib/haversine";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const { peers, adminLocation, radiusMeters } = await request.json();

    if (!peers || !adminLocation || typeof radiusMeters !== "number") {
      return NextResponse.json(
        { error: "Missing required fields in request body." },
        { status: 400 }
      );
    }

    interface Peer {
      lat: number;
      lng: number;
      uid?: string;
      name?: string;
      lastSeen?: number;
      active?: boolean;
      heading?: number | null;
      ts?: number;
      color?: string;
    }

    const inside: (Peer & { distanceMeters: number })[] = [];
    const outside: (Peer & { distanceMeters: number })[] = [];

    peers.forEach((peer: Peer) => {
      const dist = haversine(adminLocation.lat, adminLocation.lng, peer.lat, peer.lng);
      const updatedPeer = { ...peer, distanceMeters: dist };
      if (dist <= radiusMeters) {
        inside.push(updatedPeer);
      } else {
        outside.push(updatedPeer);
      }
    });

    const prompt = `You are a proximity intelligence analyst for a radar system.
Analyze the following peer location data relative to the admin/tracker's location at latitude: ${adminLocation.lat}, longitude: ${adminLocation.lng} with an alert radius threshold of ${radiusMeters} meters.

Total Peers: ${peers.length}
Peers Inside the Radius: ${JSON.stringify(inside, null, 2)}
Peers Outside the Radius: ${JSON.stringify(outside, null, 2)}

Provide a situation report analyzing the details. Detect any anomalies (e.g. peer stationary >3 min, peer moving away fast, stale coordinates, anomalous groupings).

Respond ONLY with a raw JSON object and nothing else. Do not wrap it in markdown blocks, backticks, or any conversational text. The response must exactly follow this schema:
{
  "summary": "One-sentence situation summary (e.g. '3 of 5 contacts are within your zone')",
  "anomalies": "Any anomalies noticed or null",
  "level": "LOW | MEDIUM | HIGH with one-line reason (e.g. 'MEDIUM (2 contacts inside alert zone)')"
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
          temperature: 0.3,
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
    const parsedReport = JSON.parse(cleanJsonText);

    return NextResponse.json(parsedReport, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to run AI analysis";
    console.error("AI analyst error:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
