import { NextResponse } from "next/server";
import { verifyApiKey } from "./api-keys";
import { CORS_HEADERS } from "./api-helpers";

/**
 * Server-side guard for protected API routes. The dashboard UI of this app
 * calls these routes same-origin and is implicitly trusted — those requests
 * are allowed through without a key. External callers (e.g. Nexus) hit the
 * same routes cross-origin, and those are required to carry a valid
 * `x-api-key` header.
 *
 * Returns:
 * - `null` when the request is allowed.
 * - A 401 NextResponse when it is rejected. Caller should `return` it.
 */
export async function authenticate(
  request: Request,
): Promise<NextResponse | null> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Determine whether the request is cross-origin.
  // - Same-origin browser GETs typically omit `Origin` entirely → allowed.
  // - Same-origin browser mutations send `Origin` matching `host` → allowed.
  // - Cross-origin requests send a different `Origin` → require a key.
  let crossOrigin = false;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) crossOrigin = true;
    } catch {
      // Malformed Origin — treat as cross-origin to be safe.
      crossOrigin = true;
    }
  }

  if (!crossOrigin) {
    return null;
  }

  const raw = request.headers.get("x-api-key");
  if (!raw) {
    return NextResponse.json(
      { success: false, error: "Missing x-api-key header" },
      { status: 401, headers: CORS_HEADERS },
    );
  }
  const record = await verifyApiKey(raw);
  if (!record) {
    return NextResponse.json(
      { success: false, error: "Invalid or revoked API key" },
      { status: 401, headers: CORS_HEADERS },
    );
  }
  return null;
}
