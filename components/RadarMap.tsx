"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, SVGOverlay, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { haversine } from "@/lib/haversine";

interface TrackedPerson {
  uid: string;
  name: string;
  lat: number;
  lng: number;
  lastSeen: number;
  active: boolean;
  heading: number | null;
  ts?: number;
  stalenessLabel?: string;
  color?: string;
}

interface RadarMapProps {
  trackerPos: { lat: number; lng: number } | null;
  people: TrackedPerson[];
  alertRadius: number;
  history?: Record<string, { lat: number; lng: number; ts: number }[]>;
  focusedPeerId?: string | null;
  trailEnabled?: boolean;
}

// Recenter control
function RecenterMap({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center.lat, center.lng, map]);
  return null;
}

// Markers styling
const createTrackerIcon = () => {
  return L.divIcon({
    className: "tracker-marker-icon",
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute w-3 h-3 rounded-full bg-accent border-2 border-text-primary shadow-[0_0_15px_#38bdf8]"></div>
        <div class="absolute w-6 h-6 rounded-full border border-accent/60 animate-ping-slow"></div>
        <div class="absolute -top-6 bg-bg-card border border-accent px-1.5 py-0.5 rounded text-[8px] font-mono-code font-bold text-accent uppercase tracking-wider whitespace-nowrap shadow-md">
          TRACKER (YOU)
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createTrackedIcon = (name: string, isInside: boolean, isOffline: boolean, heading: number | null, stalenessLabel: string = "just now", chosenColor?: string, isFocused?: boolean) => {
  const dotColor = isOffline ? "#94a3b8" : (chosenColor || (isInside ? "#22c55e" : "#38bdf8"));
  const headingStyle = heading !== null ? `transform: rotate(${heading}deg);` : "display: none;";
  const spinRing = isFocused
    ? `<div class="absolute w-8 h-8 rounded-full border-2 border-dashed animate-spin z-0" style="animation-duration: 4s; border-color: ${dotColor}; box-shadow: 0 0 10px ${dotColor};"></div>`
    : "";

  return L.divIcon({
    className: "custom-marker-icon",
    html: `
      <div class="relative flex items-center justify-center w-6 h-6 font-mono-code">
        ${spinRing}
        <div class="absolute w-3 h-3 rounded-full border-2 border-bg-primary z-10 animate-pulse" style="background-color: ${dotColor}; border-color: ${dotColor}; box-shadow: 0 0 8px ${dotColor};"></div>
        <div class="absolute w-8 h-8 flex items-center justify-center pointer-events-none" style="${headingStyle}">
          <svg width="32" height="32" viewBox="0 0 32 32" class="fill-current opacity-85" style="color: ${dotColor};" xmlns="http://www.w3.org/2000/svg">
            <polygon points="16,2 21,11 16,8 11,11" />
          </svg>
        </div>
        <div class="absolute left-4 bg-bg-card border border-border px-1.5 py-0.5 rounded text-[8px] font-bold text-text-primary uppercase tracking-wider whitespace-nowrap shadow-md">
          ${name.toUpperCase()}
        </div>
        <div class="absolute top-4 text-[8px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">
          ${stalenessLabel}
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export default function RadarMap({ trackerPos, people, alertRadius, history, focusedPeerId, trailEnabled = true }: RadarMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);

  // Recompute clusters every time the peer list updates
  const getDensityClusters = () => {
    const validPeers = people.filter(
      (p) => p.lat && p.lng && p.active && (Date.now() - p.lastSeen) / 1000 <= 60
    );
    const uniqueClusters = new Map<string, { lat: number; lng: number; count: number }>();

    validPeers.forEach((peer) => {
      // Find all peers within 100m using the existing Haversine function
      const nearby = validPeers.filter((other) => {
        const dist = haversine(peer.lat, peer.lng, other.lat, other.lng);
        return dist <= 100;
      });

      if (nearby.length >= 3) {
        const sumLat = nearby.reduce((sum, p) => sum + p.lat, 0);
        const sumLng = nearby.reduce((sum, p) => sum + p.lng, 0);
        const avgLat = sumLat / nearby.length;
        const avgLng = sumLng / nearby.length;

        // Deduplicate using a unique key of sorted peer uids
        const key = nearby
          .map((p) => p.uid)
          .sort()
          .join(",");
        uniqueClusters.set(key, { lat: avgLat, lng: avgLng, count: nearby.length });
      }
    });

    return Array.from(uniqueClusters.values());
  };

  const getOpacityForCount = (count: number) => {
    if (count >= 8) return 0.5;
    if (count >= 5) return 0.35;
    return 0.2;
  };

  useEffect(() => {
    setIsClient(true);
    // Fix default marker asset paths on client side
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
  }, []);

  if (!isClient) return null;

  // Default coordinate if GPS not available (e.g., loading center)
  const defaultCenter = trackerPos || { lat: 0, lng: 0 };

  // Calculate bounding box for the radar overlay using geodesic math
  // (L.circle.getBounds() requires an active map context and fails standalone)
  let overlayBounds: L.LatLngBoundsExpression = [[0, 0], [0, 0]];
  if (trackerPos) {
    const deltaLat = alertRadius / 111320;
    const deltaLng = alertRadius / (111320 * Math.cos((trackerPos.lat * Math.PI) / 180));
    overlayBounds = [
      [trackerPos.lat - deltaLat, trackerPos.lng - deltaLng],
      [trackerPos.lat + deltaLat, trackerPos.lng + deltaLng],
    ];
  }

  return (
    <div className="w-full h-full relative overflow-hidden rounded border border-border bg-bg-primary">
      {trackerPos && (
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            onClick={() => setHeatmapEnabled((prev) => !prev)}
            className={`px-3 py-1.5 border rounded text-[9px] font-mono-code font-bold tracking-wider uppercase transition-all shadow-md ${
              heatmapEnabled
                ? "bg-accent/20 border-accent text-accent hover:bg-accent/30"
                : "bg-bg-secondary/90 border-border text-text-muted hover:border-text-muted hover:text-text-primary"
            }`}
          >
            {heatmapEnabled ? "HEATMAP ON" : "HEATMAP OFF"}
          </button>
        </div>
      )}
      {!trackerPos ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary z-50 font-mono-code text-xs text-text-muted gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span>INITIALIZING GPS SENSORS...</span>
        </div>
      ) : (
        <MapContainer
          center={[defaultCenter.lat, defaultCenter.lng]}
          zoom={15}
          scrollWheelZoom={true}
          className="w-full h-full"
          zoomControl={false}
        >
          {/* Dark themed tile layer */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Recenter control */}
          <RecenterMap center={defaultCenter} />

          {/* Center Tracker Marker */}
          <Marker position={[defaultCenter.lat, defaultCenter.lng]} icon={createTrackerIcon()} />

          {/* Concentric radar rings & sweep overlay */}
          {trackerPos && (
            <SVGOverlay bounds={overlayBounds}>
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
                <defs>
                  <linearGradient id="radarSweepGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Concentric Rings */}
                <circle cx="50" cy="50" r="12.5" fill="none" stroke="#1e3a5f" strokeWidth="0.3" strokeDasharray="1 1" opacity="0.8" />
                <circle cx="50" cy="50" r="25" fill="none" stroke="#1e3a5f" strokeWidth="0.3" strokeDasharray="2 1" opacity="0.6" />
                <circle cx="50" cy="50" r="37.5" fill="none" stroke="#1e3a5f" strokeWidth="0.3" strokeDasharray="3 1" opacity="0.4" />
                <circle cx="50" cy="50" r="50" fill="none" stroke="#1e3a5f" strokeWidth="0.5" opacity="0.3" />

                {/* Radar Crosshairs */}
                <line x1="50" y1="0" x2="50" y2="100" stroke="#1e3a5f" strokeWidth="0.1" opacity="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#1e3a5f" strokeWidth="0.1" opacity="0.5" />

                {/* Sweep Line */}
                <g className="animate-radar-sweep" style={{ transformOrigin: "50% 50%" }}>
                  <path d="M 50 50 L 50 0 A 50 50 0 0 1 85.35 14.64 Z" fill="url(#radarSweepGrad)" />
                  <line x1="50" y1="50" x2="50" y2="0" stroke="var(--accent)" strokeWidth="0.5" opacity="0.8" />
                </g>
              </svg>
            </SVGOverlay>
          )}

          {/* Breadcrumb Trails of Dots */}
          {trailEnabled && people.map((person) => {
            if (!history || !history[person.uid]) return null;
            const points = history[person.uid];
            const N = points.length;
            if (N === 0) return null;

            const distance = trackerPos && person.lat && person.lng
              ? haversine(trackerPos.lat, trackerPos.lng, person.lat, person.lng)
              : Infinity;
            const isInside = distance <= alertRadius;
            const isOffline = !person.active || (Date.now() - person.lastSeen) / 1000 > 60;
            
            const color = isOffline
              ? "#94a3b8"
              : (person.color || (isInside ? "#22c55e" : "#38bdf8"));

            return points.map((p, i) => {
              const ratio = N > 1 ? i / (N - 1) : 1;
              // opacity progressively lower from 100% down to 10% (oldest)
              const opacity = 0.1 + 0.9 * ratio;
              // size decreases from full size down to 30% size (oldest)
              const sizeRatio = 0.3 + 0.7 * ratio;
              const radius = 6 * sizeRatio;

              return (
                <CircleMarker
                  key={`trail-${person.uid}-${i}-${p.ts}`}
                  center={[p.lat, p.lng]}
                  radius={radius}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: opacity,
                    stroke: false,
                  }}
                />
              );
            });
          })}

          {/* Density Heatmap Overlay */}
          {heatmapEnabled &&
            getDensityClusters().map((cluster, idx) => {
              const opacity = getOpacityForCount(cluster.count);
              return (
                <CircleMarker
                  key={`heatmap-${idx}-${cluster.lat}-${cluster.lng}`}
                  center={[cluster.lat, cluster.lng]}
                  radius={80}
                  pathOptions={{
                    fillColor: "rgb(255, 100, 0)",
                    fillOpacity: opacity,
                    stroke: false,
                    interactive: false,
                  }}
                />
              );
            })}

          {/* Tracked People Markers */}
          {people.map((person) => {
            if (!person.lat || !person.lng) return null;
            const distance = haversine(defaultCenter.lat, defaultCenter.lng, person.lat, person.lng);
            const isInside = distance <= alertRadius;
            const secondsAgo = Math.max(0, Math.round((Date.now() - person.lastSeen) / 1000));
            const isOffline = secondsAgo > 60 || !person.active;

            return (
              <Marker
                key={person.uid}
                position={[person.lat, person.lng]}
                icon={createTrackedIcon(person.name, isInside, isOffline, person.heading, person.stalenessLabel, person.color, person.uid === focusedPeerId)}
              />
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}
