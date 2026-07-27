/**
 * SolutionIcon.jsx — أيقونات SVG موحّدة للسوائل (نفس viewBox ونسبة العرض)،
 * فتبقى النسبة والشكل ثابتين عند تكبير/تصغير الصفحة.
 */
const ICONS = {
  lemon: (
    <g>
      <ellipse cx="22" cy="36" rx="14" ry="18" fill="#F5D547" stroke="#D4B020" strokeWidth="1.2" transform="rotate(-18 22 36)" />
      <ellipse cx="22" cy="36" rx="10" ry="13" fill="none" stroke="#E8C83A" strokeWidth="1" opacity="0.7" transform="rotate(-18 22 36)" />
      <ellipse cx="42" cy="30" rx="14" ry="18" fill="#FFE566" stroke="#D4B020" strokeWidth="1.2" transform="rotate(22 42 30)" />
      <ellipse cx="42" cy="30" rx="10" ry="13" fill="none" stroke="#E8C83A" strokeWidth="1" opacity="0.7" transform="rotate(22 42 30)" />
      <path d="M28 14c2-6 8-8 10-6" fill="none" stroke="#5A9A3A" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="38" cy="10" rx="4" ry="2.2" fill="#6BBF4A" transform="rotate(-30 38 10)" />
    </g>
  ),
  soda: (
    <g>
      <rect x="20" y="14" width="24" height="40" rx="4" fill="#E53935" stroke="#B71C1C" strokeWidth="1.2" />
      <rect x="20" y="14" width="24" height="8" rx="3" fill="#CFD8DC" stroke="#90A4AE" strokeWidth="1" />
      <rect x="20" y="46" width="24" height="8" rx="2" fill="#CFD8DC" stroke="#90A4AE" strokeWidth="1" />
      <ellipse cx="32" cy="34" rx="7" ry="7" fill="#FFEB3B" opacity="0.95" />
      <path d="M28 34h8M32 30v8" stroke="#E53935" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="26" cy="24" r="1.4" fill="#fff" opacity="0.55" />
      <circle cx="38" cy="42" r="1.2" fill="#fff" opacity="0.4" />
    </g>
  ),
  vinegar: (
    <g>
      <path d="M26 10h12l2 8v30a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V18l2-8z" fill="#E8F0F5" stroke="#90A4AE" strokeWidth="1.3" />
      <path d="M24 34h16v14a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6V34z" fill="#F5F0D8" opacity="0.95" />
      <rect x="27" y="6" width="10" height="6" rx="1.5" fill="#A1887F" stroke="#6D4C41" strokeWidth="1" />
      <ellipse cx="32" cy="9" rx="5" ry="2" fill="#8D6E63" />
      <path d="M28 22h8" stroke="#B0BEC5" strokeWidth="1" opacity="0.7" />
    </g>
  ),
  orange: (
    <g>
      <circle cx="32" cy="34" r="18" fill="#FF9800" stroke="#EF6C00" strokeWidth="1.3" />
      <circle cx="32" cy="34" r="14" fill="none" stroke="#FFB74D" strokeWidth="1" opacity="0.8" />
      <circle cx="32" cy="34" r="2" fill="#F57C00" />
      <path d="M32 16c0-6 6-10 10-8" fill="none" stroke="#558B2F" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="40" cy="12" rx="7" ry="3.5" fill="#7CB342" transform="rotate(-25 40 12)" />
      <path d="M36 13c2 1 4 1 6 0" fill="none" stroke="#558B2F" strokeWidth="1" opacity="0.6" />
    </g>
  ),
  coffee: (
    <g>
      <path d="M18 22h28l-3 30a6 6 0 0 1-6 5H27a6 6 0 0 1-6-5l-3-30z" fill="#6D4C41" stroke="#4E342E" strokeWidth="1.2" />
      <path d="M20 28h24l-.8 8H20.8L20 28z" fill="#5D4037" />
      <ellipse cx="32" cy="22" rx="15" ry="4" fill="#A1887F" stroke="#795548" strokeWidth="1" />
      <rect x="22" y="14" width="20" height="8" rx="2" fill="#ECEFF1" stroke="#B0BEC5" strokeWidth="1" />
      <rect x="26" y="10" width="12" height="5" rx="1.5" fill="#CFD8DC" />
      <path d="M46 30c4 0 7 3 7 7s-3 7-7 7" fill="none" stroke="#6D4C41" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  ),
  milk: (
    <g>
      <path d="M22 18h20v34a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V18z" fill="#E3F2FD" stroke="#90CAF9" strokeWidth="1.3" opacity="0.55" />
      <path d="M22 28h20v24a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V28z" fill="#FAFAFA" stroke="#E0E0E0" strokeWidth="1" />
      <ellipse cx="32" cy="28" rx="10" ry="3" fill="#FFF" />
      <path d="M24 14c0-4 16-4 16 0v6H24v-6z" fill="#BBDEFB" stroke="#90CAF9" strokeWidth="1" />
      <rect x="28" y="8" width="8" height="6" rx="1" fill="#90CAF9" />
    </g>
  ),
  water: (
    <g>
      <path
        d="M32 8c-1 8-16 22-16 32a16 16 0 0 0 32 0c0-10-15-24-16-32z"
        fill="#42A5F5"
        stroke="#1E88E5"
        strokeWidth="1.3"
      />
      <path d="M24 36c2 6 8 10 14 8" fill="none" stroke="#90CAF9" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
      <ellipse cx="26" cy="28" rx="3.5" ry="5" fill="#E3F2FD" opacity="0.7" transform="rotate(-20 26 28)" />
    </g>
  ),
  blood: (
    <g>
      <path
        d="M32 8c-1 8-16 22-16 32a16 16 0 0 0 32 0c0-10-15-24-16-32z"
        fill="#E53935"
        stroke="#C62828"
        strokeWidth="1.3"
      />
      <path d="M24 36c2 6 8 10 14 8" fill="none" stroke="#EF9A9A" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <ellipse cx="26" cy="28" rx="3.5" ry="5" fill="#FFCDD2" opacity="0.65" transform="rotate(-20 26 28)" />
    </g>
  ),
  seawater: (
    <g>
      <rect x="14" y="18" width="36" height="34" rx="4" fill="#29B6F6" stroke="#0288D1" strokeWidth="1.3" />
      <rect x="14" y="18" width="36" height="10" rx="3" fill="#4FC3F7" />
      <path d="M18 36c3-3 6-3 9 0s6 3 9 0 6-3 9 0" fill="none" stroke="#E1F5FE" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18 44c3-3 6-3 9 0s6 3 9 0 6-3 9 0" fill="none" stroke="#B3E5FC" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="26" r="1.5" fill="#E1F5FE" opacity="0.8" />
      <circle cx="40" cy="24" r="1.2" fill="#E1F5FE" opacity="0.7" />
    </g>
  ),
  toothpaste: (
    <g>
      <rect x="14" y="28" width="36" height="16" rx="4" fill="#ECEFF1" stroke="#90A4AE" strokeWidth="1.2" />
      <rect x="14" y="28" width="36" height="8" fill="#E53935" opacity="0.9" />
      <rect x="14" y="36" width="36" height="8" fill="#FAFAFA" />
      <path d="M50 32h6v8h-6" fill="#B0BEC5" stroke="#78909C" strokeWidth="1" />
      <rect x="10" y="30" width="6" height="12" rx="1" fill="#CFD8DC" stroke="#90A4AE" strokeWidth="1" />
      <ellipse cx="32" cy="22" rx="8" ry="5" fill="#FFCDD2" opacity="0.9" />
      <ellipse cx="32" cy="20" rx="8" ry="4" fill="#FFF" />
      <path d="M26 20c2-3 10-3 12 0" fill="none" stroke="#EF9A9A" strokeWidth="1.5" />
    </g>
  ),
  soap: (
    <g>
      <rect x="22" y="26" width="20" height="28" rx="4" fill="#F8BBD0" stroke="#EC407A" strokeWidth="1.2" />
      <rect x="24" y="30" width="16" height="10" rx="2" fill="#FCE4EC" />
      <rect x="28" y="14" width="8" height="14" rx="2" fill="#F48FB1" stroke="#EC407A" strokeWidth="1" />
      <rect x="26" y="10" width="12" height="6" rx="2" fill="#FCE4EC" stroke="#F06292" strokeWidth="1" />
      <circle cx="42" cy="20" r="3" fill="#F8BBD0" opacity="0.7" />
      <circle cx="46" cy="16" r="2" fill="#F8BBD0" opacity="0.5" />
      <circle cx="40" cy="14" r="1.5" fill="#FCE4EC" opacity="0.8" />
    </g>
  ),
  bleach: (
    <g>
      <path d="M24 20h16l2 8v26a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6V28l2-8z" fill="#FAFAFA" stroke="#BDBDBD" strokeWidth="1.3" />
      <rect x="26" y="12" width="12" height="10" rx="2" fill="#E0E0E0" stroke="#9E9E9E" strokeWidth="1" />
      <rect x="28" y="8" width="8" height="5" rx="1" fill="#BDBDBD" />
      <rect x="26" y="32" width="12" height="16" rx="2" fill="#66BB6A" stroke="#43A047" strokeWidth="1" />
      <path d="M29 38h6M29 42h6" stroke="#E8F5E9" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  ),
};

export default function SolutionIcon({ id, className = "" }) {
  const body = ICONS[id];
  if (!body) return null;
  return (
    <svg
      className={`ph-pick-icon ${className}`.trim()}
      viewBox="0 0 64 64"
      width="64"
      height="64"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      {body}
    </svg>
  );
}
