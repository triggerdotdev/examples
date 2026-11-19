// The agent's face: the Trigger logo mark as a little character. Animations in globals.css (.buddy-*).
// The mark is the official rounded logo path (120x120 box), scaled into a 200x200 scene.

export type BuddyState = "listening" | "thinking" | "waiting" | "speaking";

const LOGO_PATH =
  "M57.0386 57.5087L60.4546 51.4963L76.523 79.7756H44.386L47.849 73.6805C48.5031 72.5292 48.1111 71.0659 46.9689 70.3958L34.7218 63.2107C33.557 62.5273 32.0583 62.9289 31.3912 64.103L13.6188 95.3824C12.7016 96.9966 13.8676 99 15.7241 99H105.185C107.042 99 108.207 96.9966 107.29 95.3824L62.5599 16.6568C61.6317 15.0232 59.2774 15.0232 58.3492 16.6568L40.5798 47.9301C39.9256 49.0814 40.3176 50.5447 41.4598 51.2148L53.7079 58.401C54.8727 59.0844 56.3715 58.6829 57.0386 57.5087Z";

export function Buddy({ state, size }: { state: BuddyState; size: number }) {
  return (
    <div className={`buddy buddy-${state}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id="buddy-brand" x1="88.605" y1="97" x2="87.7287" y2="40.523" gradientUnits="userSpaceOnUse">
            <stop stopColor="#41FF54" />
            <stop offset="1" stopColor="#E7FF52" />
          </linearGradient>
        </defs>
        <ellipse className="buddy-shadow" cx="100" cy="188" rx="56" ry="7" />
        <g className="buddy-body">
          {/* feet */}
          <ellipse cx="80" cy="172" rx="12" ry="7" fill="#2bbd3a" />
          <ellipse cx="120" cy="172" rx="12" ry="7" fill="#2bbd3a" />
          {/* arms, at the ends of the bottom bar */}
          <g className="buddy-arm-left">
            <ellipse cx="24" cy="150" rx="10" ry="8" fill="#41FF54" />
          </g>
          <g className="buddy-arm-right">
            <ellipse cx="176" cy="150" rx="10" ry="8" fill="#41FF54" />
          </g>
          {/* the logo mark */}
          <g transform="translate(3.2 6) scale(1.6)">
            <path d={LOGO_PATH} fill="url(#buddy-brand)" stroke="#0D0E12" strokeWidth="2.5" strokeLinejoin="round" />
          </g>
          {/* eyes glow out of the hollow centre */}
          <g className="buddy-eyes">
            <ellipse cx="91" cy="117" rx="4.5" ry="6.5" fill="#E7FF52" />
            <ellipse cx="109" cy="117" rx="4.5" ry="6.5" fill="#E7FF52" />
          </g>
          {/* mouth on the bottom bar: a smile, or an open talking mouth */}
          <path className="buddy-smile" d="M91 147 Q100 155 109 147" stroke="#0D0E12" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <ellipse className="buddy-talk" cx="100" cy="150" rx="7" ry="5" fill="#0D0E12" />
        </g>
      </svg>
    </div>
  );
}
