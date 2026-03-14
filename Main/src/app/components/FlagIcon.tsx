import Flag from 'react-world-flags';

interface FlagIconProps {
  countryCode: string;
  className?: string;
}

export function FlagIcon({ countryCode, className = "h-4 w-6" }: FlagIconProps) {
  const code = countryCode.toUpperCase();

  return (
    <div className={`${className} overflow-hidden rounded-sm relative flex items-center justify-center bg-gray-50`}>
      <Flag 
        code={code} 
        className="w-full h-full object-cover scale-110" 
        fallback={<span className="text-[10px] font-bold text-gray-400">{code}</span>}
      />
    </div>
  );
}
