"use client";

export type NavView =
  | "dashboard"
  | "orders"
  | "customers"
  | "products"
  | "reports";

interface TopNavProps {
  instanceName: string;
  currentView: NavView;
  onChangeView: (view: NavView) => void;
  onOpenApiKeys: () => void;
}

const NAV_ITEMS: { key: NavView; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" },
  { key: "products", label: "Products" },
  { key: "reports", label: "Reports" },
];

export function TopNav({
  instanceName,
  currentView,
  onChangeView,
  onOpenApiKeys,
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-6">
        <button
          type="button"
          onClick={() => onChangeView("dashboard")}
          className="flex items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-teal-500"
            aria-hidden
          >
            <path d="M16 16h6" />
            <path d="M3 6h18l-2 12H5L3 6z" />
            <path d="M3 6L2 3H0" />
            <circle cx="9" cy="21" r="1.5" />
            <circle cx="18" cy="21" r="1.5" />
          </svg>
          <span className="text-lg font-semibold text-gray-900">Orders</span>
        </button>

        <nav className="hidden gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.key === currentView;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChangeView(item.key)}
                className={`relative px-3 py-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded ${
                  active
                    ? "text-teal-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-teal-500" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <span
            className="mr-2 hidden text-xs text-gray-400 sm:inline"
            title="Set via INSTANCE_NAME env var"
          >
            {instanceName}
          </span>
          <button
            type="button"
            onClick={onOpenApiKeys}
            aria-label="API Keys"
            title="API Keys"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <circle cx="7.5" cy="15.5" r="5.5" />
              <path d="m21 2-9.6 9.6" />
              <path d="m15.5 7.5 3 3L22 7l-3-3" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Settings"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>
          <div
            className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-semibold text-white shadow-sm"
            aria-label={`${instanceName} avatar`}
          >
            {instanceName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
