/**
 * icons.jsx — أيقونات خطّية صغيرة (SVG) لواجهة الطفو. بلا إيموجي.
 */
const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const IconHome = (p) => (
  <svg {...base} {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
    <path d="M10 19.5v-5h4v5" />
  </svg>
);
export const IconHelp = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.1-2.5 3.7" />
    <path d="M12 17.2v.1" />
  </svg>
);
export const IconSound = ({ muted, ...p }) => (
  <svg {...base} {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {muted ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />}
  </svg>
);
export const IconReset = (p) => (
  <svg {...base} {...p}>
    <path d="M4 12a8 8 0 1 0 2.6-5.9" />
    <path d="M4 4.5v4.6h4.6" />
  </svg>
);
export const IconRuler = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="8" width="18" height="8" rx="1.5" transform="rotate(-45 12 12)" />
    <path d="m8.5 12.5 1.2 1.2m1.6-3.2 1.2 1.2m1.6-3.2 1.2 1.2" />
  </svg>
);
export const IconForces = (p) => (
  <svg {...base} {...p}>
    <path d="M8 20V6m0 0L4.5 9.5M8 6l3.5 3.5" />
    <path d="M16 4v14m0 0-3.5-3.5M16 18l3.5-3.5" />
  </svg>
);
export const IconValues = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h10M4 17h6" />
    <path d="m17 14 3 3-3 3" />
  </svg>
);
export const IconDrop = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3.5c3.2 4 6 6.6 6 10.2a6 6 0 0 1-12 0c0-3.6 2.8-6.2 6-10.2z" />
    <path d="M9.2 14.4a3 3 0 0 0 2.4 2.2" />
  </svg>
);
export const IconCheck = (p) => (
  <svg {...base} {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconNext = (p) => (
  <svg {...base} {...p}>
    <path d="M5 12h14m0 0-5-5m5 5-5 5" />
  </svg>
);

export const IconInfo = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <path d="M12 7.7v.1" />
  </svg>
);
export const IconClose = (p) => (
  <svg {...base} {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
export const IconPlay = (p) => (
  <svg {...base} {...p}>
    <path d="M8 5.5v13l10-6.5z" />
  </svg>
);
export const IconPause = (p) => (
  <svg {...base} {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" />
  </svg>
);
export const IconZoomReset = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5M8.5 11h5" />
  </svg>
);
export const IconDive = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5M11 8.2v5.6M8.2 11h5.6" />
  </svg>
);
export const IconBack = (p) => (
  <svg {...base} {...p}>
    <path d="M9 7 4 12l5 5M4.5 12H15a5 5 0 0 1 0 10h-2" />
  </svg>
);
