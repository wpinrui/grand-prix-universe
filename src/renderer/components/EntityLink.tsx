import type { ReactNode, CSSProperties } from 'react';
import { useEntityNavigation, type EntityType } from '../utils/entity-navigation';
import { ACCENT_TEXT_STYLE } from '../utils/theme-styles';

interface EntityLinkProps {
  type: EntityType;
  id: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Football Manager-style clickable entity link.
 * Renders text that navigates to the entity's page when clicked.
 *
 * @example
 * <EntityLink type="driver" id="max-verstappen">Max Verstappen</EntityLink>
 * <EntityLink type="team" id="mclaren">McLaren</EntityLink>
 */
export function EntityLink({ type, id, children, className = '', style }: EntityLinkProps) {
  const navigateToEntity = useEntityNavigation();

  return (
    <button
      type="button"
      onClick={() => navigateToEntity(type, id)}
      className={`entity-link cursor-pointer hover:underline ${className}`}
      style={{ ...ACCENT_TEXT_STYLE, ...style }}
    >
      {children}
    </button>
  );
}
