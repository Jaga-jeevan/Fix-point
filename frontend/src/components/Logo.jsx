import React from "react";

export default function Logo({ size = "md", className = "" }) {
  const sizeClasses = {
    sm: "h-8 w-8 rounded-lg text-xs",
    md: "h-9 w-9 rounded-xl text-sm",
    lg: "h-12 w-12 rounded-2xl text-base",
    xl: "h-14 w-14 rounded-2xl text-lg",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-7 w-7",
    xl: "h-8 w-8",
  };

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-[#6D28D9] via-[#6366F1] to-[#4F46E5] text-white shadow-md shadow-purple-500/20 font-bold transition-transform hover:scale-105 ${
        sizeClasses[size] || sizeClasses.md
      } ${className}`}
    >
      <svg className={`${iconSizes[size] || iconSizes.md} fill-current`} viewBox="0 0 24 24">
        <path d="M13 2L3 14h7v8l10-12h-7z" />
      </svg>
    </div>
  );
}
