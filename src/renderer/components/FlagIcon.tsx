import { getCountryCode } from '../../shared/utils/date-utils';

interface FlagIconProps {
  country: string;
  size?: 'sm' | 'md';
}

/**
 * Renders a country flag image using flagcdn.com
 * Falls back to a racing flag emoji if country not found
 */
export function FlagIcon({ country, size = 'sm' }: FlagIconProps) {
  const code = getCountryCode(country);

  if (!code) {
    return <span>🏁</span>;
  }

  // flagcdn.com provides flag images in various sizes
  const dimensions = size === 'sm' ? { w: 20, h: 15 } : { w: 32, h: 24 };

  return (
    <img
      src={`https://flagcdn.com/${dimensions.w}x${dimensions.h}/${code}.png`}
      srcSet={`https://flagcdn.com/${dimensions.w * 2}x${dimensions.h * 2}/${code}.png 2x`}
      width={dimensions.w}
      height={dimensions.h}
      alt={country}
      className="inline-block"
      style={{ verticalAlign: 'middle' }}
    />
  );
}
