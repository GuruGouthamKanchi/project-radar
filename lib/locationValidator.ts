export interface LocationPayload {
  lat: number;
  lng: number;
  ts: number;
  peerId: string;
  accuracy?: number;
  nickname?: string;
  color?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateLocationPayload(data: unknown): ValidationResult {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "Payload must be a non-null object" };
  }

  const payload = data as Record<string, unknown>;

  // Check required fields existence
  if (!("lat" in payload)) return { valid: false, error: "Missing required field: lat" };
  if (!("lng" in payload)) return { valid: false, error: "Missing required field: lng" };
  if (!("ts" in payload)) return { valid: false, error: "Missing required field: ts" };
  if (!("peerId" in payload)) return { valid: false, error: "Missing required field: peerId" };

  const { lat, lng, ts, peerId, nickname, accuracy, color } = payload;

  // Validate lat
  if (typeof lat !== "number" || !Number.isFinite(lat)) {
    return { valid: false, error: "lat must be a finite number" };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, error: "lat must be between -90 and 90" };
  }

  // Validate lng
  if (typeof lng !== "number" || !Number.isFinite(lng)) {
    return { valid: false, error: "lng must be a finite number" };
  }
  if (lng < -180 || lng > 180) {
    return { valid: false, error: "lng must be between -180 and 180" };
  }

  // Validate ts (within 60 seconds of Date.now())
  if (typeof ts !== "number" || !Number.isFinite(ts)) {
    return { valid: false, error: "ts must be a number" };
  }
  const diff = Math.abs(ts - Date.now());
  if (diff > 60000) {
    return { valid: false, error: "ts is not within 60 seconds of server time" };
  }

  // Validate peerId
  if (typeof peerId !== "string") {
    return { valid: false, error: "peerId must be a string" };
  }
  if (peerId.length > 64) {
    return { valid: false, error: "peerId must not exceed 64 characters" };
  }
  const peerIdRegex = /^[a-zA-Z0-9_-]+$/;
  if (!peerIdRegex.test(peerId)) {
    return { valid: false, error: "peerId must be alphanumeric (a-z, A-Z, 0-9, _, -)" };
  }

  // Validate optional nickname
  if ("nickname" in payload && nickname !== undefined && nickname !== null) {
    if (typeof nickname !== "string") {
      return { valid: false, error: "nickname must be a string" };
    }
    if (nickname.length > 24) {
      return { valid: false, error: "nickname must not exceed 24 characters" };
    }
    const htmlCharRegex = /[<>"'`]/;
    if (htmlCharRegex.test(nickname)) {
      return { valid: false, error: "nickname must not contain HTML characters (<, >, \", ', `)" };
    }
  }

  // Validate optional accuracy
  if ("accuracy" in payload && accuracy !== undefined && accuracy !== null) {
    if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) {
      return { valid: false, error: "accuracy must be a number" };
    }
    if (accuracy <= 0) {
      return { valid: false, error: "accuracy must be a positive number" };
    }
  }

  // Validate optional color
  if ("color" in payload && color !== undefined && color !== null) {
    if (typeof color !== "string") {
      return { valid: false, error: "color must be a string" };
    }
    const colorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!colorRegex.test(color)) {
      return { valid: false, error: "color must be a 6-digit hex string starting with #" };
    }
  }

  return { valid: true };
}
