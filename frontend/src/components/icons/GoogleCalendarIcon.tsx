import React from "react";

export function GoogleCalendarIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M10 2H38C42.4183 2 46 5.58172 46 10V38C46 42.4183 42.4183 46 38 46H10C5.58172 46 2 42.4183 2 38V10C2 5.58172 5.58172 2 10 2Z" fill="#FFFFFF"/>
      <path d="M46 10V18H2V10C2 5.58172 5.58172 2 10 2H38C42.4183 2 46 5.58172 46 10Z" fill="#EA4335"/>
      <path d="M46 30V38C46 42.4183 42.4183 46 38 46H30V30H46Z" fill="#FBBC04"/>
      <path d="M18 46H10C5.58172 46 2 42.4183 2 38V30H18V46Z" fill="#34A853"/>
      <path d="M2 18V30H18V18H2Z" fill="#4285F4"/>
      <path d="M16 14H32V34H16V14Z" fill="white"/>
      <path d="M30 20H18V22H30V20Z" fill="#1A73E8"/>
      <path d="M26 26H18V28H26V26Z" fill="#1A73E8"/>
      <path d="M30 14V18H34L30 14Z" fill="#1A73E8"/>
    </svg>
  );
}
