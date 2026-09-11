import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for "Fetch from API" — the browser can't call most real
// integration endpoints directly (CORS blocks cross-origin calls, and any API
// key would sit exposed in browser devtools). This route does the actual outbound
// call from the Node runtime instead; the browser only ever talks to this same-origin
// route, and never to the third-party API directly.

interface FetchSampleRequest {
  method?: "GET" | "POST";
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}

const TIMEOUT_MS = 15000;

export async function POST(req: NextRequest) {
  let payload: FetchSampleRequest;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." });
  }

  const { method, url, headers, body } = payload;
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ ok: false, error: "URL must start with http:// or https://." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: method === "POST" ? "POST" : "GET",
      headers,
      body: method === "POST" && body ? body : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    return NextResponse.json({ ok: response.ok, status: response.status, text });
  } catch (e) {
    // Node's fetch wraps the real network/TLS error behind a generic "fetch failed" —
    // the actual reason lives in `.cause`.
    const cause = e instanceof Error && e.cause instanceof Error ? `: ${e.cause.message}` : "";
    const message =
      e instanceof Error && e.name === "AbortError"
        ? `Request timed out after ${TIMEOUT_MS / 1000}s.`
        : e instanceof Error
          ? `${e.message}${cause}`
          : "Fetch failed.";
    return NextResponse.json({ ok: false, error: message });
  } finally {
    clearTimeout(timeout);
  }
}
