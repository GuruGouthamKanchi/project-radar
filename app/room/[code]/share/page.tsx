"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useLocation } from "@/lib/useLocation";
import ConsentScreen from "@/components/ConsentScreen";
import { ShieldAlert, Power, Info } from "lucide-react";

const TrackedMiniMap = dynamic(() => import("@/components/TrackedMiniMap"), {
  ssr: false,
});

export default function ShareLocationPage() {
  const params = useParams();
  const code = (params.code as string).toLowerCase();

  const [e2eKey, setE2eKey] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setE2eKey(window.location.hash.slice(1));
    }
  }, []);

  const { isTracking, error, currentLocation, startTracking, stopTracking } =
    useLocation(code, e2eKey);
  const [displayName, setDisplayName] = useState("");

  const handleConsent = (name: string) => {
    setDisplayName(name);
    startTracking(name);
  };

  if (!isTracking) {
    return <ConsentScreen roomCode={code} onConsent={handleConsent} />;
  }

  return (
    <main className="min-h-screen bg-bg-primary text-text-primary flex flex-col justify-between p-6 font-mono-code relative overflow-hidden">
      {/* HUD Scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[size:100%_4px,6px_100%] pointer-events-none opacity-40 z-10" />

      {/* HUD Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      {/* Top Header */}
      <header className="flex flex-col items-center text-center mt-4 z-20">
        <div className="flex items-center gap-2 bg-success/10 border border-success/20 px-3 py-1 rounded-full animate-pulse mb-3">
          <span className="w-2 h-2 bg-success rounded-full" />
          <span className="text-[9px] font-bold text-success uppercase tracking-[0.15em]">
            TRANSMITTING SECURE GPS
          </span>
        </div>
        <h1 className="text-xl font-bold uppercase tracking-wider text-text-primary">
          PROXIMAX BROADCAST NODE
        </h1>
        <span className="ui-label mt-1">ROOM ID: {code.toUpperCase()}</span>
      </header>

      {/* Middle dashboard */}
      <div className="w-full max-w-md mx-auto my-6 flex flex-col gap-4 z-20">
        {/* Diagnostics Card */}
        <div className="p-4 bg-bg-card border border-border rounded-lg shadow-xl flex flex-col gap-3 relative">
          <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-success/50 to-transparent" />

          <div className="flex justify-between items-center border-b border-border/50 pb-2">
            <span className="ui-label">AGENT IDENTIFIER</span>
            <span className="text-xs text-text-primary font-bold uppercase tracking-wider">
              {displayName}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="ui-label text-[8px]">COORDINATES</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-bg-secondary p-2.5 border border-border rounded">
              <div className="flex flex-col">
                <span className="text-[8px] text-text-muted">LATITUDE</span>
                <span className="text-text-primary font-semibold">
                  {currentLocation ? currentLocation.lat.toFixed(6) : "ACQUIRING..."}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-text-muted">LONGITUDE</span>
                <span className="text-text-primary font-semibold">
                  {currentLocation ? currentLocation.lng.toFixed(6) : "ACQUIRING..."}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-mono">
            <span className="ui-label text-[8px]">BEARING / HEADING</span>
            <span className="text-text-primary font-bold">
              {currentLocation && currentLocation.heading !== null
                ? `${Math.round(currentLocation.heading)}°`
                : "STATIONARY"}
            </span>
          </div>

          {error && (
            <div className="p-2.5 bg-warning/15 border border-warning/30 rounded flex gap-2">
              <ShieldAlert className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-[9px] text-warning uppercase tracking-wider leading-relaxed">
                GPS FEED ERROR: {error.toUpperCase()}
              </p>
            </div>
          )}
        </div>

        {/* Live Mini-Map */}
        <div className="h-[200px] w-full rounded relative overflow-hidden shadow-inner">
          <TrackedMiniMap position={currentLocation} />
        </div>
      </div>

      {/* Footer / Control Button */}
      <footer className="w-full max-w-md mx-auto mb-4 flex flex-col gap-3 z-20">
        <button
          onClick={stopTracking}
          className="w-full py-3.5 bg-warning/20 border border-warning text-warning font-mono font-bold text-xs uppercase tracking-widest rounded hover:bg-warning hover:text-bg-primary transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex items-center justify-center gap-2"
        >
          <Power className="w-4 h-4" />
          STOP LIVE BROADCAST
        </button>

        <div className="p-2.5 bg-bg-card/50 border border-border/50 rounded flex gap-2">
          <Info className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5" />
          <p className="text-[8px] text-text-dim leading-relaxed uppercase tracking-wider">
            GPS SHARING IS RUNNING IN BACKGROUND ONCE CONTEXT ESTABLISHED. KEEP THIS TAB OPEN. TO COMPLETELY CEASE ALL DATABASE SHARING, PRESS &quot;STOP LIVE BROADCAST&quot;.
          </p>
        </div>
      </footer>
    </main>
  );
}
