import type { SVGProps } from "react";

/** Minimal inline icon set (stroke-based, inherits currentColor). */
type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

export const DumbbellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.5 6.5 17.5 17.5" />
    <path d="M4 8l-1 1a2 2 0 0 0 0 3l1 1" transform="rotate(45 4 10)" />
    <path d="M3.5 7.5 7.5 3.5M16.5 20.5l4-4M2 12l2-2M20 14l2-2" />
    <rect x="2.2" y="8.2" width="3.5" height="7.6" rx="1" transform="rotate(-45 4 12)" />
    <rect x="18.3" y="8.2" width="3.5" height="7.6" rx="1" transform="rotate(-45 20 12)" />
  </svg>
);

export const AppleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 8c-1-2.5-3.5-3-5-2.5C5 6.5 4 9 5 13c.8 3.2 2.5 6 4 6 1 0 1.4-.6 3-.6s2 .6 3 .6c1.5 0 3.2-2.8 4-6 .5-2 .3-4-.6-5.4" />
    <path d="M12 8c1-2.5 3-3.2 4.5-2.8" />
    <path d="M12 8c0-1.6.8-3.2 2.4-4" />
  </svg>
);

export const HeartPulseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20.8 6.6a5 5 0 0 0-8.8-2 5 5 0 0 0-8.8 2c-1 3 1 5.6 3.4 8L12 20l5.4-5.4c2.4-2.4 4.4-5 3.4-8Z" />
    <path d="M3.5 12.5H8l1.5-3 2.5 5 1.5-3H20" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

export const FlameIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3c1 3-1.5 4.5-1.5 7A2.5 2.5 0 0 0 13 12.5c.4-1.2 0-2 .5-2.5 1.5 1.5 3 3.2 3 6a5.5 5.5 0 0 1-11 0c0-3.3 2.5-4.7 3.5-7C9.6 7 10 4.5 12 3Z" />
  </svg>
);

export const TrophyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const BackIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const XIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const EditIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const ListIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 3v18h18" />
    <path d="M7 14l3-3 3 3 5-6" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const CameraIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export const DropletIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
  </svg>
);

export const PillIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7Z" />
    <path d="M8.5 8.5 15 15" />
  </svg>
);

export const GoogleIcon = (p: IconProps) => (
  <svg width={20} height={20} viewBox="0 0 24 24" {...p}>
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.2-.1-2.3-.4-3.5Z"
    />
    <path
      fill="#FF3D00"
      d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 16 3 9.1 7.6 6.3 14.7Z"
    />
    <path
      fill="#4CAF50"
      d="M24 45c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 36 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9 40.3 15.9 45 24 45Z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.8 35.6 45 30.3 45 24c0-1.2-.1-2.3-.4-3.5Z"
    />
  </svg>
);
