"use client";

import { useState } from "react";
import { ShieldCheck, Navigation } from "lucide-react";

interface ConsentScreenProps {
  roomCode: string;
  onConsent: (name: string) => void;
}

export default function ConsentScreen({
  roomCode,
  onConsent,
}: ConsentScreenProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      onConsent(name.trim() || "Anonymous");
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg-primary px-4">
      <div className="w-full max-w-md p-6 bg-bg-card border border-border rounded-lg shadow-[0_0_50px_rgba(56,189,248,0.05)] text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-full border border-accent/30 bg-accent/5 mb-6 animate-pulse">
            <div className="absolute inset-2 rounded-full border border-accent/50 animate-ping-slow" />
            <Navigation className="w-8 h-8 text-accent transform rotate-45" />
          </div>

          <span className="ui-label text-accent mb-2">PROXIMAX SECURE NODE</span>
          <h1 className="text-xl font-bold uppercase tracking-wider font-mono-code text-text-primary mb-1">
            ROOM: {roomCode.toUpperCase()}
          </h1>
          <p className="text-xs text-text-muted mb-6 max-w-xs font-mono-code leading-relaxed">
            SHARE LIVE GPS COORDINATES WITH THE ROOM TRACKER. CONSENT IS REQUIRED.
            YOU RETAIN CONTROL AND CAN STOP SHARING AT ANY TIME.
          </p>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1 text-left">
              <label htmlFor="name-input" className="ui-label">
                DISPLAY NAME (OPTIONAL)
              </label>
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ANONYMOUS"
                maxLength={20}
                className="w-full px-3 py-2 text-sm font-mono-code bg-bg-secondary border border-border rounded text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent uppercase"
              />
            </div>

            <div className="border-t border-border/50 my-2" />

            <div className="flex flex-col gap-2 items-center text-left bg-bg-secondary/40 p-3 border border-border/50 rounded">
              <div className="flex gap-2">
                <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <p className="text-[10px] font-mono-code text-text-muted leading-normal">
                  BY CLICKING START, YOU AGREE TO TRANSMIT ENCRYPTED GPS DATA TO
                  FIREBASE FOR REAL-TIME DISPLAY ON THE RADAR SCREEN. NO BACKEND DATA
                  RETENTION BEYOND THE SESSION.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-accent text-bg-primary font-mono-code text-xs font-bold uppercase tracking-widest rounded hover:bg-accent/90 transition-colors duration-150 shadow-[0_0_15px_rgba(56,189,248,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? "AUTHORIZING..." : "START LIVE SHARING"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
