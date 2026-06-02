import { NextResponse } from "next/server";
import { ref, set } from "firebase/database";
import { db } from "@/lib/firebase";

export async function POST(request: Request) {
  try {
    const { roomCode, subscription, uid } = await request.json();

    if (!roomCode || !subscription || !uid) {
      return NextResponse.json(
        { error: "Missing required fields: roomCode, subscription, and uid are required." },
        { status: 400 }
      );
    }

    const subRef = ref(db, `rooms/${roomCode.toLowerCase()}/subscriptions/${uid}`);
    await set(subRef, subscription);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to save subscription";
    console.error("Save subscription error:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
