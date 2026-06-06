import { NextResponse } from "next/server";
import { ref, get, remove } from "firebase/database";
import { db } from "@/lib/firebase";

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.CLEANUP_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CLEANUP_SECRET is not configured on the server." },
      { status: 500 }
    );
  }

  if (authHeader !== secret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const roomsRef = ref(db, "rooms");
    const snapshot = await get(roomsRef);
    if (!snapshot.exists()) {
      return NextResponse.json({ deleted: 0, roomCodes: [] }, { status: 200 });
    }

    const rooms = snapshot.val();
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours ago
    const deletedRoomCodes: string[] = [];

    const promises = Object.keys(rooms).map(async (code) => {
      const room = rooms[code];
      const lastActivity = room?.meta?.lastActivity || room?.meta?.createdAt || 0;
      
      // If last activity is older than 24 hours, delete the room
      if (lastActivity < cutoff) {
        const roomRef = ref(db, `rooms/${code}`);
        await remove(roomRef);
        deletedRoomCodes.push(code);
      }
    });

    await Promise.all(promises);

    return NextResponse.json(
      { deleted: deletedRoomCodes.length, roomCodes: deletedRoomCodes },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to cleanup rooms";
    console.error("Cleanup rooms error:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
