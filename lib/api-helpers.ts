import { NextResponse } from "next/server";
import { StoreError } from "./orders-store";
import {
  ORDER_PRIORITIES,
  ORDER_STATUSES,
  type ApiErrorBody,
  type MutationSuccessBody,
  type NewOrderInput,
  type Order,
  type OrderPriority,
  type OrderStatus,
} from "./types";

export function errorResponse(status: number, message: string) {
  return NextResponse.json<ApiErrorBody>(
    { success: false, error: message },
    { status },
  );
}

export function mutationSuccessResponse(order: Order) {
  return NextResponse.json<MutationSuccessBody>({ success: true, order });
}

export function mapStoreError(e: StoreError) {
  switch (e.kind) {
    case "not_found":
      return errorResponse(404, e.message || "Order not found");
    case "db_error":
      return errorResponse(500, e.message || "Database error");
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function runMutation(
  fn: () => Promise<Order>,
): Promise<Response> {
  try {
    const order = await fn();
    return mutationSuccessResponse(order);
  } catch (e) {
    if (e instanceof StoreError) return mapStoreError(e);
    const message = e instanceof Error ? e.message : "Server error";
    return errorResponse(500, message);
  }
}

export type FieldParse<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; message: string };

export function parseStatus(body: unknown): FieldParse<OrderStatus> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, status: 400, message: "Invalid JSON body" };
  }
  const value = (body as { status?: unknown }).status;
  if (typeof value !== "string") {
    return { ok: false, status: 400, message: "status must be a string" };
  }
  if (!ORDER_STATUSES.includes(value as OrderStatus)) {
    return {
      ok: false,
      status: 400,
      message: `status must be one of: ${ORDER_STATUSES.join(", ")}`,
    };
  }
  return { ok: true, value: value as OrderStatus };
}

export function parsePriority(body: unknown): FieldParse<OrderPriority> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, status: 400, message: "Invalid JSON body" };
  }
  const value = (body as { priority?: unknown }).priority;
  if (typeof value !== "string") {
    return { ok: false, status: 400, message: "priority must be a string" };
  }
  if (!ORDER_PRIORITIES.includes(value as OrderPriority)) {
    return {
      ok: false,
      status: 400,
      message: `priority must be one of: ${ORDER_PRIORITIES.join(", ")}`,
    };
  }
  return { ok: true, value: value as OrderPriority };
}

export function parseNote(body: unknown): FieldParse<string> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, status: 400, message: "Invalid JSON body" };
  }
  const value = (body as { note?: unknown }).note;
  if (typeof value !== "string" || value.trim() === "") {
    return {
      ok: false,
      status: 400,
      message: "note must be a non-empty string",
    };
  }
  return { ok: true, value };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseNewOrder(body: unknown): FieldParse<NewOrderInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, status: 400, message: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.order_number)) {
    return { ok: false, status: 400, message: "order_number is required" };
  }
  if (!isNonEmptyString(b.customer)) {
    return { ok: false, status: 400, message: "customer is required" };
  }
  if (!isNonEmptyString(b.product_sku)) {
    return { ok: false, status: 400, message: "product_sku is required" };
  }
  if (!isNonEmptyString(b.product_name)) {
    return { ok: false, status: 400, message: "product_name is required" };
  }
  if (
    typeof b.quantity !== "number" ||
    !Number.isFinite(b.quantity) ||
    !Number.isInteger(b.quantity) ||
    b.quantity <= 0
  ) {
    return {
      ok: false,
      status: 400,
      message: "quantity must be a positive integer",
    };
  }
  if (
    typeof b.unit_price !== "number" ||
    !Number.isFinite(b.unit_price) ||
    b.unit_price < 0
  ) {
    return {
      ok: false,
      status: 400,
      message: "unit_price must be a non-negative number",
    };
  }
  if (
    typeof b.status !== "string" ||
    !ORDER_STATUSES.includes(b.status as OrderStatus)
  ) {
    return {
      ok: false,
      status: 400,
      message: `status must be one of: ${ORDER_STATUSES.join(", ")}`,
    };
  }
  if (
    typeof b.priority !== "string" ||
    !ORDER_PRIORITIES.includes(b.priority as OrderPriority)
  ) {
    return {
      ok: false,
      status: 400,
      message: `priority must be one of: ${ORDER_PRIORITIES.join(", ")}`,
    };
  }
  if (typeof b.due_date !== "string" || !ISO_DATE_RE.test(b.due_date)) {
    return {
      ok: false,
      status: 400,
      message: "due_date must be a date string in YYYY-MM-DD format",
    };
  }
  const notes = typeof b.notes === "string" ? b.notes : "";

  return {
    ok: true,
    value: {
      order_number: b.order_number,
      customer: b.customer,
      product_sku: b.product_sku,
      product_name: b.product_name,
      quantity: b.quantity,
      unit_price: b.unit_price,
      status: b.status as OrderStatus,
      priority: b.priority as OrderPriority,
      due_date: b.due_date,
      notes,
    },
  };
}
