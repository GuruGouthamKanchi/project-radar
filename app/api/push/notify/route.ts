import { NextResponse } from "next/server";
import webpush from "web-push";

const mailto = process.env.VAPID_MAILTO || "mailto:admin@proximax.app";
const publicKey =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "";
const privateKey = process.env.VAPID_PRIVATE_KEY || "";

if (publicKey && privateKey) {
  webpush.setVapidDetails(mailto, publicKey, privateKey);
}

// In-memory rate limiting map
interface RateLimitState {
  lastRequest: number;
  requestTimes: number[];
}
const rateLimitMap = new Map<string, RateLimitState>();

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const now = Date.now();

    let clientState = rateLimitMap.get(ip);
    if (!clientState) {
      clientState = { lastRequest: 0, requestTimes: [] };
    }

    // Clean up timestamps older than 1 hour (3,600,000 ms)
    const oneHourAgo = now - 3600000;
    clientState.requestTimes = clientState.requestTimes.filter((t) => t > oneHourAgo);

    // 1. Check 5-second rate limit
    const timeSinceLast = now - clientState.lastRequest;
    if (timeSinceLast < 5000) {
      const retryAfter = Math.ceil((5000 - timeSinceLast) / 1000);
      return NextResponse.json(
        { error: "Rate limited", retryAfter },
        { status: 429 }
      );
    }

    // 2. Check hourly rate limit (max 20 requests)
    if (clientState.requestTimes.length >= 20) {
      const oldestRequest = clientState.requestTimes[0];
      const timeToExpiry = oldestRequest + 3600000 - now;
      const retryAfter = Math.ceil(timeToExpiry / 1000);
      return NextResponse.json(
        { error: "Rate limited", retryAfter },
        { status: 429 }
      );
    }

    // Update rate limit state
    clientState.lastRequest = now;
    clientState.requestTimes.push(now);
    rateLimitMap.set(ip, clientState);

    const { subscription, message } = await request.json();

    if (!subscription || !message) {
      return NextResponse.json(
        { error: "Missing required fields: subscription and message are required." },
        { status: 400 }
      );
    }

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        { error: "VAPID credentials are not configured on the server." },
        { status: 500 }
      );
    }

    const payload = JSON.stringify({
      title: "ProximaX Alert",
      body: message,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send push notification";
    console.error("Push notification send error:", err);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

