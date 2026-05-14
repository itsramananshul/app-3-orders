import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-helpers";
import { StoreError, getOrder } from "@/lib/orders-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const order = await getOrder(params.id);
    if (!order) return errorResponse(404, "Order not found");
    return NextResponse.json(order);
  } catch (e) {
    if (e instanceof StoreError) {
      return errorResponse(500, e.message || "Failed to load order");
    }
    return errorResponse(
      500,
      e instanceof Error ? e.message : "Failed to load order",
    );
  }
}
