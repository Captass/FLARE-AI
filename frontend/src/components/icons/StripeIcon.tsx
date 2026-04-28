import React from "react";

export function StripeIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M44 24C44 35.0457 35.0457 44 24 44C12.9543 44 4 35.0457 4 24C4 12.9543 12.9543 4 24 4C35.0457 4 44 12.9543 44 24Z" fill="#635BFF"/>
      <path d="M32 18.5C32 15.5 29.5 14 26.5 14H22C20.5 14 19 15.5 19 17C19 18.5 20.5 20 22 20H26.5C27.5 20 28 20.5 28 21.5C28 22.5 27.5 23 26.5 23H21.5C18.5 23 16 21.5 16 18.5" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <path d="M16 29.5C16 32.5 18.5 34 21.5 34H26C27.5 34 29 32.5 29 31C29 29.5 27.5 28 26 28H21.5C20.5 28 20 27.5 20 26.5C20 25.5 20.5 25 21.5 25H26.5C29.5 25 32 26.5 32 29.5" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}
