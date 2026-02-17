import React from "react";

interface IconProps {
  className?: string;
  size?: number;
}

export const AnimatedCalendar: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-transform duration-300 hover:scale-110 hover:animate-bounce-subtle ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect x="7" y="14" width="3" height="3" fill="currentColor" rx="0.5" />
    <rect x="14" y="14" width="3" height="3" fill="currentColor" rx="0.5" />
  </svg>
);

export const AnimatedFire: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <span
    className={`inline-block transition-transform duration-200 hover:scale-125 ${className}`}
    style={{ 
      fontSize: size, 
      lineHeight: 1,
      animation: "fireWiggle 1.5s ease-in-out infinite",
      display: "inline-block",
      verticalAlign: "middle"
    }}
  >
    <style>
      {`
        @keyframes fireWiggle {
          0%, 100% { transform: rotate(-2deg) scale(1); }
          25% { transform: rotate(2deg) scale(1.02); }
          50% { transform: rotate(-1deg) scale(1); }
          75% { transform: rotate(1deg) scale(1.01); }
        }
      `}
    </style>
    🔥
  </span>
);

export const AnimatedTrophy: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 hover:scale-110 hover:animate-bounce-subtle ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <path
      d="M6 4H18V10C18 13.3137 15.3137 16 12 16C8.68629 16 6 13.3137 6 10V4Z"
      fill="url(#trophyGradient)"
      stroke="#D4A012"
      strokeWidth="1.5"
    />
    <path d="M6 6H4C3 6 2 7 2 8C2 10 3.5 11 5 11H6" stroke="#D4A012" strokeWidth="1.5" fill="none" />
    <path d="M18 6H20C21 6 22 7 22 8C22 10 20.5 11 19 11H18" stroke="#D4A012" strokeWidth="1.5" fill="none" />
    <rect x="10" y="16" width="4" height="3" fill="#D4A012" />
    <rect x="7" y="19" width="10" height="2" rx="1" fill="#D4A012" />
    <defs>
      <linearGradient id="trophyGradient" x1="12" y1="4" x2="12" y2="16" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFD700" />
        <stop offset="1" stopColor="#FFA500" />
      </linearGradient>
    </defs>
  </svg>
);

export const AnimatedHeart: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 hover:scale-110 ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <style>
      {`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.15); }
          30% { transform: scale(1); }
          45% { transform: scale(1.1); }
          60% { transform: scale(1); }
        }
        .heart-animate:hover .heart-path {
          animation: heartbeat 0.8s ease-in-out infinite;
          transform-origin: center;
        }
      `}
    </style>
    <g className="heart-animate">
      <path
        className="heart-path"
        d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
        fill="#EF4444"
      />
    </g>
  </svg>
);

export const AnimatedBlackHeart: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 hover:scale-105 hover:opacity-70 ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <path
      d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.04L12 21.35Z"
      fill="#4B5563"
    />
  </svg>
);

export const AnimatedUsers: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 hover:scale-110 ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <style>
      {`
        @keyframes sway {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(1px); }
        }
        .users-animate:hover .users-group {
          animation: sway 0.5s ease-in-out infinite;
        }
      `}
    </style>
    <g className="users-animate">
      <g className="users-group">
        <circle cx="9" cy="7" r="3" fill="currentColor" />
        <path d="M3 19V18C3 15.2386 5.23858 13 8 13H10C12.7614 13 15 15.2386 15 18V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="16" cy="8" r="2.5" fill="currentColor" opacity="0.7" />
        <path d="M17 13C19.2091 13 21 14.7909 21 17V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      </g>
    </g>
  </svg>
);

export const AnimatedChevronDown: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 hover:translate-y-0.5 ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <style>
      {`
        @keyframes bounce-down {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(2px); }
        }
        .chevron-animate:hover .chevron-path {
          animation: bounce-down 0.5s ease-in-out infinite;
        }
      `}
    </style>
    <g className="chevron-animate">
      <path
        className="chevron-path"
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

export const AnimatedUpDown: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <style>
      {`
        @keyframes oscillate {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .updown-animate:hover .updown-arrows {
          animation: oscillate 0.4s ease-in-out infinite;
        }
      `}
    </style>
    <g className="updown-animate">
      <g className="updown-arrows">
        <path d="M12 4L8 8H16L12 4Z" fill="currentColor" />
        <path d="M12 20L8 16H16L12 20Z" fill="currentColor" />
        <rect x="11" y="8" width="2" height="8" fill="currentColor" />
      </g>
    </g>
  </svg>
);

export const AnimatedSkull: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 hover:scale-110 hover:opacity-80 ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <ellipse cx="12" cy="10" rx="8" ry="9" fill="#6B7280" />
    <circle cx="8" cy="9" r="2.5" fill="#1F2937" />
    <circle cx="16" cy="9" r="2.5" fill="#1F2937" />
    <ellipse cx="12" cy="14" rx="1.5" ry="2" fill="#1F2937" />
    <path d="M8 19V22M12 19V22M16 19V22" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const AnimatedTombstone: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 hover:scale-105 ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <style>
      {`
        @keyframes wobble {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
        }
        .tombstone-animate:hover .tombstone-body {
          animation: wobble 0.4s ease-in-out infinite;
          transform-origin: bottom center;
        }
      `}
    </style>
    <g className="tombstone-animate">
      <g className="tombstone-body">
        <path d="M6 22V10C6 6.68629 8.68629 4 12 4C15.3137 4 18 6.68629 18 10V22H6Z" fill="#6B7280" />
        <rect x="4" y="20" width="16" height="2" fill="#4B5563" />
        <text x="12" y="15" textAnchor="middle" fill="#D1D5DB" fontSize="6" fontWeight="bold">RIP</text>
      </g>
    </g>
  </svg>
);

export const AnimatedCelebration: React.FC<IconProps> = ({ className = "", size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-300 hover:scale-110 ${className}`}
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <style>
      {`
        @keyframes confetti-shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .celebration-animate:hover .party-popper {
          animation: confetti-shake 0.3s ease-in-out infinite;
          transform-origin: bottom left;
        }
        .celebration-animate:hover .confetti {
          animation: sparkle 0.4s ease-in-out infinite;
        }
      `}
    </style>
    <g className="celebration-animate">
      <g className="party-popper">
        <path d="M4 20L8 12L12 16L4 20Z" fill="#F59E0B" />
        <path d="M6 18L7 15" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="confetti">
        <circle cx="14" cy="6" r="1.5" fill="#EF4444" />
        <circle cx="18" cy="10" r="1.5" fill="#3B82F6" />
        <circle cx="10" cy="8" r="1" fill="#22C55E" />
        <rect x="16" y="4" width="2" height="2" fill="#A855F7" transform="rotate(15 17 5)" />
        <rect x="19" y="7" width="2" height="2" fill="#EC4899" transform="rotate(-10 20 8)" />
        <path d="M12 10L13 8" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M15 12L17 11" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </g>
  </svg>
);
