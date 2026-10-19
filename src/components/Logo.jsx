import React from 'react';

export default function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7A5230" />
          <stop offset="0.55" stopColor="#4E311B" />
          <stop offset="1" stopColor="#2B1810" />
        </linearGradient>
        <linearGradient id="logoL" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8B27E" />
          <stop offset="1" stopColor="#C98A54" />
        </linearGradient>
        <linearGradient id="logoR" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B97C44" />
          <stop offset="1" stopColor="#8F5728" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="12" fill="url(#logoBg)" />
      <path
        d="M24 9.5c-5.3 0-9.7 5.6-9.7 12.5S18.7 34.5 24 34.5 33.7 28.9 33.7 22 29.3 9.5 24 9.5z"
        fill="url(#logoL)"
      />
      <path
        d="M24 9.5c5.3 0 9.7 5.6 9.7 12.5S29.3 34.5 24 34.5 14.3 28.9 14.3 22 18.7 9.5 24 9.5z"
        fill="url(#logoR)"
      />
      <ellipse cx="20" cy="18.5" rx="2.4" ry="4" fill="#fff" opacity="0.22" transform="rotate(-18 20 18.5)" />
    </svg>
  );
}
