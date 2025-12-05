import type { Team } from '../../shared/domain';

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
        style={{ backgroundColor: team?.primaryColor ?? '#666' }}
      />
      <div
        className="w-1/2 h-full"
        style={{ backgroundColor: team?.secondaryColor ?? '#444' }}
      />
    </div>
  );
}
