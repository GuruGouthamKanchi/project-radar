"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

interface TrackedMiniMapProps {
  position: { lat: number; lng: number; heading: number | null } | null;
}

function RecenterMap({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center.lat, center.lng, map]);
  return null;
}

const createSelfIcon = (heading: number | null) => {
  const headingStyle = heading !== null ? `transform: rotate(${heading}deg);` : "display: none;";
  return L.divIcon({
    className: "self-marker-icon",
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <div class="absolute w-3.5 h-3.5 rounded-full bg-accent border-2 border-text-primary shadow-[0_0_10px_#38bdf8] animate-pulse z-10"></div>
        <div class="absolute w-6 h-6 rounded-full border border-accent/40 animate-ping-slow"></div>
        <div class="absolute w-8 h-8 flex items-center justify-center pointer-events-none" style="${headingStyle}">
          <svg width="32" height="32" viewBox="0 0 32 32" class="text-accent fill-current opacity-85" xmlns="http://www.w3.org/2000/svg">
            <polygon points="16,2 21,11 16,8 11,11" />
          </svg>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

export default function TrackedMiniMap({ position }: TrackedMiniMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !position) {
    return (
      <div className="w-full h-full bg-bg-secondary flex items-center justify-center border border-border rounded text-[10px] text-text-dim font-mono-code uppercase tracking-wider gap-2">
        <div className="w-4 h-4 rounded-full border border-accent border-t-transparent animate-spin" />
        <span>ACQUIRING POSITION FIX...</span>
      </div>
    );
  }

  return (
    <MapContainer
      center={[position.lat, position.lng]}
      zoom={16}
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      dragging={false}
      className="w-full h-full rounded border border-border"
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <RecenterMap center={position} />
      <Marker position={[position.lat, position.lng]} icon={createSelfIcon(position.heading)} />
    </MapContainer>
  );
}
