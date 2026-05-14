export type OrderStatus =
  | "PENDING"
  | "IN_PRODUCTION"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED"
  | "FLAGGED";

export type OrderPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export interface Order {
  id: string;
  instance_name: string;
  order_number: string;
  customer: string;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_value: number;
  status: OrderStatus;
  priority: OrderPriority;
  due_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface StatusResponse {
  instanceName: string;
  type: "orders";
  orderCount: number;
  flaggedCount: number;
  health: "ok" | "degraded";
  timestamp: string;
}

export interface ApiErrorBody {
  success: false;
  error: string;
}

export interface MutationSuccessBody {
  success: true;
  order: Order;
}

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "IN_PRODUCTION",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "FLAGGED",
];

export const ORDER_PRIORITIES: readonly OrderPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

export type NewOrderInput = Omit<
  Order,
  "id" | "instance_name" | "total_value" | "created_at" | "updated_at"
>;
