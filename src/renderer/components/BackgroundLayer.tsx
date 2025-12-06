import { useTeamBackground } from '../hooks';

interface BackgroundLayerProps {
  /** Team ID for team-specific backgrounds, 'all' for any image */
  teamId: string;
  /** Optional custom tint color (defaults to neutral) */
  tintColor?: string;
  /** CSS position: 'fixed' for full-screen, 'absolute' for container-relative */
  position?: 'fixed' | 'absolute';
  /** Top tint opacity (0-100), defaults to 85 */
  tintOpacity?: number;
  /** Bottom base opacity (0-100), defaults to 95 */
  baseOpacity?: number;
}

/**
 * Background layer with blur and tint overlay.
 * Use 'fixed' for full-screen backgrounds, 'absolute' for container backgrounds.
 */
export function BackgroundLayer({
  teamId,
  tintColor,
  position = 'fixed',
  tintOpacity = 85,
  baseOpacity = 95,
}: BackgroundLayerProps) {
  const backgroundImage = useTeamBackground(teamId);

  if (!backgroundImage) return null;

  // Default to neutral tint if no color provided
  const tint = tintColor ?? 'var(--neutral-900)';
  const positionClass = position === 'fixed' ? 'fixed inset-0' : 'absolute inset-0';

  return (
    <>
      {/* Background image layer */}
      <div
        className={`${positionClass} bg-cover bg-center`}
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />

      {/* Blur + tint overlay */}
      <div
        className={`${positionClass} backdrop-blur-xl`}
        style={{
          background: `linear-gradient(180deg,
            color-mix(in srgb, ${tint} ${tintOpacity}%, transparent) 0%,
            color-mix(in srgb, var(--neutral-950) ${baseOpacity}%, transparent) 100%)`,
        }}
      />
    </>
  );
}
