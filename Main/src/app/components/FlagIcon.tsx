interface FlagIconProps {
  countryCode: string;
  className?: string;
}

export function FlagIcon({ countryCode, className = "h-4 w-6" }: FlagIconProps) {
  const code = countryCode.toUpperCase();

  // Forged SVGs for the Major 8 Currencies
  switch (code) {
    case "US":
      return (
        <svg viewBox="0 0 741 390" className={className}>
          <rect width="741" height="390" fill="#3c3b6e" />
          <path d="M0 30h741M0 90h741M0 150h741M0 210h741M0 270h741M0 330h741" stroke="#fff" strokeWidth="30" />
          <path d="M0 0h741M0 60h741M0 120h741M0 180h741M0 240h741M0 300h741M0 360h741" stroke="#b22234" strokeWidth="30" />
          <rect width="296.4" height="210" fill="#3c3b6e" />
          <path d="M0 0h296.4v210H0z" fill="#3c3b6e" />
          {/* Simplified stars representation */}
          <circle cx="30" cy="30" r="5" fill="#fff" />
          <circle cx="70" cy="30" r="5" fill="#fff" />
          <circle cx="110" cy="30" r="5" fill="#fff" />
          <circle cx="150" cy="30" r="5" fill="#fff" />
          <circle cx="30" cy="70" r="5" fill="#fff" />
          <circle cx="70" cy="70" r="5" fill="#fff" />
          <circle cx="110" cy="70" r="5" fill="#fff" />
          <circle cx="150" cy="70" r="5" fill="#fff" />
        </svg>
      );
    case "EU":
      return (
        <svg viewBox="0 0 810 540" className={className}>
          <rect width="810" height="540" fill="#039" />
          <g fill="#fc0" transform="translate(405,270)">
            {[...Array(12)].map((_, i) => (
              <path
                key={i}
                d="M0-165l13 41h43l-35 25 13 41-34-26-34 26 13-41-35-25h43z"
                transform={`rotate(${i * 30})`}
              />
            ))}
          </g>
        </svg>
      );
    case "GB":
      return (
        <svg viewBox="0 0 60 30" className={className}>
          <clipPath id="s">
            <path d="M0,0 v30 h60 v-30 z" />
          </clipPath>
          <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#s)" stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </svg>
      );
    case "JP":
      return (
        <svg viewBox="0 0 900 600" className={className}>
          <rect width="900" height="600" fill="#fff" />
          <circle cx="450" cy="300" r="180" fill="#bc002d" />
        </svg>
      );
    case "AU":
      return (
        <svg viewBox="0 0 1200 600" className={className}>
          <rect width="1200" height="600" fill="#012169" />
          {/* Union Jack simplified */}
          <path d="M0,0 L600,300 M600,0 L0,300" stroke="#fff" strokeWidth="60" />
          <path d="M300,0 v300 M0,150 h600" stroke="#fff" strokeWidth="100" />
          <path d="M300,0 v300 M0,150 h600" stroke="#C8102E" strokeWidth="60" />
          <circle cx="300" cy="450" r="60" fill="#fff" />
          <circle cx="900" cy="150" r="40" fill="#fff" />
          <circle cx="1050" cy="250" r="40" fill="#fff" />
          <circle cx="900" cy="450" r="40" fill="#fff" />
          <circle cx="750" cy="250" r="40" fill="#fff" />
        </svg>
      );
    case "CA":
      return (
        <svg viewBox="0 0 20 10" className={className}>
          <rect width="20" height="10" fill="#f00" />
          <rect x="5" width="10" height="10" fill="#fff" />
          <path d="M10,2 l.6,2.4 h2.4 l-2,1.5 .8,2.4 -1.8-1.5 -1.8,1.5 .8-2.4 -2-1.5 h2.4 z" fill="#f00" />
        </svg>
      );
    case "NZ":
      return (
        <svg viewBox="0 0 1200 600" className={className}>
          <rect width="1200" height="600" fill="#012169" />
          <path d="M900,120 l10,30 h30 l-25,20 10,30 -25-20 -25,20 10-30 -25-20 h30 z" fill="#fff" stroke="#f00" strokeWidth="2" />
          <path d="M1050,240 l10,30 h30 l-25,20 10,30 -25-20 -25,20 10-30 -25-20 h30 z" fill="#fff" stroke="#f00" strokeWidth="2" />
          <path d="M900,450 l10,30 h30 l-25,20 10,30 -25-20 -25,20 10-30 -25-20 h30 z" fill="#fff" stroke="#f00" strokeWidth="2" />
          <path d="M750,240 l10,30 h30 l-25,20 10,30 -25-20 -25,20 10-30 -25-20 h30 z" fill="#fff" stroke="#f00" strokeWidth="2" />
        </svg>
      );
    case "CH":
      return (
        <svg viewBox="0 0 1 1" className={className}>
          <rect width="1" height="1" fill="#f00" />
          <path d="M.2 .45 h.6 v.1 h-.6 z M.45 .2 v.6 h.1 v-.6 z" fill="#fff" />
        </svg>
      );
    default:
      return <span className={className}>{countryCode}</span>;
  }
}
