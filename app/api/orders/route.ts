import { NextResponse } from "next/server";
import { authenticate } from "@/lib/authenticate";
import {
  CORS_HEADERS,
  errorResponse,
  optionsResponse,
  parseNewOrder,
  readJsonBody,
  runMutation,
} from "@/lib/api-helpers";
import { StoreError, createOrder, listOrders } from "@/lib/orders-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await authenticate(request);
  if (authError) return authError;
  try {
    const orders = await listOrders();
    return NextResponse.json(orders, { headers: CORS_HEADERS });
  } catch (e) {
    if (e instanceof StoreError) {
      return errorResponse(500, e.message || "Failed to load orders");
    }
    return errorResponse(
      500,
      e instanceof Error ? e.message : "Failed to load orders",
    );
  }
}

export async function POST(request: Request) {
  const authError = await authenticate(request);
  if (authError) return authError;
  const body = await readJsonBody(request);
  if (body === null) return errorResponse(400, "Invalid JSON body");
  const parsed = parseNewOrder(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.message);
  return runMutation(() => createOrder(parsed.value));
}

export const OPTIONS = optionsResponse;
