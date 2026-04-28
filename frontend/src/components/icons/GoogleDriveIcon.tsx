import React from "react";

export function GoogleDriveIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M16.5 8L5 28L10.5 38L22 18L16.5 8Z" fill="#34A853"/>
      <path d="M31.5 8L16.5 8L22 18L37 18L31.5 8Z" fill="#4285F4"/>
      <path d="M22 18L10.5 38L37.5 38L43 28L22 18Z" fill="#FBBC04"/>
    </svg>
  );
}
