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

export async function POST(request: Request) {
  try {
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
