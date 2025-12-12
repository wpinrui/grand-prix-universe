import type { Team } from '../../shared/domain';

const FALLBACK_PRIMARY_COLOR = '#52525e';
const FALLBACK_SECONDARY_COLOR = '#3f3f48';

interface TeamBadgeProps {
  team: Team | null;
  className?: string;
}

/**
 * Displays team logo or color swatch fallback.
 * Shows gray placeholder when no team is provided.
 */
export function TeamBadge({ team, className = 'w-12 h-12' }: TeamBadgeProps) {
  const primaryColor = team?.primaryColor ?? FALLBACK_PRIMARY_COLOR;
  const secondaryColor = team?.secondaryColor ?? FALLBACK_SECONDARY_COLOR;
  const badgeGlow = `0 4px 12px ${primaryColor}33, 0 0 20px ${primaryColor}22`;

  if (team?.logoUrl) {
    return (
      <div
        className={`${className} aspect-square rounded-full overflow-hidden shadow-md flex items-center justify-center p-1.5`}
        style={{ boxShadow: badgeGlow, backgroundColor: primaryColor }}
      >
        <img
          src={team.logoUrl}
          alt={team.name}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  // Color swatch fallback with diagonal split
  return (
    <div
      className={`${className} rounded-lg overflow-hidden shadow-md relative`}
      style={{ boxShadow: badgeGlow }}
    >
      {/* Primary color (full background) */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: primaryColor }}
      />
      {/* Secondary color (diagonal) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: secondaryColor,
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
        }}
      />
    </div>
  );
}
