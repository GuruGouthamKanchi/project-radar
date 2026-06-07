import { ref, set, remove, onDisconnect } from "firebase/database";
import { db } from "./firebase";
import { validateLocationPayload, LocationPayload } from "./locationValidator";
import { encryptLocation } from "./crypto";

/**
 * Builds a LocationPayload from GeolocationPosition, validates it,
 * and writes to rooms/${roomCode}/peers/${peerId}. Sets up onDisconnect remove listener.
 */
export async function writeLocation(
  roomCode: string,
  peerId: string,
  position: GeolocationPosition,
  nickname?: string,
  color?: string,
  e2eKey?: string
): Promise<void> {
  const payload: LocationPayload & { encrypted?: string } = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    ts: Date.now(),
    peerId,
  };

  if (nickname !== undefined && nickname !== null && nickname !== "") {
    payload.nickname = nickname;
  }

  if (color !== undefined && color !== null && color !== "") {
    payload.color = color;
  }

  if (typeof position.coords.accuracy === "number" && position.coords.accuracy > 0) {
    payload.accuracy = position.coords.accuracy;
  }

  if (e2eKey && e2eKey.trim() !== "") {
    payload.encrypted = await encryptLocation(
      { lat: payload.lat, lng: payload.lng, heading: null },
      e2eKey
    );
  }

  const validation = validateLocationPayload(payload);
  if (!validation.valid) {
    console.error("Validation failed for location payload:", validation.error);
    return;
  }

  const peerRef = ref(db, `rooms/${roomCode}/peers/${peerId}`);

  // Write payload to database
  await set(peerRef, payload);

  // Update room last activity metadata
  const metaActivityRef = ref(db, `rooms/${roomCode}/meta/lastActivity`);
  await set(metaActivityRef, Date.now());

  // Setup onDisconnect cleanup
  await onDisconnect(peerRef).remove();
}

/**
 * Removes rooms/${roomCode}/peers/${peerId} from Firebase.
 */
export async function removeLocation(roomCode: string, peerId: string): Promise<void> {
  const peerRef = ref(db, `rooms/${roomCode}/peers/${peerId}`);
  await remove(peerRef);
}
