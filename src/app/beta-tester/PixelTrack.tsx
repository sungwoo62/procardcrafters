"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Meta Pixel custom event fire (OMO-2427).
 * mount 시 1회 fire — useEffect deps 비어있어 SPA 네비게이션 대비 충분.
 */
export default function PixelTrack({
  event,
  contentName,
}: {
  event: "ViewContent" | "CompleteRegistration";
  contentName?: string;
}) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.fbq !== "function") return;
    if (event === "ViewContent") {
      window.fbq("track", "ViewContent", {
        content_name: contentName ?? "beta_tester_landing",
        content_category: "beta_program",
      });
    } else {
      window.fbq("track", "CompleteRegistration", {
        content_name: contentName ?? "beta_tester_landing",
        status: "submitted",
      });
    }
  }, [event, contentName]);

  return null;
}
