import type { Team } from '../../shared/domain';

const FALLBACK_PRIMARY_COLOR = '#666';
const FALLBACK_SECONDARY_COLOR = '#444';

interface TeamBadgeProps {
  team: Team | null;
  className?: string;
}

/**
 * Displays team logo or color swatch fallback.
 * Shows gray placeholder when no team is provided.
 */
export function TeamBadge({ team, className = 'w-14 h-12' }: TeamBadgeProps) {
  if (team?.logoUrl) {
    return (
      <img
        src={team.logoUrl}
        alt={team.name}
        className={`${className} object-contain rounded`}
      />
    );
  }

  return (
    <div className={`flex rounded overflow-hidden ${className}`}>
      <div
        className="w-1/2 h-full"
        style={{ backgroundColor: team?.primaryColor ?? FALLBACK_PRIMARY_COLOR }}
      />
      <div
        className="w-1/2 h-full"
        style={{ backgroundColor: team?.secondaryColor ?? FALLBACK_SECONDARY_COLOR }}
      />
    </div>
  );
}
