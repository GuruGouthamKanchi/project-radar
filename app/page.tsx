"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Radio, Shield } from "lucide-react";

import { generateE2EKey } from "@/lib/crypto";
import { ref, set } from "firebase/database";
import { db } from "@/lib/firebase";

export default function Home() {
  const router = useRouter();
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState("");

  const handleCreateRoom = async () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const e2eKey = generateE2EKey();
    
    try {
      const metaRef = ref(db, `rooms/${code.toLowerCase()}/meta`);
      await set(metaRef, {
        createdAt: Date.now(),
        lastActivity: Date.now(),
      });
    } catch (err) {
      console.error("Failed to write room metadata to Firebase:", err);
    }

    router.push(`/room/${code.toLowerCase()}#${e2eKey}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inputCode.trim().toLowerCase();
    
    if (cleanCode.length !== 6 || !/^[a-z0-9]+$/i.test(cleanCode)) {
      setError("ENTER A VALID 6-CHAR ALPHANUMERIC CODE");
      return;
    }
    
    setError("");
    router.push(`/room/${cleanCode}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-bg-primary relative overflow-hidden font-mono-code">
      {/* HUD Scanline Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[size:100%_4px,6px_100%] pointer-events-none opacity-40 z-10" />
      
      {/* HUD Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      {/* Glow Center */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-accent/5 blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md flex flex-col gap-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-full border border-accent bg-accent/5 mb-4 shadow-[0_0_15px_rgba(56,189,248,0.15)] animate-pulse">
            <Radar className="w-7 h-7 text-accent animate-spin" style={{ animationDuration: "12s" }} />
            <div className="absolute inset-0 rounded-full border border-accent/30 animate-ping" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-[0.25em] text-text-primary">
            PROXIMA<span className="text-accent">X</span>
          </h1>
          <p className="ui-label mt-1">CONSENT-BASED RADAR GEOLOCATION</p>
        </div>

        {/* Console Box */}
        <div className="p-6 bg-bg-card border border-border rounded-lg shadow-2xl relative">
          <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

          <div className="flex flex-col gap-6">
            {/* Create Room CTA */}
            <div className="flex flex-col gap-2">
              <span className="ui-label">ADMIN HOSTING</span>
              <button
                onClick={handleCreateRoom}
                className="w-full py-3 bg-accent text-bg-primary font-bold text-xs uppercase tracking-widest rounded hover:bg-accent/90 transition-all duration-150 shadow-[0_0_15px_rgba(56,189,248,0.15)] active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                CREATE RADAR ROOM
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border/50"></div>
              <span className="flex-shrink mx-4 text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold">OR</span>
              <div className="flex-grow border-t border-border/50"></div>
            </div>

            {/* Join Room CTA */}
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-2">
              <span className="ui-label">JOIN EXISTING RADAR</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="ROOM CODE (E.G. A8B9Z1)"
                  className="flex-grow px-3 py-3 text-xs bg-bg-secondary border border-border rounded text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent uppercase tracking-widest text-center"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-bg-secondary hover:bg-bg-secondary/70 border border-border hover:border-accent text-text-primary font-bold text-xs uppercase tracking-wider rounded transition-colors"
                >
                  JOIN
                </button>
              </div>
              {error && (
                <span className="text-[9px] text-warning uppercase mt-1 tracking-wider">
                  ⚠️ {error}
                </span>
              )}
            </form>


          </div>
        </div>

        {/* Footer info banner */}
        <div className="p-3 bg-bg-card/50 border border-border/50 rounded flex gap-2">
          <Shield className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <p className="text-[9px] text-text-muted leading-relaxed uppercase tracking-wider">
            PRIVACY GUARANTEE: LOCATION DATA TRANSFERRED IN REAL-TIME DIRECTLY BETWEEN CONNECTED CLIENTS. NO TRACKING PERSISTENCE BEYOND USER TERMINATION.
          </p>
        </div>
      </div>
    </main>
  );
}
