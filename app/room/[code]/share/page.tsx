"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { ShieldAlert, Power, Info, AlertOctagon, ShieldCheck, Navigation } from "lucide-react";
import { writeLocation, removeLocation } from "@/lib/firebaseLocation";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { validateLocationPayload } from "@/lib/locationValidator";
import { db } from "@/lib/firebase";
import { ref, set } from "firebase/database";

const TrackedMiniMap = dynamic(() => import("@/components/TrackedMiniMap"), {
  ssr: false,
});

export default function ShareLocationPage() {
  const params = useParams();
  const roomCode = (params.code as string).toLowerCase();

  const [phase, setPhase] = useState<'consent' | 'broadcasting' | 'stopped'>('consent');
  const [displayName, setDisplayName] = useState("");
  const [beaconColor, setBeaconColor] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const [peerId, setPeerId] = useState("");
  const [isStopping, setIsStopping] = useState(false);
  const [geoError, setGeoError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [e2eKey, setE2eKey] = useState("");

  const watchIdRef = useRef<number | null>(null);
  const isBroadcastingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("proximax_nickname");
      const storedColor = localStorage.getItem("proximax_color");
      if (storedName) setDisplayName(storedName);
      if (storedColor) setBeaconColor(storedColor);
      setE2eKey(window.location.hash.slice(1));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (peerId) {
        removeLocation(roomCode, peerId).catch(() => {});
        const sosRef = ref(db, `rooms/${roomCode}/sos/${peerId}`);
        set(sosRef, null).catch(() => {});
      }
    };
  }, [peerId, roomCode]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !beaconColor) return;

    localStorage.setItem("proximax_nickname", displayName.trim());
    localStorage.setItem("proximax_color", beaconColor);

    const generatedPeerId = "peer_" + Math.random().toString(36).substring(2, 15);
    setPeerId(generatedPeerId);
    setGeoError("");
    setCoords(null);
    isBroadcastingRef.current = true;

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          if (!isBroadcastingRef.current) return;
          // functional update to avoid stale closures in React rendering cycles
          setCoords(() => ({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            heading: position.coords.heading ?? null,
          }));
          await writeLocation(roomCode, generatedPeerId, position, displayName.trim(), beaconColor);
        },
        (err) => {
          if (err.code === 1) setGeoError("Location permission denied.");
          else if (err.code === 2) setGeoError("Location signal unavailable.");
          else if (err.code === 3) setGeoError("Location timed out. Retrying...");
          else setGeoError(err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      setPhase('broadcasting');
    } else {
      setGeoError("Geolocation is not supported by your browser.");
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    isBroadcastingRef.current = false;
    try {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (peerId) {
        await removeLocation(roomCode, peerId);
        const sosRef = ref(db, `rooms/${roomCode}/sos/${peerId}`);
        await set(sosRef, null);
      }
    } catch (err) {
      console.error('Stop error:', err);
    } finally {
      setIsStopping(false);
      setCoords(null);
      setPeerId('');
      setGeoError('');
      setPhase('consent');
    }
  };

  const handleSOSClick = async () => {
    if (!coords) {
      alert("GPS coordinates not acquired yet. Cannot trigger SOS.");
      return;
    }
    const confirmSOS = window.confirm("Send emergency alert to all room members?");
    if (confirmSOS) {
      try {
        const sosRef = ref(db, `rooms/${roomCode}/sos/${peerId}`);
        await set(sosRef, {
          lat: coords.lat,
          lng: coords.lng,
          ts: Date.now(),
          peerId: peerId,
          message: "SOS activated",
          nickname: displayName || "Anonymous",
        });
        alert("EMERGENCY SOS ALERT TRANSMITTED.");
      } catch (err) {
        console.error("SOS transmission failed:", err);
        alert("SOS TRANSMISSION FAILED");
      }
    }
  };

  if (phase === 'consent') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary px-4 font-mono-code relative overflow-hidden">
        {/* HUD Scanlines */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[size:100%_4px,6px_100%] pointer-events-none opacity-45 z-10" />

        <div className="w-full max-w-md p-6 bg-bg-card border border-border rounded-lg shadow-[0_0_50px_rgba(56,189,248,0.05)] text-center relative overflow-hidden z-20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full border border-accent/30 bg-accent/5 mb-6 animate-pulse">
              <div className="absolute inset-2 rounded-full border border-accent/50 animate-ping-slow" />
              <Navigation className="w-8 h-8 text-accent transform rotate-45" />
            </div>

            <span className="ui-label text-accent mb-2">PROXIMAX SECURE NODE</span>
            <h1 className="text-xl font-bold uppercase tracking-wider text-text-primary mb-1">
              ROOM: {roomCode.toUpperCase()}
            </h1>
            <p className="text-xs text-text-muted mb-6 max-w-xs leading-relaxed uppercase">
              SHARE LIVE GPS COORDINATES WITH THE ROOM TRACKER. CONSENT IS REQUIRED.
            </p>

            <form onSubmit={handleStart} className="w-full flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-left">
                <label htmlFor="name-input" className="ui-label text-[8px] tracking-wider">
                  DISPLAY NAME (REQUIRED)
                </label>
                <input
                  id="name-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="ENTER NICKNAME"
                  maxLength={24}
                  required
                  className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border rounded text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent uppercase tracking-wider"
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left mt-1">
                <span className="ui-label text-[8px] tracking-wider">BEACON COLOR (REQUIRED)</span>
                <div className="flex gap-3 justify-center py-2 bg-bg-secondary/40 border border-border/50 rounded">
                  {["#00FF41", "#FF6B35", "#00D4FF", "#FF0080", "#FFD700", "#9B59B6"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBeaconColor(c)}
                      className="w-6 h-6 rounded-full transition-all border-2 relative flex items-center justify-center active:scale-95"
                      style={{
                        backgroundColor: c,
                        borderColor: beaconColor === c ? "#ffffff" : "transparent",
                        boxShadow: beaconColor === c ? `0 0 10px ${c}` : "none",
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-border/50 my-1" />

              <div className="flex flex-col gap-2 items-center text-left bg-bg-secondary/40 p-3 border border-border/50 rounded">
                <div className="flex gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-[9px] text-text-muted leading-normal uppercase tracking-wider">
                    By clicking Start, you agree to transmit your GPS coordinates to this radar room in real-time. You can stop at any time.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={!displayName.trim() || !beaconColor}
                className="w-full py-3 bg-accent text-bg-primary text-xs font-bold uppercase tracking-widest rounded hover:bg-accent/90 transition-colors duration-150 shadow-[0_0_15px_rgba(56,189,248,0.2)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                START SHARING LOCATION
              </button>
            </form>
          </div>
        </div>
      </div>
    );
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
        <span className="ui-label mt-1">ROOM ID: {roomCode.toUpperCase()}</span>
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
                  {coords ? coords.lat.toFixed(6) : "ACQUIRING..."}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-text-muted">LONGITUDE</span>
                <span className="text-text-primary font-semibold">
                  {coords ? coords.lng.toFixed(6) : "ACQUIRING..."}
                </span>
              </div>
            </div>
          </div>

          {geoError && (
            <div className="p-2.5 bg-warning/15 border border-warning/30 rounded flex gap-2">
              <ShieldAlert className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-[9px] text-warning uppercase tracking-wider leading-relaxed">
                GPS FEED ERROR: {geoError.toUpperCase()}
              </p>
            </div>
          )}
        </div>

        {/* Live Mini-Map */}
        <div className="h-[200px] w-full rounded relative overflow-hidden shadow-inner">
          <TrackedMiniMap position={coords} />
        </div>
      </div>

      {/* Footer / Control Buttons */}
      <footer className="w-full max-w-md mx-auto mb-4 flex flex-col gap-3 z-20">
        <button
          onClick={handleSOSClick}
          className="w-full py-3.5 bg-red-600/20 border border-red-500 text-red-500 font-mono font-bold text-xs uppercase tracking-widest rounded hover:bg-red-600 hover:text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.15)] flex items-center justify-center gap-2 animate-pulse"
        >
          <AlertOctagon className="w-4 h-4" />
          ACTIVATE EMERGENCY SOS
        </button>

        <button
          onClick={handleStop}
          disabled={isStopping}
          className="w-full py-3.5 bg-warning/20 border border-warning text-warning font-mono font-bold text-xs uppercase tracking-widest rounded hover:bg-warning hover:text-bg-primary transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Power className="w-4 h-4" />
          {isStopping ? "STOPPING..." : "STOP LIVE BROADCAST"}
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
