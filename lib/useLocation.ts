import { useEffect, useRef, useState } from "react";
import { ref, set, onDisconnect } from "firebase/database";
import { db } from "./firebase";
import { haversine } from "./haversine";
import { LocationPayload } from "./locationValidator";
import { removeLocation } from "./firebaseLocation";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useLocation(roomCode: string, encryptionKey?: string) {
  const [isTracking, setIsTracking] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    heading: number | null;
  } | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const isTrackingRef = useRef<boolean>(false);
  const uploadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestLocationRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(null);
  const nameRef = useRef<string>("Anonymous");
  const uidRef = useRef<string>("");

  const currentIntervalRef = useRef<number>(5000);
  const stationaryTimeRef = useRef<number>(0);
  const lastReportedLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const flushQueue = async () => {
    if (typeof window === "undefined" || !navigator.onLine) return;
    const queueStr = localStorage.getItem("proximax_offline_queue");
    if (!queueStr) return;
    try {
      const queue = JSON.parse(queueStr);
      if (!Array.isArray(queue) || queue.length === 0) return;
      
      const newQueue = [...queue];
      while (newQueue.length > 0) {
        const item = newQueue[0];
        const userRef = ref(db, item.path);
        await set(userRef, item.payload);
        newQueue.shift();
      }
      localStorage.removeItem("proximax_offline_queue");
    } catch (err) {
      console.error("Failed to flush offline queue:", err);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      let uid = sessionStorage.getItem("proximax_uid");
      if (!uid) {
        uid = Math.random().toString(36).substring(2) + Date.now().toString(36);
        sessionStorage.setItem("proximax_uid", uid);
      }
      uidRef.current = uid;

      const handleOnline = () => {
        flushQueue();
      };
      window.addEventListener("online", handleOnline);
      flushQueue();

      return () => {
        window.removeEventListener("online", handleOnline);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        if (uploadTimeoutRef.current !== null) {
          clearTimeout(uploadTimeoutRef.current);
          uploadTimeoutRef.current = null;
        }
        if (uidRef.current) {
          removeLocation(roomCode, uidRef.current).catch((err) =>
            console.error("On unmount cleanup failed:", err)
          );
        }
      };
    }
  }, [roomCode]);

  const uploadLocation = async () => {
    if (!latestLocationRef.current || !uidRef.current) return;

    const path = `rooms/${roomCode}/peers/${uidRef.current}`;

    const lat2 = latestLocationRef.current.lat;
    const lng2 = latestLocationRef.current.lng;

    const lat1 = lastReportedLocationRef.current?.lat;
    const lng1 = lastReportedLocationRef.current?.lng;

    let moved = true;
    if (lat1 !== undefined && lng1 !== undefined) {
      const dist = haversine(lat1, lng1, lat2, lng2);
      if (dist < 5) {
        moved = false;
      }
    }

    if (!moved) {
      stationaryTimeRef.current += currentIntervalRef.current;
      if (stationaryTimeRef.current >= 30000) {
        currentIntervalRef.current = 20000;
      }
    } else {
      stationaryTimeRef.current = 0;
      currentIntervalRef.current = 5000;
      lastReportedLocationRef.current = { lat: lat2, lng: lng2 };
    }

    const payload: LocationPayload = {
      lat: lat2,
      lng: lng2,
      ts: Date.now(),
      peerId: uidRef.current,
      nickname: (typeof window !== "undefined" && localStorage.getItem("proximax_nickname")) || nameRef.current,
      color: (typeof window !== "undefined" && localStorage.getItem("proximax_color")) || "#00FF41",
    };

    if (typeof window !== "undefined" && !navigator.onLine) {
      const queueStr = localStorage.getItem("proximax_offline_queue");
      const queue = queueStr ? JSON.parse(queueStr) : [];
      queue.push({ path, payload });
      localStorage.setItem("proximax_offline_queue", JSON.stringify(queue));
      return;
    }

    try {
      const userRef = ref(db, path);
      await set(userRef, payload);

      // Setup onDisconnect cleanup
      await onDisconnect(userRef).remove();
      const sosRef = ref(db, `rooms/${roomCode}/sos/${uidRef.current}`);
      await onDisconnect(sosRef).remove();

      // Update room last activity metadata
      const metaActivityRef = ref(db, `rooms/${roomCode}/meta/lastActivity`);
      await set(metaActivityRef, Date.now());
    } catch (err) {
      console.error("Firebase upload failed, queueing offline:", err);
      if (typeof window !== "undefined") {
        const queueStr = localStorage.getItem("proximax_offline_queue");
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({ path, payload });
        localStorage.setItem("proximax_offline_queue", JSON.stringify(queue));
      }
    }
  };

  const scheduleNextUpload = (delay: number) => {
    if (uploadTimeoutRef.current) clearTimeout(uploadTimeoutRef.current);
    uploadTimeoutRef.current = setTimeout(async () => {
      await uploadLocation();
      if (isTrackingRef.current) {
        scheduleNextUpload(currentIntervalRef.current);
      }
    }, delay);
  };

  const startTracking = async (displayName: string) => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    setError(null);
    setIsTracking(true);
    isTrackingRef.current = true;
    nameRef.current = displayName || "Anonymous";

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, heading } = position.coords;
      const newLoc = { lat: latitude, lng: longitude, heading: heading ?? null };
      latestLocationRef.current = newLoc;
      setCurrentLocation((prev) => {
        // functional update to avoid stale closures
        return { lat: latitude, lng: longitude, heading: heading ?? null };
      });
    };

    const handleError = (err: GeolocationPositionError) => {
      setError(err.message);
      setIsTracking(false);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (uploadTimeoutRef.current !== null) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // Run first upload immediately
    setTimeout(async () => {
      await uploadLocation();
      scheduleNextUpload(currentIntervalRef.current);
    }, 100);
  };

  const stopTracking = async () => {
    setIsStopping(true);
    try {
      setIsTracking(false);
      isTrackingRef.current = false;

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      if (uploadTimeoutRef.current !== null) {
        clearTimeout(uploadTimeoutRef.current);
        uploadTimeoutRef.current = null;
      }

      if (uidRef.current) {
        await removeLocation(roomCode, uidRef.current);
        const sosRef = ref(db, `rooms/${roomCode}/sos/${uidRef.current}`);
        await set(sosRef, null);
      }
    } catch (err) {
      console.error("Stop broadcast error:", err);
    } finally {
      setIsStopping(false);
      latestLocationRef.current = null;
      setCurrentLocation(null);
    }
  };

  return {
    isTracking,
    isStopping,
    error,
    currentLocation,
    startTracking,
    stopTracking,
    uid: uidRef.current,
  };
}

