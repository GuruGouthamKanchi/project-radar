"use client";

import { useEffect } from "react";
import { ShieldAlert, X } from "lucide-react";

export interface AlertNotification {
  id: string;
  name: string;
  distance: number;
  radius: number;
  timestamp: number;
}

interface AlertBannerProps {
  alerts: AlertNotification[];
  onDismiss: (id: string) => void;
}

export default function AlertBanner({ alerts, onDismiss }: AlertBannerProps) {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-md px-4 flex flex-col gap-2 pointer-events-none">
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function AlertItem({
  alert,
  onDismiss,
}: {
  alert: AlertNotification;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    // Dismiss alert after 6 seconds
    const timer = setTimeout(() => {
      onDismiss(alert.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [alert.id, onDismiss]);

  const timeString = new Date(alert.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-bg-card border-2 border-warning text-warning rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.2)] pointer-events-auto backdrop-blur-md transition-all duration-300 ease-out transform translate-y-0 opacity-100 animate-slide-in">
      <div className="flex items-center gap-3">
        <div className="bg-warning/20 text-warning p-2 rounded-full border border-warning/50">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
        </div>
        <div className="flex flex-col font-mono-code">
          <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-warning/70">
            PROXIMITY ALERT
          </span>
          <span className="text-xs text-text-primary mt-0.5">
            <strong className="text-warning">{alert.name.toUpperCase()}</strong> ENTERED {alert.radius}M ZONE
          </span>
          <span className="text-[9px] text-text-muted mt-0.5">
            DIST: {Math.round(alert.distance)}m — {timeString}
          </span>
        </div>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="text-text-muted hover:text-warning transition-colors p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
