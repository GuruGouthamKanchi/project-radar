"use client";

import { useEffect, useState } from "react";

interface PersonCardProps {
  name: string;
  distance: number | null;
  lastSeen: number;
  alertRadius: number;
  active: boolean;
}

export default function PersonCard({
  name,
  distance,
  lastSeen,
  alertRadius,
  active,
}: PersonCardProps) {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    setSecondsAgo(Math.max(0, Math.round((Date.now() - lastSeen) / 1000)));

    const interval = setInterval(() => {
      setSecondsAgo(Math.max(0, Math.round((Date.now() - lastSeen) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [lastSeen]);

  const getInitials = (n: string) => {
    return n
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .substring(0, 2)
      .toUpperCase() || "??";
  };

  const isOffline = secondsAgo > 60 || !active;
  const isInside = distance !== null && distance <= alertRadius;

  let statusText = "OFFLINE";
  let pulseClass = "";

  if (!isOffline) {
    if (isInside) {
      statusText = "IN ZONE";
      pulseClass = "animate-pulse-success";
    } else {
      statusText = "OUTSIDE";
      pulseClass = "animate-pulse-accent";
    }
  }

  const formatDistance = (dist: number | null) => {
    if (dist === null) return "--";
    if (dist >= 1000) return `${(dist / 1000).toFixed(2)}KM`;
    return `${Math.round(dist)}M`;
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-bg-card border border-border rounded w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`relative flex items-center justify-center w-8 h-8 rounded-full bg-bg-secondary border border-border flex-shrink-0 ${pulseClass}`}
          >
            <span className="font-mono-code font-bold text-xs text-text-primary">
              {getInitials(name)}
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono-code text-xs font-bold text-text-primary truncate uppercase tracking-wider">
              {name}
            </span>
            <span className="font-mono-code text-[9px] text-text-muted">
              {isOffline ? "DISCONNECTED" : `PING: ${secondsAgo}S AGO`}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className={`font-mono-code text-[8px] font-bold px-1.5 py-0.5 rounded ${
              isOffline
                ? "bg-text-dim text-text-muted"
                : isInside
                ? "bg-success/20 text-success border border-success/30"
                : "bg-accent/20 text-accent border border-accent/30"
            }`}
          >
            {statusText}
          </span>
          <span className="font-mono-code text-xs font-bold text-text-primary">
            {formatDistance(distance)}
          </span>
        </div>
      </div>
    </div>
  );
}
