"use client";

import { useEffect, useState } from "react";
import {
  ORDER_PRIORITIES,
  ORDER_STATUSES,
  type NewOrderInput,
  type OrderPriority,
  type OrderStatus,
} from "@/lib/types";

interface NewOrderModalProps {
  open: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (input: NewOrderInput) => void;
}

interface FormState {
  order_number: string;
  customer: string;
  product_sku: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  status: OrderStatus;
  priority: OrderPriority;
  due_date: string;
  notes: string;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const emptyForm = (): FormState => ({
  order_number: "",
  customer: "",
  product_sku: "",
  product_name: "",
  quantity: "1",
  unit_price: "0",
  status: "PENDING",
  priority: "NORMAL",
  due_date: todayISO(),
  notes: "",
});

const inputClass =
  "w-full rounded-lg border-0 bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-inset ring-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60";

const labelText = "text-xs font-medium uppercase tracking-wider text-slate-400";

export function NewOrderModal({
  open,
  busy = false,
  errorMessage,
  onCancel,
  onSubmit,
}: NewOrderModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyForm());
      setTouched(false);
    }
  }, [open]);

  if (!open) return null;

  const quantity = Number.parseInt(form.quantity, 10);
  const unitPrice = Number.parseFloat(form.unit_price);

  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.order_number.trim()) errors.order_number = "Required";
  if (!form.customer.trim()) errors.customer = "Required";
  if (!form.product_sku.trim()) errors.product_sku = "Required";
  if (!form.product_name.trim()) errors.product_name = "Required";
  if (!Number.isInteger(quantity) || quantity <= 0)
    errors.quantity = "Must be a positive integer";
  if (!Number.isFinite(unitPrice) || unitPrice < 0)
    errors.unit_price = "Must be non-negative";
  if (!form.due_date) errors.due_date = "Required";

  const isValid = Object.keys(errors).length === 0;
  const totalPreview =
    isValid && Number.isFinite(quantity * unitPrice)
      ? (quantity * unitPrice).toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
        })
      : "—";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-2xl rounded-xl bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-700">
        <h2 className="text-lg font-semibold text-slate-100">Create new order</h2>
        <p className="mt-1 text-sm text-slate-400">
          Order is scoped to the current instance. Total is calculated
          automatically as quantity × unit price.
        </p>

        <form
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!isValid || busy) return;
            onSubmit({
              order_number: form.order_number.trim(),
              customer: form.customer.trim(),
              product_sku: form.product_sku.trim(),
              product_name: form.product_name.trim(),
              quantity,
              unit_price: unitPrice,
              status: form.status,
              priority: form.priority,
              due_date: form.due_date,
              notes: form.notes.trim(),
            });
          }}
        >
          <label className="block sm:col-span-1">
            <span className={labelText}>Order Number</span>
            <input
              className={inputClass}
              value={form.order_number}
              onChange={(e) =>
                setForm((s) => ({ ...s, order_number: e.target.value }))
              }
              disabled={busy}
              placeholder="ORD-F1-099"
            />
            {touched && errors.order_number ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.order_number}
              </span>
            ) : null}
          </label>

          <label className="block sm:col-span-1">
            <span className={labelText}>Customer</span>
            <input
              className={inputClass}
              value={form.customer}
              onChange={(e) =>
                setForm((s) => ({ ...s, customer: e.target.value }))
              }
              disabled={busy}
            />
            {touched && errors.customer ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.customer}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className={labelText}>Product SKU</span>
            <input
              className={inputClass}
              value={form.product_sku}
              onChange={(e) =>
                setForm((s) => ({ ...s, product_sku: e.target.value }))
              }
              disabled={busy}
            />
            {touched && errors.product_sku ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.product_sku}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className={labelText}>Product Name</span>
            <input
              className={inputClass}
              value={form.product_name}
              onChange={(e) =>
                setForm((s) => ({ ...s, product_name: e.target.value }))
              }
              disabled={busy}
            />
            {touched && errors.product_name ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.product_name}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className={labelText}>Quantity</span>
            <input
              className={inputClass}
              type="number"
              min={1}
              step={1}
              value={form.quantity}
              onChange={(e) =>
                setForm((s) => ({ ...s, quantity: e.target.value }))
              }
              disabled={busy}
            />
            {touched && errors.quantity ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.quantity}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className={labelText}>Unit Price (USD)</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              step="0.01"
              value={form.unit_price}
              onChange={(e) =>
                setForm((s) => ({ ...s, unit_price: e.target.value }))
              }
              disabled={busy}
            />
            {touched && errors.unit_price ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.unit_price}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className={labelText}>Status</span>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) =>
                setForm((s) => ({ ...s, status: e.target.value as OrderStatus }))
              }
              disabled={busy}
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelText}>Priority</span>
            <select
              className={inputClass}
              value={form.priority}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  priority: e.target.value as OrderPriority,
                }))
              }
              disabled={busy}
            >
              {ORDER_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelText}>Due Date</span>
            <input
              className={inputClass}
              type="date"
              value={form.due_date}
              onChange={(e) =>
                setForm((s) => ({ ...s, due_date: e.target.value }))
              }
              disabled={busy}
            />
            {touched && errors.due_date ? (
              <span className="mt-1 block text-xs text-rose-300">
                {errors.due_date}
              </span>
            ) : null}
          </label>

          <div className="block">
            <span className={labelText}>Total (preview)</span>
            <div className="mt-2 rounded-lg bg-slate-800/60 px-3 py-2 text-sm tabular-nums text-slate-100 ring-1 ring-inset ring-slate-700">
              {totalPreview}
            </div>
          </div>

          <label className="block sm:col-span-2">
            <span className={labelText}>Notes (optional)</span>
            <textarea
              className={inputClass}
              rows={3}
              value={form.notes}
              onChange={(e) =>
                setForm((s) => ({ ...s, notes: e.target.value }))
              }
              disabled={busy}
            />
          </label>

          {errorMessage ? (
            <p className="sm:col-span-2 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (touched && !isValid)}
              className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
