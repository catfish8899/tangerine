// src/components/automation/SystemTimeBadge.tsx
import React, { useEffect, useMemo, useState } from "react";

export default function SystemTimeBadge() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const formatted = useMemo(() => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "下午" : "上午";

    hours = hours % 12;
    hours = hours || 12;

    return `${year}年${month}月${day}日 ${ampm} ${hours}:${minutes}:${seconds}`;
  }, [now]);

  return (
    <div className="pointer-events-none absolute right-5 top-5 z-40 rounded-xl border border-[#343434] bg-[#1f1f1f]/85 px-3 py-2 text-xs font-medium tracking-wide text-gray-300 shadow-xl backdrop-blur-xl">
      {formatted}
    </div>
  );
}