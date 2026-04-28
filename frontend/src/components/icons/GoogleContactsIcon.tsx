import React from "react";

export function GoogleContactsIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="24" cy="24" r="22" fill="#4285F4"/>
      <circle cx="24" cy="18" r="7" fill="white"/>
      <path d="M38 38C38 30.268 31.732 24 24 24C16.268 24 10 30.268 10 38" stroke="white" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );
}
