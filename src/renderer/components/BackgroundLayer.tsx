import { useTeamBackground } from '../hooks';

interface BackgroundLayerProps {
  /** Team ID for team-specific backgrounds, 'all' for any image */
  teamId: string;
  /** Optional custom tint color (defaults to neutral) */
  tintColor?: string;
}

/**
 * Full-screen background layer with blur and tint overlay.
 * Use this behind content on screens that need a background image.
 */
export function BackgroundLayer({ teamId, tintColor }: BackgroundLayerProps) {
  const backgroundImage = useTeamBackground(teamId);

  if (!backgroundImage) return null;

  // Default to neutral tint if no color provided
  const tint = tintColor ?? 'var(--neutral-900)';

  return (
    <>
      {/* Background image layer */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />

      {/* Blur + tint overlay (darker for readability) */}
      <div
        className="fixed inset-0 backdrop-blur-xl"
        style={{
          background: `linear-gradient(180deg,
            color-mix(in srgb, ${tint} 85%, transparent) 0%,
            color-mix(in srgb, var(--neutral-950) 95%, transparent) 100%)`,
        }}
      />
    </>
  );
}
