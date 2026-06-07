import { haversine } from "../lib/haversine";

describe("haversine()", () => {

  test("same point returns 0", () => {
    expect(haversine(13.0827, 80.2707, 13.0827, 80.2707)).toBe(0);
  });

  test("known distance — Chennai to Bangalore is ~290km", () => {
    const dist = haversine(13.0827, 80.2707, 12.9716, 77.5946);
    expect(dist).toBeGreaterThan(280000);
    expect(dist).toBeLessThan(300000);
  });

  test("known distance — Delhi to Mumbai is ~1150km", () => {
    const dist = haversine(28.6139, 77.2090, 19.0760, 72.8777);
    expect(dist).toBeGreaterThan(1100000);
    expect(dist).toBeLessThan(1200000);
  });

  test("short distance — 100m apart returns ~100m", () => {
    const dist = haversine(13.0000, 80.0000, 13.0009, 80.0000);
    expect(dist).toBeGreaterThan(80);
    expect(dist).toBeLessThan(120);
  });

  test("is symmetric — A to B equals B to A", () => {
    const ab = haversine(28.6139, 77.2090, 19.0760, 72.8777);
    const ba = haversine(19.0760, 72.8777, 28.6139, 77.2090);
    expect(Math.abs(ab - ba)).toBeLessThan(0.001);
  });

  test("returns a positive number for any two distinct points", () => {
    const dist = haversine(0, 0, 1, 1);
    expect(dist).toBeGreaterThan(0);
  });

  test("works across the equator", () => {
    const dist = haversine(-1.0, 36.8, 1.0, 36.8);
    expect(dist).toBeGreaterThan(200000);
    expect(dist).toBeLessThan(230000);
  });

  test("returns number type always", () => {
    const dist = haversine(13.0827, 80.2707, 12.9716, 77.5946);
    expect(typeof dist).toBe("number");
    expect(isFinite(dist)).toBe(true);
  });

});
