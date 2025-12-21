import { useState, useEffect } from "react";

interface OnlineStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
}

export function useOnlineStatus() {
  const [status, setStatus] = useState<OnlineStatus>({
    isOnline: navigator.onLine,
    lastSyncTime: new Date(),
    pendingChanges: 0,
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        lastSyncTime: new Date(),
        pendingChanges: 0,
      }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
      }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const incrementPendingChanges = () => {
    setStatus((prev) => ({
      ...prev,
      pendingChanges: prev.pendingChanges + 1,
    }));
  };

  const resetPendingChanges = () => {
    setStatus((prev) => ({
      ...prev,
      pendingChanges: 0,
      lastSyncTime: new Date(),
    }));
  };

  return {
    ...status,
    incrementPendingChanges,
    resetPendingChanges,
  };
}
