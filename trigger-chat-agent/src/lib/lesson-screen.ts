// Deterministic red-flag scan of a lesson's model-authored HTML. Pure and
// React-free so it can run in the Trigger task (server-side screening) and be
// unit-tested in isolation. This is the guaranteed layer beneath the LLM
// fan-out screen — it catches the concrete exfiltration / phishing / navigation
// patterns with zero latency or cost. A hit fails the renderVisualization tool,
// so the model regenerates a clean lesson via the normal validate-and-retry loop.

export const LESSON_RED_FLAGS: { pattern: RegExp; threat: string }[] = [
  {
    pattern: /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\.sendBeacon\s*\(/i,
    threat: "a network call (fetch/XHR/beacon/websocket)",
  },
  { pattern: /<form[\s>]|formaction\s*=/i, threat: "a <form> (lessons never collect input to submit)" },
  {
    pattern:
      /<input[^>]*type\s*=\s*["']?password|<input[^>]*(name|id|placeholder)\s*=\s*["'][^"']*(token|secret|api[_-]?key|password)/i,
    threat: "a credential input field",
  },
  { pattern: /document\.cookie|localStorage|sessionStorage/i, threat: "access to cookies or storage" },
  {
    pattern:
      /location\.(href|assign|replace)\s*[=(]|\blocation\s*=\s*["']https?:|window\.open\s*\(|\btop\.location|parent\.(location|postMessage)/i,
    threat: "navigation, redirect, or cross-frame access",
  },
  {
    pattern: /<iframe[\s>]|<object[\s>]|<embed[\s>]|http-equiv\s*=\s*["']?refresh/i,
    threat: "a nested frame / object / meta-refresh",
  },
  { pattern: /\beval\s*\(|new\s+Function\s*\(/i, threat: "eval / new Function" },
  { pattern: /new\s+Image\s*\(|\.src\s*=\s*["']https?:/i, threat: "an image/script beacon to an external URL" },
];

/** Returns the list of threats found in a lesson's HTML (empty = clean). */
export function staticLessonThreats(html: string): string[] {
  return LESSON_RED_FLAGS.filter((r) => r.pattern.test(html)).map((r) => r.threat);
}
