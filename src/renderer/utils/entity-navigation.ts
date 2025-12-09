import { createContext, useContext } from 'react';
import type { SectionId } from '../navigation';

export type EntityType = 'team' | 'driver' | 'chief' | 'principal' | 'circuit' | 'race';

export interface EntityRoute {
  section: SectionId;
  subItem: string;
  entityId: string;
}

/**
 * Maps an entity type and ID to its navigation route.
 * Used for Football Manager-style entity linking throughout the app.
 */
export function getEntityRoute(type: EntityType, id: string): EntityRoute {
  switch (type) {
    case 'team':
      return { section: 'world', subItem: 'teams', entityId: id };
    case 'driver':
      return { section: 'world', subItem: 'drivers', entityId: id };
    case 'chief':
    case 'principal':
      return { section: 'world', subItem: 'staff', entityId: id };
    case 'circuit':
      return { section: 'fia', subItem: 'races', entityId: id };
    case 'race':
      // For races, id is the race number as string
      return { section: 'fia', subItem: 'results', entityId: id };
  }
}

export type NavigateToEntityFn = (type: EntityType, id: string) => void;

interface EntityNavigationContextValue {
  navigateToEntity: NavigateToEntityFn;
}

export const EntityNavigationContext = createContext<EntityNavigationContextValue | null>(null);

export function useEntityNavigation(): NavigateToEntityFn {
  const context = useContext(EntityNavigationContext);
  if (!context) {
    throw new Error('useEntityNavigation must be used within EntityNavigationProvider');
  }
  return context.navigateToEntity;
}
