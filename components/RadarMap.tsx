"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, SVGOverlay, useMap, Polyline } from "react-leaflet";
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
}

interface RadarMapProps {
  trackerPos: { lat: number; lng: number } | null;
  people: TrackedPerson[];
  alertRadius: number;
  history?: Record<string, { lat: number; lng: number }[]>;
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

const createTrackedIcon = (name: string, isInside: boolean, isOffline: boolean, heading: number | null) => {
  const colorClass = isOffline
    ? "bg-text-dim border-text-muted"
    : isInside
    ? "bg-success border-success"
    : "bg-accent border-accent";
  const pulseClass = isOffline
    ? ""
    : isInside
    ? "animate-pulse-success"
    : "animate-pulse-accent";
  const textColorClass = isOffline
    ? "text-text-muted"
    : isInside
    ? "text-success"
    : "text-accent";

  const headingStyle = heading !== null ? `transform: rotate(${heading}deg);` : "display: none;";

  return L.divIcon({
    className: "custom-marker-icon",
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <div class="absolute w-3 h-3 rounded-full ${colorClass} ${pulseClass} border-2 border-bg-primary z-10"></div>
        <div class="absolute w-8 h-8 flex items-center justify-center pointer-events-none" style="${headingStyle}">
          <svg width="32" height="32" viewBox="0 0 32 32" class="${textColorClass} fill-current opacity-85" xmlns="http://www.w3.org/2000/svg">
            <polygon points="16,2 21,11 16,8 11,11" />
          </svg>
        </div>
        <div class="absolute -top-6 bg-bg-card border border-border px-1.5 py-0.5 rounded text-[8px] font-mono-code font-bold text-text-primary uppercase tracking-wider whitespace-nowrap shadow-md">
          ${name.toUpperCase()}
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export default function RadarMap({ trackerPos, people, alertRadius, history }: RadarMapProps) {
  const [isClient, setIsClient] = useState(false);

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

          {/* Breadcrumb Trails */}
          {people.map((person) => {
            if (!history || !history[person.uid] || history[person.uid].length < 2) return null;
            const points = history[person.uid].map((p) => [p.lat, p.lng] as L.LatLngExpression);
            
            const distance = trackerPos && person.lat && person.lng
              ? haversine(trackerPos.lat, trackerPos.lng, person.lat, person.lng)
              : Infinity;
            const isInside = distance <= alertRadius;
            const isOffline = !person.active || (Date.now() - person.lastSeen) / 1000 > 60;
            
            const color = isOffline
              ? "#94a3b8"
              : isInside
              ? "#22c55e"
              : "#38bdf8";

            return (
              <Polyline
                key={`trail-${person.uid}`}
                positions={points}
                pathOptions={{
                  color: color,
                  weight: 2.5,
                  opacity: 0.5,
                  dashArray: "4, 6",
                  lineCap: "round",
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
                icon={createTrackedIcon(person.name, isInside, isOffline, person.heading)}
              />
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}
