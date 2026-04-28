import * as React from "react";

export function GmailIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M2.25 7.112v9.776a2.25 2.25 0 0 0 2.25 2.25h2.25v-12L2.25 4.5v2.612Z" fill="#4285F4" />
      <path d="M17.25 19.138h2.25a2.25 2.25 0 0 0 2.25-2.25V7.112L17.25 4.5v14.638Z" fill="#34A853" />
      <path d="M17.25 4.5 12 8.438 6.75 4.5V2.25h1.125a2.25 2.25 0 0 1 1.35.45L12 5.062l2.775-2.362a2.25 2.25 0 0 1 1.35-.45h1.125V4.5Z" fill="#EA4335" />
      <path d="M2.25 4.5 6.75 8.438V4.5L2.25 1.125V4.5Z" fill="#C5221F" />
      <path d="M21.75 4.5 17.25 8.438V4.5L21.75 1.125V4.5Z" fill="#FBC02D" />
    </svg>
  );
}
