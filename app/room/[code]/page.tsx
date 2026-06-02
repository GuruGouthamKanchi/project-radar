"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import { haversine } from "@/lib/haversine";
import { subscribeToPushNotifications } from "@/lib/push";
import PersonCard from "@/components/PersonCard";
import RadiusSlider from "@/components/RadiusSlider";
import AlertBanner, { AlertNotification } from "@/components/AlertBanner";
import { decryptLocation } from "@/lib/crypto";
import { Compass, Users, MapPin, Radio, Bell, BellOff, Info, Share2, Clipboard, ArrowLeft, Check } from "lucide-react";

const RadarMap = dynamic(() => import("@/components/RadarMap"), { ssr: false });

interface TrackedPerson {
  uid: string;
  name: string;
  lat: number;
  lng: number;
  lastSeen: number;
  active: boolean;
  heading: number | null;
}

export default function TrackerDashboard() {
  const params = useParams();
  const code = (params.code as string).toLowerCase();

  const [trackerPos, setTrackerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [people, setPeople] = useState<TrackedPerson[]>([]);
  const [alertRadius, setAlertRadius] = useState(500); // meters
  const [pushEnabled, setPushEnabled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [trackerUid, setTrackerUid] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [history, setHistory] = useState<Record<string, { lat: number; lng: number }[]>>({});


  const previousStatusRef = useRef<Record<string, boolean>>({});
  const watchIdRef = useRef<number | null>(null);
  const subscriptionRef = useRef<PushSubscription | null>(null);

  // Initialize tracker UID & check iOS Safari conditions
  useEffect(() => {
    if (typeof window !== "undefined") {
      let tUid = sessionStorage.getItem("proximax_tracker_uid");
      if (!tUid) {
        tUid = "tracker_" + Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem("proximax_tracker_uid", tUid);
      }
      setTrackerUid(tUid);

      // Check if iOS Safari but not standalone (Add to Home Screen requirement)
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as Window & typeof globalThis & { MSStream?: unknown }).MSStream;
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && !!(navigator as Navigator & { standalone?: boolean }).standalone);
      if (isIOS && !isStandalone) {
        setShowIOSBanner(true);
      }
    }
  }, []);

  // Track tracker's own location
  useEffect(() => {
    if ("geolocation" in navigator) {
      const handleSuccess = (position: GeolocationPosition) => {
        setTrackerPos({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      };
      const handleError = (err: GeolocationPositionError) => {
        console.error("Tracker GPS Error:", err.message);
      };

      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Sync tracked people from Firebase and decrypt coordinates
  useEffect(() => {
    const peopleRef = ref(db, `rooms/${code}/people`);
    const unsubscribe = onValue(peopleRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setPeople([]);
        return;
      }

      const hashKey = typeof window !== "undefined" ? window.location.hash.slice(1) : "";

      const promises = Object.keys(data).map(async (key) => {
        const item = data[key];
        let lat = item.lat;
        let lng = item.lng;
        let heading = item.heading;

        if (item.encrypted && hashKey) {
          try {
            const decrypted = await decryptLocation(item.encrypted, hashKey);
            lat = decrypted.lat;
            lng = decrypted.lng;
            heading = decrypted.heading;
          } catch (e) {
            console.error("Failed to decrypt coordinates for", item.name, e);
          }
        }

        return {
          uid: key,
          name: item.name,
          lat,
          lng,
          heading,
          lastSeen: item.lastSeen,
          active: item.active,
        };
      });

      const list = await Promise.all(promises);
      setPeople(list);

      // Update breadcrumbs history
      setHistory((prev) => {
        const next = { ...prev };
        list.forEach((person) => {
          if (!person.lat || !person.lng || !person.active) return;
          const userHistory = next[person.uid] || [];
          const lastPoint = userHistory[userHistory.length - 1];
          if (!lastPoint || lastPoint.lat !== person.lat || lastPoint.lng !== person.lng) {
            const newHistory = [...userHistory, { lat: person.lat, lng: person.lng }];
            if (newHistory.length > 15) {
              newHistory.shift();
            }
            next[person.uid] = newHistory;
          }
        });
        return next;
      });
    });

    return () => unsubscribe();
  }, [code]);

  const triggerProximityAlert = useCallback(async (person: TrackedPerson, distance: number) => {
    // Add local UI banner alert
    const newAlert: AlertNotification = {
      id: Math.random().toString(36).substring(2, 9),
      name: person.name,
      distance,
      radius: alertRadius,
      timestamp: Date.now(),
    };
    setAlerts((prev) => [newAlert, ...prev]);

    // Send push notification if subscription active
    if (pushEnabled && subscriptionRef.current) {
      try {
        await fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: subscriptionRef.current,
            message: `${person.name.toUpperCase()} is ${Math.round(distance)}m away`,
          }),
        });
      } catch (err) {
        console.error("Failed to send push notification:", err);
      }
    }
  }, [pushEnabled, alertRadius]);

  // Proximity checks and trigger alerts
  useEffect(() => {
    if (!trackerPos) return;

    people.forEach((person) => {
      if (!person.lat || !person.lng || !person.active) return;

      const secondsAgo = (Date.now() - person.lastSeen) / 1000;
      if (secondsAgo > 60) return; // Ignore stale users

      const distance = haversine(trackerPos.lat, trackerPos.lng, person.lat, person.lng);
      const isInside = distance <= alertRadius;
      const wasInside = previousStatusRef.current[person.uid];

      // Detect outside -> inside transition
      if (isInside && (wasInside === false || wasInside === undefined)) {
        triggerProximityAlert(person, distance);
      }

      // Record status
      previousStatusRef.current[person.uid] = isInside;
    });
  }, [people, alertRadius, trackerPos, triggerProximityAlert]);

  const handleTogglePush = async () => {
    if (pushEnabled) {
      setPushEnabled(false);
      subscriptionRef.current = null;
      return;
    }

    try {
      // Register service worker if not already registered
      if ("serviceWorker" in navigator) {
        const swReg = await navigator.serviceWorker.register("/sw.js");
        console.log("Service Worker registered on dev-level:", swReg);
      }

      const subscription = await subscribeToPushNotifications();
      subscriptionRef.current = subscription;

      // Save push subscription to db
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: code,
          subscription,
          uid: trackerUid,
        }),
      });

      setPushEnabled(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      alert(`Push Notification Subscription Failed: ${errorMessage}`);
      setPushEnabled(false);
    }
  };

  const copyShareLink = () => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash; // contains #e2eKey if present
      const shareUrl = `${window.location.origin}/room/${code}/share${hash}`;
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  // Connection count calculations
  const totalTracked = people.filter((p) => p.active && (Date.now() - p.lastSeen) / 1000 <= 60).length;
  const inZoneCount = people.filter((p) => {
    if (!p.active || !trackerPos || (Date.now() - p.lastSeen) / 1000 > 60) return false;
    const distance = haversine(trackerPos.lat, trackerPos.lng, p.lat, p.lng);
    return distance <= alertRadius;
  }).length;

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen bg-bg-primary overflow-hidden font-mono-code relative">
      
      {/* Alert banners layer */}
      <AlertBanner alerts={alerts} onDismiss={dismissAlert} />

      {/* iOS App To Home Screen Alert Banner */}
      {showIOSBanner && (
        <div className="absolute top-0 inset-x-0 bg-accent text-bg-primary py-2 px-4 text-[10px] text-center font-bold tracking-wider z-[2000] flex items-center justify-center gap-2">
          <Info className="w-3.5 h-3.5" />
          <span>IOS SAFARI: TO RECEIVE PUSH NOTIFICATIONS, CLICK &quot;SHARE&quot; AND THEN &quot;ADD TO HOME SCREEN&quot;</span>
          <button onClick={() => setShowIOSBanner(false)} className="underline ml-2">DISMISS</button>
        </div>
      )}

      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[1990] md:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* LEFT SIDEBAR / CONTROL PANEL */}
      <aside className={`fixed md:relative top-0 bottom-0 left-0 w-[280px] md:w-[260px] bg-bg-secondary border-r border-border flex flex-col justify-between flex-shrink-0 z-[2000] md:z-30 transition-transform duration-300 ease-in-out md:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        
        {/* Upper Sidebar */}
        <div className="flex flex-col p-4 gap-4 overflow-y-auto flex-grow">
          
          {/* Header Back Button & Mobile Close Button */}
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <Link href="/" className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-[10px] tracking-wider uppercase font-bold transition-colors">
              <ArrowLeft className="w-3 h-3" /> BACK
            </Link>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[9px] font-bold text-accent">LIVE LINK</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden flex items-center justify-center border border-border/60 hover:border-accent bg-bg-card hover:bg-bg-card/80 text-text-muted hover:text-accent font-bold text-[9px] w-5 h-5 rounded transition-colors"
                title="Close HUD Panel"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Room details */}
          <div className="flex flex-col gap-1.5">
            <span className="ui-label">SECURE ROOM CODE</span>
            <div className="flex items-center justify-between bg-bg-card border border-border rounded px-3 py-2">
              <span className="text-sm font-bold text-text-primary uppercase tracking-widest">{code}</span>
              <button
                onClick={copyShareLink}
                className="text-text-muted hover:text-accent transition-colors p-1"
                title="Copy share link"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Clipboard className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={copyShareLink}
              className="w-full py-2 bg-bg-card hover:bg-bg-card/70 border border-border hover:border-accent text-text-muted hover:text-text-primary font-bold text-[9px] uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5"
            >
              <Share2 className="w-3 h-3" /> SHARE TRACKING LINK
            </button>
          </div>

          {/* Radius Adjustment */}
          <div className="flex flex-col gap-1.5">
            <RadiusSlider radius={alertRadius} onChange={setAlertRadius} />
          </div>

          {/* Push Notifications Toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="ui-label">PUSH NOTIFICATIONS</span>
            <button
              onClick={handleTogglePush}
              className={`w-full py-2 px-3 border rounded font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-between ${
                pushEnabled
                  ? "bg-success/15 border-success text-success"
                  : "bg-bg-card border-border text-text-muted hover:border-text-muted hover:text-text-primary"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {pushEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                <span>{pushEnabled ? "PUSH ENABLED" : "ENABLE PUSH"}</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${pushEnabled ? "bg-success" : "bg-text-dim"}`} />
            </button>
          </div>

          {/* Person List Header */}
          <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
            <span className="ui-label">TRACKED TARGETS ({people.length})</span>
            <div className="flex flex-col gap-2">
              {people.length === 0 ? (
                <div className="text-center py-4 bg-bg-card/30 border border-border/30 rounded text-[9px] text-text-dim uppercase tracking-wider">
                  NO AGENTS SHARING LOCATION IN THIS ROOM
                </div>
              ) : (
                people.map((person) => {
                  let distance: number | null = null;
                  if (trackerPos && person.lat && person.lng) {
                    distance = haversine(trackerPos.lat, trackerPos.lng, person.lat, person.lng);
                  }
                  return (
                    <PersonCard
                      key={person.uid}
                      name={person.name}
                      distance={distance}
                      lastSeen={person.lastSeen}
                      alertRadius={alertRadius}
                      active={person.active}
                    />
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Lower Sidebar Information */}
        <div className="p-4 border-t border-border/50 bg-bg-card/20">
          <div className="flex flex-col gap-1.5 font-mono-code text-[8px] text-text-dim leading-relaxed">
            <span className="ui-label block text-text-muted mb-0.5">GEODESIC ENGINE</span>
            <span>OS SYSTEM: PROXIMAX RADAR V1.0</span>
            <span>GPS PRECISION: WatchPosition(High)</span>
            <span>DATABASE: Firebase RTDB Sync</span>
          </div>
        </div>

      </aside>

      {/* MAIN AREA - RADAR MAP */}
      <main className="flex-grow flex flex-col justify-between relative bg-bg-primary h-full w-full">
        
        {/* Map Container Wrapper */}
        <div className="flex-grow w-full relative h-[calc(100vh-140px)] md:h-[calc(100vh-70px)]">
          <RadarMap trackerPos={trackerPos} people={people} alertRadius={alertRadius} history={history} />
          
          {/* Floating Mobile HUD Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-[1000] md:hidden flex items-center gap-1.5 px-3 py-2 bg-bg-secondary/90 hover:bg-bg-secondary border border-accent/60 hover:border-accent text-accent font-bold text-[10px] tracking-wider rounded shadow-[0_0_15px_rgba(56,189,248,0.25)] active:scale-95 transition-all"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            HUD SYSTEM
          </button>
        </div>

        {/* STAT STRIP (bottom) */}
        <footer className="h-[140px] md:h-[70px] border-t border-border bg-bg-secondary grid grid-cols-2 md:grid-cols-4 items-center z-30">
          
          {/* Card 1: Total Tracked */}
          <div className="w-full h-full p-3 flex flex-col justify-center font-mono-code border-r border-b md:border-b-0 border-border/40 md:border-border">
            <span className="ui-label text-[8px]">TOTAL ACTIVE TARGETS</span>
            <div className="flex items-center gap-2 mt-1">
              <Users className="w-4 h-4 text-accent" />
              <span className="text-lg font-bold text-text-primary">{totalTracked}</span>
            </div>
          </div>

          {/* Card 2: In Zone Count */}
          <div className="w-full h-full p-3 flex flex-col justify-center font-mono-code border-b md:border-b-0 md:border-r border-border/40 md:border-border">
            <span className="ui-label text-[8px]">TARGETS IN ALARM ZONE</span>
            <div className="flex items-center gap-2 mt-1">
              <Radio className="w-4 h-4 text-success" />
              <span className="text-lg font-bold text-success">{inZoneCount}</span>
            </div>
          </div>

          {/* Card 3: Active Radius */}
          <div className="w-full h-full p-3 flex flex-col justify-center font-mono-code border-r border-border/40 md:border-border">
            <span className="ui-label text-[8px]">ACTIVE TRACKING BOUND</span>
            <div className="flex items-center gap-2 mt-1">
              <Compass className="w-4 h-4 text-warning" />
              <span className="text-lg font-bold text-text-primary">
                {alertRadius >= 1000 ? `${(alertRadius / 1000).toFixed(1)}KM` : `${alertRadius}M`}
              </span>
            </div>
          </div>

          {/* Card 4: Connection Status */}
          <div className="w-full h-full p-3 flex flex-col justify-center font-mono-code">
            <span className="ui-label text-[8px]">CONSOLE CONNECTION STATE</span>
            <div className="flex items-center gap-2 mt-1">
              <MapPin className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-text-primary truncate">
                {trackerPos ? "ONLINE (GPS VALID)" : "SEARCHING GPS..."}
              </span>
            </div>
          </div>

        </footer>

      </main>

    </div>
  );
}
