import { NextResponse } from "next/server";
import { verifyApiKey } from "./api-keys";

/**
 * Server-side guard for protected API routes. Returns:
 * - `null` when the request carries a valid, non-revoked key.
 * - A 401 NextResponse otherwise — caller should `return` it.
 */
export async function authenticate(
  request: Request,
): Promise<NextResponse | null> {
  const raw = request.headers.get("x-api-key");
  if (!raw) {
    return NextResponse.json(
      { success: false, error: "Missing x-api-key header" },
      { status: 401 },
    );
  }
  const record = await verifyApiKey(raw);
  if (!record) {
    return NextResponse.json(
      { success: false, error: "Invalid or revoked API key" },
      { status: 401 },
    );
  }
  return null;
}
