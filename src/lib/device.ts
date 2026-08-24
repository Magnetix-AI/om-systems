/** True when running on a phone/tablet — those sessions stay signed in indefinitely. */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPod|iPad|Windows Phone|BlackBerry|Mobile/i.test(ua)) return true;
  // iPadOS 13+ reports as Mac but has touch
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  // Standalone PWA (added to home screen)
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}
