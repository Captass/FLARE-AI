import React from "react";

export function FirebaseIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M7 38L24 4L41 38H7Z" fill="#FFCA28"/>
      <path d="M7 38L18 34L24 4L7 38Z" fill="#F57C00"/>
      <path d="M24 4L30 34L41 38L24 4Z" fill="#FFA000"/>
      <path d="M7 38L24 44L41 38H7Z" fill="#FF8F00"/>
    </svg>
  );
}
