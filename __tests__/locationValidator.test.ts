import { validateLocationPayload } from "../lib/locationValidator";

describe("validateLocationPayload()", () => {

  const validPayload = {
    lat: 13.0827,
    lng: 80.2707,
    ts: Date.now(),
    peerId: "peer_abc123",
    nickname: "GOUTHAM",
    color: "#00FF41",
    accuracy: 15,
  };

  test("accepts a fully valid payload", () => {
    expect(validateLocationPayload(validPayload).valid).toBe(true);
  });

  test("accepts payload without optional fields", () => {
    const { nickname, color, accuracy, ...minimal } = validPayload;
    expect(validateLocationPayload(minimal).valid).toBe(true);
  });

  test("rejects null input", () => {
    const result = validateLocationPayload(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test("rejects non-object input", () => {
    expect(validateLocationPayload("string").valid).toBe(false);
    expect(validateLocationPayload(123).valid).toBe(false);
    expect(validateLocationPayload([]).valid).toBe(false);
  });

  test("rejects lat above 90", () => {
    const result = validateLocationPayload({ ...validPayload, lat: 91 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/lat/i);
  });

  test("rejects lat below -90", () => {
    const result = validateLocationPayload({ ...validPayload, lat: -91 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/lat/i);
  });

  test("rejects lng above 180", () => {
    const result = validateLocationPayload({ ...validPayload, lng: 181 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/lng/i);
  });

  test("rejects lng below -180", () => {
    const result = validateLocationPayload({ ...validPayload, lng: -181 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/lng/i);
  });

  test("rejects non-finite lat (NaN)", () => {
    const result = validateLocationPayload({ ...validPayload, lat: NaN });
    expect(result.valid).toBe(false);
  });

  test("rejects non-finite lng (Infinity)", () => {
    const result = validateLocationPayload({ ...validPayload, lng: Infinity });
    expect(result.valid).toBe(false);
  });

  test("rejects stale timestamp older than 60 seconds", () => {
    const result = validateLocationPayload({
      ...validPayload,
      ts: Date.now() - 70000,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ts/i);
  });

  test("rejects future timestamp more than 5 seconds ahead", () => {
    const result = validateLocationPayload({
      ...validPayload,
      ts: Date.now() + 10000,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ts/i);
  });

  test("accepts timestamp within the valid window", () => {
    const result = validateLocationPayload({
      ...validPayload,
      ts: Date.now() - 30000,
    });
    expect(result.valid).toBe(true);
  });

  test("rejects empty peerId", () => {
    const result = validateLocationPayload({ ...validPayload, peerId: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/peerId/i);
  });

  test("rejects peerId longer than 64 characters", () => {
    const result = validateLocationPayload({
      ...validPayload,
      peerId: "a".repeat(65),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/peerId/i);
  });

  test("rejects peerId with special characters", () => {
    const result = validateLocationPayload({
      ...validPayload,
      peerId: "peer<script>",
    });
    expect(result.valid).toBe(false);
  });

  test("rejects nickname with HTML characters", () => {
    const xss = "<script>alert('xss')</script>";
    const result = validateLocationPayload({ ...validPayload, nickname: xss });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/nickname/i);
  });

  test("rejects nickname longer than 24 characters", () => {
    const result = validateLocationPayload({
      ...validPayload,
      nickname: "A".repeat(25),
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/nickname/i);
  });

  test("rejects negative accuracy", () => {
    const result = validateLocationPayload({ ...validPayload, accuracy: -1 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/accuracy/i);
  });

  test("returns valid:true and no error on success", () => {
    const result = validateLocationPayload(validPayload);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

});
