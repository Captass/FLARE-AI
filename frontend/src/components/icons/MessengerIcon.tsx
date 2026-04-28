import React from "react";

export function MessengerIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M24 2C11.85 2 2 11.02 2 22.14C2 28.48 4.95 34.1 9.56 37.88V46L17.38 41.71C19.46 42.29 21.68 42.61 24 42.61C36.15 42.61 46 33.59 46 22.47C46 11.35 36.15 2.27 24 2V2Z" fill="url(#messenger_grad)"/>
      <path d="M10 28L18 16L33 28L25 40L10 28Z" fill="white"/>
      <defs>
        <linearGradient id="messenger_grad" x1="2" y1="2" x2="46" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00B2FF"/>
          <stop offset="1" stopColor="#006AFF"/>
        </linearGradient>
      </defs>
    </svg>
  );
}
