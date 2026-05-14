import { NextResponse } from "next/server";
import {
  errorResponse,
  parseNewOrder,
  readJsonBody,
  runMutation,
} from "@/lib/api-helpers";
import { StoreError, createOrder, listOrders } from "@/lib/orders-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await listOrders();
    return NextResponse.json(orders);
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
  const body = await readJsonBody(request);
  if (body === null) return errorResponse(400, "Invalid JSON body");
  const parsed = parseNewOrder(body);
  if (!parsed.ok) return errorResponse(parsed.status, parsed.message);
  return runMutation(() => createOrder(parsed.value));
}
