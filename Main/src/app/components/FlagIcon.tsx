interface FlagIconProps {
  countryCode: string;
  className?: string;
}

function getFlagGlyph(countryCode: string): string | null {
  const code = countryCode.trim().toUpperCase();
  if (code === "EU") return String.fromCodePoint(0x1f1ea, 0x1f1fa);
  if (!/^[A-Z]{2}$/.test(code)) return null;

  return String.fromCodePoint(...[...code].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

export function FlagIcon({ countryCode, className = "h-4 w-6" }: FlagIconProps) {
  const code = countryCode.trim().toUpperCase();
  const flag = getFlagGlyph(code);

  return (
    <div className={`${className} overflow-hidden rounded-sm relative flex items-center justify-center bg-gray-50`}>
      {flag ? (
        <span aria-hidden="true" className="text-[1.35em] leading-none">
          {flag}
        </span>
      ) : (
        <span className="text-[10px] font-bold text-gray-400">{code || "--"}</span>
      )}
    </div>
  );
}
