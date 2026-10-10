"use client";

export function SaveButton({ saved, title, onToggle, className = "" }: { saved: boolean; title: string; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={`save ${saved ? "is-saved" : ""} ${className}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from your shelf` : `Save ${title} to your shelf`}
      onClick={onToggle}
    >
      <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true">
        <path d="M2 1h14v19l-7-5-7 5z" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
