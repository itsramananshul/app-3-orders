import { NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import { CORS_HEADERS, errorResponse, optionsResponse } from "@/lib/api-helpers";
import { StoreError, flaggedCount, orderCount } from "@/lib/orders-store";
import type { StatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await authenticate(request);
  if (authError) return authError;
  try {
    const [count, flagged] = await Promise.all([
      orderCount(),
      flaggedCount(),
    ]);
    const payload: StatusResponse = {
      instanceName: process.env.INSTANCE_NAME?.trim() ?? "Unknown Instance",
      type: "orders",
      orderCount: count,
      flaggedCount: flagged,
      health: flagged > 0 ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(payload, { headers: CORS_HEADERS });
  } catch (e) {
    if (e instanceof StoreError) {
      return errorResponse(500, e.message || "Status check failed");
    }
    return errorResponse(
      500,
      e instanceof Error ? e.message : "Status check failed",
    );
  }
}

export const OPTIONS = optionsResponse;
