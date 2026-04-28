import React from "react";

export function ColorfulHomeIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M24 4L4 20V42H16V30H32V42H44V20L24 4Z" fill="#EA4335"/>
      <path d="M16 42V30H32V42H16Z" fill="#FBBC04"/>
      <path d="M4 20L24 4L44 20H4Z" fill="#34A853"/>
    </svg>
  );
}

export function ColorfulDashboardIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="4" y="4" width="18" height="18" rx="4" fill="#4285F4"/>
      <rect x="26" y="4" width="18" height="18" rx="4" fill="#EA4335"/>
      <rect x="4" y="26" width="18" height="18" rx="4" fill="#34A853"/>
      <rect x="26" y="26" width="18" height="18" rx="4" fill="#FBBC04"/>
    </svg>
  );
}

export function ColorfulSparklesIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M24 4L28 16L40 20L28 24L24 36L20 24L8 20L20 16L24 4Z" fill="#FF7A00" />
      <path d="M38 30L40 36L46 38L40 40L38 46L36 40L30 38L36 36L38 30Z" fill="#FFB266" />
      <path d="M10 6L11 9L14 10L11 11L10 14L9 11L6 10L9 9L10 6Z" fill="#2563EB" />
    </svg>
  );
}
