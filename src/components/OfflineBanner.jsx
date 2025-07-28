import React, { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onStatus = () => setOffline(!navigator.onLine);
    window.addEventListener("online", onStatus);
    window.addEventListener("offline", onStatus);
    return () => {
      window.removeEventListener("online", onStatus);
      window.removeEventListener("offline", onStatus);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="w-full bg-yellow-500 text-black text-center py-2 font-bold fixed top-0 left-0 z-50 shadow-lg animate-pulse">
      Você está offline. Algumas funções podem estar indisponíveis.
    </div>
  );
}
