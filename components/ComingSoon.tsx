"use client";

interface ComingSoonProps {
  title: string;
  description: string;
  onBack: () => void;
}

export function ComingSoon({ title, description, onBack }: ComingSoonProps) {
  return (
    <section className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-600">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 max-w-md mx-auto text-sm text-gray-500">{description}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex items-center gap-1 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Dashboard
      </button>
    </section>
  );
}
