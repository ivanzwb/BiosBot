/**
 * BiosBot Logo Icon - Terminal/Command Line Style
 */
export default function LogoIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      fill="none"
    >
      {/* Background rounded rectangle */}
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#1a1a2e" stroke="#00bcd4" strokeWidth="1"/>

      {/* Terminal window header dots */}
      <circle cx="6" cy="5" r="1.2" fill="#ff5f56"/>
      <circle cx="10" cy="5" r="1.2" fill="#ffbd2e"/>
      <circle cx="14" cy="5" r="1.2" fill="#27ca40"/>

      {/* Command prompt symbol > */}
      <path d="M6 12 L11 16 L6 20" stroke="#00bcd4" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

      {/* Cursor block */}
      <rect x="13" y="14" width="8" height="3" rx="0.5" fill="#00bcd4"/>

      {/* Second line hint */}
      <rect x="6" y="24" width="12" height="2" rx="1" fill="rgba(0,188,212,0.4)"/>
    </svg>
  );
}
