import { ORDERS_TABLE, getInstanceName, getSupabase } from "./supabase";
import type {
  NewOrderInput,
  Order,
  OrderPriority,
  OrderStatus,
} from "./types";

export type StoreErrorKind = "not_found" | "db_error";

export class StoreError extends Error {
  readonly kind: StoreErrorKind;
  constructor(kind: StoreErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
    this.name = "StoreError";
  }
}

const PRIORITY_RANK: Record<OrderPriority, number> = {
  URGENT: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
};

interface DbRow {
  id: string;
  instance_name: string;
  order_number: string;
  customer: string;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  total_value: number | string;
  status: string;
  priority: string;
  due_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

function n(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function toOrder(row: DbRow): Order {
  return {
    id: row.id,
    instance_name: row.instance_name,
    order_number: row.order_number,
    customer: row.customer,
    product_sku: row.product_sku,
    product_name: row.product_name,
    quantity: row.quantity,
    unit_price: n(row.unit_price),
    total_value: n(row.total_value),
    status: row.status as OrderStatus,
    priority: row.priority as OrderPriority,
    due_date: row.due_date,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function sortOrders(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const dateCmp = a.due_date.localeCompare(b.due_date);
    if (dateCmp !== 0) return dateCmp;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
}

export async function listOrders(): Promise<Order[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select("*")
    .eq("instance_name", getInstanceName());

  if (error) throw new StoreError("db_error", error.message);
  return sortOrders(((data as DbRow[] | null) ?? []).map(toOrder));
}

export async function getOrder(id: string): Promise<Order | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select("*")
    .eq("instance_name", getInstanceName())
    .eq("id", id)
    .maybeSingle();

  if (error) throw new StoreError("db_error", error.message);
  return data ? toOrder(data as DbRow) : null;
}

export async function orderCount(): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from(ORDERS_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("instance_name", getInstanceName());

  if (error) throw new StoreError("db_error", error.message);
  return count ?? 0;
}

export async function flaggedCount(): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from(ORDERS_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("instance_name", getInstanceName())
    .eq("status", "FLAGGED");

  if (error) throw new StoreError("db_error", error.message);
  return count ?? 0;
}

async function patchById(
  id: string,
  patch: Partial<Pick<DbRow, "status" | "priority" | "notes">>,
): Promise<Order> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .update(patch)
    .eq("instance_name", getInstanceName())
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new StoreError("db_error", error.message);
  if (!data) throw new StoreError("not_found", "Order not found");
  return toOrder(data as DbRow);
}

export function updateStatus(
  id: string,
  status: OrderStatus,
): Promise<Order> {
  return patchById(id, { status });
}

export function updatePriority(
  id: string,
  priority: OrderPriority,
): Promise<Order> {
  return patchById(id, { priority });
}

export async function addNote(id: string, note: string): Promise<Order> {
  const current = await getOrder(id);
  if (!current) throw new StoreError("not_found", "Order not found");
  const stamped = `[${new Date().toISOString()}] ${note.trim()}`;
  const existing = current.notes?.trim() ?? "";
  const merged = existing.length > 0 ? `${existing}\n${stamped}` : stamped;
  return patchById(id, { notes: merged });
}

export async function createOrder(data: NewOrderInput): Promise<Order> {
  const supabase = getSupabase();
  const row = {
    instance_name: getInstanceName(),
    order_number: data.order_number,
    customer: data.customer,
    product_sku: data.product_sku,
    product_name: data.product_name,
    quantity: data.quantity,
    unit_price: data.unit_price,
    status: data.status,
    priority: data.priority,
    due_date: data.due_date,
    notes: data.notes,
  };
  const { data: inserted, error } = await supabase
    .from(ORDERS_TABLE)
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error) throw new StoreError("db_error", error.message);
  if (!inserted) throw new StoreError("db_error", "Insert returned no row");
  return toOrder(inserted as DbRow);
}
