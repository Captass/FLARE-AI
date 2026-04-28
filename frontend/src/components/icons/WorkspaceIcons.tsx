import React from "react";

export function ColorfulCrownIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M4 40V12L14 22L24 8L34 22L44 12V40H4Z" fill="#FBBC04"/>
      <path d="M4 40H44V44H4V40Z" fill="#F57C00"/>
    </svg>
  );
}

export function ColorfulBriefcaseIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="4" y="14" width="40" height="26" rx="4" fill="#34A853"/>
      <path d="M16 14V10C16 7.8 17.8 6 20 6H28C30.2 6 32 7.8 32 10V14" stroke="#1A73E8" strokeWidth="4"/>
      <rect x="20" y="24" width="8" height="6" rx="1" fill="white"/>
    </svg>
  );
}

export function ColorfulBuildingIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="6" y="6" width="36" height="36" rx="4" fill="#4285F4"/>
      <rect x="12" y="12" width="6" height="6" fill="white" opacity="0.6"/>
      <rect x="21" y="12" width="6" height="6" fill="white" opacity="0.6"/>
      <rect x="30" y="12" width="6" height="6" fill="white" opacity="0.6"/>
      <rect x="12" y="21" width="6" height="6" fill="white" opacity="0.6"/>
      <rect x="21" y="21" width="6" height="6" fill="white" opacity="0.6"/>
      <rect x="30" y="21" width="6" height="6" fill="white" opacity="0.6"/>
      <rect x="21" y="30" width="6" height="12" fill="white"/>
    </svg>
  );
}
