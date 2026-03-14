import Flag from 'react-world-flags';

interface FlagIconProps {
  countryCode: string;
  className?: string;
}

export function FlagIcon({ countryCode, className = "h-4 w-6" }: FlagIconProps) {
  // Map EU to a code the library understands (often uses 'EU' or 'EU')
  // react-world-flags usually supports standard ISO codes.
  const code = countryCode.toUpperCase();

  return (
    <Flag 
      code={code} 
      className={`${className} object-cover`} 
      fallback={<span className="text-[10px] font-bold text-gray-400">{code}</span>}
    />
  );
}
