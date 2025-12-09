/**
 * Global search hook for Football Manager-style search across all entities
 * Provides fuzzy matching across teams, drivers, staff, circuits, and pages
 */

import { useMemo, useState, useCallback } from 'react';
import { useDerivedGameState } from './useDerivedGameState';
import { sections } from '../navigation';
import type { EntityType } from '../utils/entity-navigation';

// ===========================================
// TYPES
// ===========================================

export type SearchResultType = EntityType | 'page';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  label: string;
  sublabel?: string;
}

interface GroupedResults {
  teams: SearchResult[];
  drivers: SearchResult[];
  staff: SearchResult[];
  circuits: SearchResult[];
  pages: SearchResult[];
}

// ===========================================
// HELPERS
// ===========================================

/**
 * Simple fuzzy match - checks if all characters in query appear in text in order
 */
function fuzzyMatch(query: string, text: string): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // First check if it's a substring (strongest match)
  if (lowerText.includes(lowerQuery)) {
    return true;
  }

  // Then check fuzzy match (characters in order)
  let queryIndex = 0;
  for (const char of lowerText) {
    if (char === lowerQuery[queryIndex]) {
      queryIndex++;
      if (queryIndex === lowerQuery.length) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Score a match - higher is better
 * Prioritizes exact matches, then prefix matches, then substring, then fuzzy
 */
function scoreMatch(query: string, text: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerText === lowerQuery) return 100;
  if (lowerText.startsWith(lowerQuery)) return 80;
  if (lowerText.includes(lowerQuery)) return 60;
  if (fuzzyMatch(query, text)) return 40;
  return 0;
}

// ===========================================
// HOOK
// ===========================================

export function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const { gameState } = useDerivedGameState();

  // Build searchable items from game state
  const allItems = useMemo((): SearchResult[] => {
    const items: SearchResult[] = [];

    // Teams
    if (gameState?.teams) {
      for (const team of gameState.teams) {
        items.push({
          id: team.id,
          type: 'team',
          label: team.name,
          sublabel: team.headquarters,
        });
      }
    }

    // Drivers
    if (gameState?.drivers) {
      for (const driver of gameState.drivers) {
        const team = gameState.teams?.find(t => t.id === driver.teamId);
        items.push({
          id: driver.id,
          type: 'driver',
          label: `${driver.firstName} ${driver.lastName}`,
          sublabel: team?.name ?? 'Free Agent',
        });
      }
    }

    // Chiefs (staff)
    if (gameState?.chiefs) {
      for (const chief of gameState.chiefs) {
        const team = gameState.teams?.find(t => t.id === chief.teamId);
        items.push({
          id: chief.id,
          type: 'chief',
          label: `${chief.firstName} ${chief.lastName}`,
          sublabel: `${chief.role.charAt(0).toUpperCase() + chief.role.slice(1)}${team ? ` • ${team.name}` : ' • Free Agent'}`,
        });
      }
    }

    // Circuits
    if (gameState?.circuits) {
      for (const circuit of gameState.circuits) {
        items.push({
          id: circuit.id,
          type: 'circuit',
          label: circuit.name,
          sublabel: `${circuit.location}, ${circuit.country}`,
        });
      }
    }

    // Pages (from navigation)
    for (const section of sections) {
      for (const subItem of section.subItems) {
        items.push({
          id: `${section.id}/${subItem.id}`,
          type: 'page',
          label: subItem.label,
          sublabel: section.label,
        });
      }
    }

    return items;
  }, [gameState]);

  // Filter and group results
  const results = useMemo((): GroupedResults => {
    const empty: GroupedResults = {
      teams: [],
      drivers: [],
      staff: [],
      circuits: [],
      pages: [],
    };

    if (!query.trim()) {
      return empty;
    }

    const trimmedQuery = query.trim();
    const scored: Array<{ item: SearchResult; score: number }> = [];

    for (const item of allItems) {
      const labelScore = scoreMatch(trimmedQuery, item.label);
      const sublabelScore = item.sublabel ? scoreMatch(trimmedQuery, item.sublabel) * 0.5 : 0;
      const score = Math.max(labelScore, sublabelScore);

      if (score > 0) {
        scored.push({ item, score });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Group results
    const grouped: GroupedResults = { ...empty };
    for (const { item } of scored) {
      switch (item.type) {
        case 'team':
          grouped.teams.push(item);
          break;
        case 'driver':
          grouped.drivers.push(item);
          break;
        case 'chief':
        case 'principal':
          grouped.staff.push(item);
          break;
        case 'circuit':
          grouped.circuits.push(item);
          break;
        case 'page':
          grouped.pages.push(item);
          break;
      }
    }

    return grouped;
  }, [query, allItems]);

  // Check if any results exist
  const hasResults = useMemo(() => {
    return Object.values(results).some(arr => arr.length > 0);
  }, [results]);

  const clearQuery = useCallback(() => {
    setQuery('');
  }, []);

  return {
    query,
    setQuery,
    clearQuery,
    results,
    hasResults,
  };
}
