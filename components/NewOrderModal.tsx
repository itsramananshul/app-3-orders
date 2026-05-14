"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ORDER_PRIORITIES,
  ORDER_STATUSES,
  type NewOrderInput,
  type OrderPriority,
  type OrderStatus,
} from "@/lib/types";

interface NewOrderModalProps {
  open: boolean;
  busy: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSubmit: (input: NewOrderInput) => void;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return isoDate(d);
}

function defaultOrderNumber(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PRODUCTION: "In Production",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FLAGGED: "Flagged",
};

const PRIORITY_LABEL: Record<OrderPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export function NewOrderModal({
  open,
  busy,
  errorMessage,
  onCancel,
  onSubmit,
}: NewOrderModalProps) {
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [customer, setCustomer] = useState<string>("");
  const [productSku, setProductSku] = useState<string>("");
  const [productName, setProductName] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [unitPrice, setUnitPrice] = useState<string>("0");
  const [status, setStatus] = useState<OrderStatus>("PENDING");
  const [priority, setPriority] = useState<OrderPriority>("NORMAL");
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrderNumber(defaultOrderNumber());
    setCustomer("");
    setProductSku("");
    setProductName("");
    setQuantity("1");
    setUnitPrice("0");
    setStatus("PENDING");
    setPriority("NORMAL");
    setDueDate(defaultDueDate());
    setNotes("");
    requestAnimationFrame(() => {
      firstInputRef.current?.focus();
      firstInputRef.current?.select();
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  const parsedQuantity = Number.parseInt(quantity, 10);
  const parsedPrice = Number.parseFloat(unitPrice);

  const isoOk = /^\d{4}-\d{2}-\d{2}$/.test(dueDate);

  const isValid = useMemo(() => {
    if (!orderNumber.trim()) return false;
    if (!customer.trim()) return false;
    if (!productSku.trim()) return false;
    if (!productName.trim()) return false;
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) return false;
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) return false;
    if (!isoOk) return false;
    return true;
  }, [
    orderNumber,
    customer,
    productSku,
    productName,
    parsedQuantity,
    parsedPrice,
    isoOk,
  ]);

  if (!open) return null;

  const submit = () => {
    if (!isValid || busy) return;
    const input: NewOrderInput = {
      order_number: orderNumber.trim(),
      customer: customer.trim(),
      product_sku: productSku.trim(),
      product_name: productName.trim(),
      quantity: parsedQuantity,
      unit_price: parsedPrice,
      status,
      priority,
      due_date: dueDate,
      notes,
    };
    onSubmit(input);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-order-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl ring-1 ring-gray-100">
        <h2
          id="new-order-modal-title"
          className="text-lg font-semibold text-gray-900"
        >
          Create new order
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Fill in the details below to create a new order in this instance.
        </p>

        <form
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Order number
            </span>
            <input
              ref={firstInputRef}
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Customer
            </span>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Product SKU
            </span>
            <input
              type="text"
              value={productSku}
              onChange={(e) => setProductSku(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Product name
            </span>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Quantity
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Unit price (USD)
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Priority
            </span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as OrderPriority)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            >
              {ORDER_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Due date
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
              rows={3}
              className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-sm text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </label>

          {errorMessage ? (
            <p className="sm:col-span-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || busy}
              className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
