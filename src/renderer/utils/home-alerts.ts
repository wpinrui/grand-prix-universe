/**
 * Home page alert generation utilities
 * Generates actionable alerts for the home page dashboard
 */
import {
  SponsorTier,
  NegotiationPhase,
  CalendarEventType,
  type GameState,
  type Team,
  type CalendarEvent,
} from '../../shared/domain';
import { getFullName } from './format';

// ===========================================
// TYPES
// ===========================================

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface HomePageAlert {
  id: string;
  severity: AlertSeverity;
  category: string;
  message: string;
  action: {
    label: string;
    section: string;
    subItem: string;
  };
}

// ===========================================
// CONSTANTS
// ===========================================

/** Expected sponsor slot counts per tier */
const SPONSOR_SLOT_COUNTS: Record<SponsorTier, number> = {
  [SponsorTier.Title]: 1,
  [SponsorTier.Major]: 3,
  [SponsorTier.Minor]: 5,
};

// ===========================================
// ALERT GENERATORS
// ===========================================

/**
 * Generate alerts for expiring contracts (driver, chief, manufacturer)
 */
function generateExpiringContractAlerts(
  gameState: GameState,
  playerTeam: Team
): HomePageAlert[] {
  const alerts: HomePageAlert[] = [];
  const currentSeason = gameState.currentSeason.calendar[0]?.result
    ? gameState.currentDate.year
    : gameState.currentDate.year;

  // Check driver contracts
  const teamDrivers = gameState.drivers.filter((d) => d.teamId === playerTeam.id);
  for (const driver of teamDrivers) {
    if (driver.contractEnd === currentSeason) {
      alerts.push({
        id: `driver-contract-${driver.id}`,
        severity: 'critical',
        category: 'Contract',
        message: `${getFullName(driver)}'s contract expires this season`,
        action: {
          label: 'View Staff',
          section: 'team',
          subItem: 'staff',
        },
      });
    }
  }

  // Check chief contracts
  const teamChiefs = gameState.chiefs.filter((c) => c.teamId === playerTeam.id);
  for (const chief of teamChiefs) {
    if (chief.contractEnd === currentSeason) {
      alerts.push({
        id: `chief-contract-${chief.id}`,
        severity: 'warning',
        category: 'Contract',
        message: `${getFullName(chief)}'s contract expires this season`,
        action: {
          label: 'View Staff',
          section: 'team',
          subItem: 'staff',
        },
      });
    }
  }

  // Check manufacturer contracts
  const teamContracts = gameState.manufacturerContracts.filter(
    (c) => c.teamId === playerTeam.id
  );
  for (const contract of teamContracts) {
    if (contract.endSeason === currentSeason) {
      const manufacturer = gameState.manufacturers.find(
        (m) => m.id === contract.manufacturerId
      );
      alerts.push({
        id: `manufacturer-contract-${contract.manufacturerId}`,
        severity: 'warning',
        category: 'Contract',
        message: `${manufacturer?.name ?? 'Manufacturer'} contract expires this season`,
        action: {
          label: 'View Contracts',
          section: 'commercial',
          subItem: 'contracts',
        },
      });
    }
  }

  return alerts;
}

/**
 * Generate alerts for unfilled sponsor slots
 */
function generateUnfilledSponsorAlerts(
  gameState: GameState,
  playerTeam: Team
): HomePageAlert[] {
  const alerts: HomePageAlert[] = [];
  const teamDeals = gameState.sponsorDeals.filter((d) => d.teamId === playerTeam.id);

  // Count filled slots per tier
  const filledByTier: Record<SponsorTier, number> = {
    [SponsorTier.Title]: 0,
    [SponsorTier.Major]: 0,
    [SponsorTier.Minor]: 0,
  };

  for (const deal of teamDeals) {
    filledByTier[deal.tier]++;
  }

  // Check for unfilled slots
  for (const tier of [SponsorTier.Title, SponsorTier.Major, SponsorTier.Minor]) {
    const expected = SPONSOR_SLOT_COUNTS[tier];
    const filled = filledByTier[tier];
    const unfilled = expected - filled;

    if (unfilled > 0) {
      const tierLabel = tier === SponsorTier.Title ? 'Title' : tier === SponsorTier.Major ? 'Major' : 'Minor';
      alerts.push({
        id: `sponsor-slot-${tier}`,
        severity: tier === SponsorTier.Title ? 'warning' : 'info',
        category: 'Sponsors',
        message: `${unfilled} ${tierLabel} sponsor slot${unfilled > 1 ? 's' : ''} available`,
        action: {
          label: 'Find Sponsors',
          section: 'commercial',
          subItem: 'sponsors',
        },
      });
    }
  }

  return alerts;
}

/**
 * Generate alerts for parts ready to install
 */
function generatePartsReadyAlerts(
  gameState: GameState,
  playerTeam: Team
): HomePageAlert[] {
  const alerts: HomePageAlert[] = [];
  const teamState = gameState.teamStates[playerTeam.id];
  if (!teamState) return alerts;

  // Find parts that are ready but not fully installed
  const readyParts = teamState.pendingParts.filter((part) => {
    // Part is ready if readyDate <= currentDate and not installed on both cars
    const isReady =
      part.readyDate.year < gameState.currentDate.year ||
      (part.readyDate.year === gameState.currentDate.year &&
        part.readyDate.month < gameState.currentDate.month) ||
      (part.readyDate.year === gameState.currentDate.year &&
        part.readyDate.month === gameState.currentDate.month &&
        part.readyDate.day <= gameState.currentDate.day);
    const notFullyInstalled = part.installedOnCars.length < 2;
    return isReady && notFullyInstalled;
  });

  for (const part of readyParts) {
    const carsRemaining = 2 - part.installedOnCars.length;
    alerts.push({
      id: `part-ready-${part.id}`,
      severity: 'info',
      category: 'Parts',
      message: `${part.item} ready to install (${carsRemaining} car${carsRemaining > 1 ? 's' : ''})`,
      action: {
        label: 'View Construction',
        section: 'engineering',
        subItem: 'construction',
      },
    });
  }

  return alerts;
}

/**
 * Generate alerts for active negotiations awaiting response
 */
function generateNegotiationAlerts(
  gameState: GameState,
  playerTeam: Team
): HomePageAlert[] {
  const alerts: HomePageAlert[] = [];

  // Filter negotiations for player team that are awaiting response
  const activeNegotiations = gameState.negotiations.filter(
    (n) => n.teamId === playerTeam.id && n.phase === NegotiationPhase.ResponseReceived
  );

  for (const negotiation of activeNegotiations) {
    let stakeholderName = 'Unknown';
    let actionSubItem = 'contracts';

    switch (negotiation.stakeholderType) {
      case 'driver': {
        const driver = gameState.drivers.find((d) => d.id === (negotiation as { driverId: string }).driverId);
        stakeholderName = driver ? getFullName(driver) : 'Driver';
        actionSubItem = 'staff';
        break;
      }
      case 'staff': {
        const staff = gameState.chiefs.find((c) => c.id === (negotiation as { staffId: string }).staffId);
        stakeholderName = staff ? getFullName(staff) : 'Staff';
        actionSubItem = 'staff';
        break;
      }
      case 'sponsor': {
        const sponsor = gameState.sponsors.find((s) => s.id === (negotiation as { sponsorId: string }).sponsorId);
        stakeholderName = sponsor?.name ?? 'Sponsor';
        actionSubItem = 'sponsors';
        break;
      }
      case 'manufacturer': {
        const manufacturer = gameState.manufacturers.find(
          (m) => m.id === (negotiation as { manufacturerId: string }).manufacturerId
        );
        stakeholderName = manufacturer?.name ?? 'Manufacturer';
        actionSubItem = 'contracts';
        break;
      }
    }

    alerts.push({
      id: `negotiation-${negotiation.id}`,
      severity: 'warning',
      category: 'Negotiation',
      message: `${stakeholderName} has responded to your offer`,
      action: {
        label: 'View',
        section: 'commercial',
        subItem: actionSubItem,
      },
    });
  }

  return alerts;
}

// ===========================================
// MAIN EXPORT
// ===========================================

/**
 * Generate all alerts for the home page
 * Returns alerts sorted by severity (critical > warning > info)
 */
export function generateHomePageAlerts(
  gameState: GameState,
  playerTeam: Team
): HomePageAlert[] {
  const alerts: HomePageAlert[] = [
    ...generateExpiringContractAlerts(gameState, playerTeam),
    ...generateUnfilledSponsorAlerts(gameState, playerTeam),
    ...generatePartsReadyAlerts(gameState, playerTeam),
    ...generateNegotiationAlerts(gameState, playerTeam),
  ];

  // Sort by severity
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Get unread emails from calendar events
 */
export function getUnreadEmails(calendarEvents: CalendarEvent[]): CalendarEvent[] {
  return calendarEvents
    .filter((e) => e.type === CalendarEventType.Email && !e.read)
    .sort((a, b) => {
      // Sort by date descending (newest first)
      if (a.date.year !== b.date.year) return b.date.year - a.date.year;
      if (a.date.month !== b.date.month) return b.date.month - a.date.month;
      return b.date.day - a.date.day;
    });
}

/**
 * Get recent headlines from calendar events
 */
export function getRecentHeadlines(
  calendarEvents: CalendarEvent[],
  limit: number = 3
): CalendarEvent[] {
  return calendarEvents
    .filter((e) => e.type === CalendarEventType.Headline)
    .sort((a, b) => {
      // Sort by date descending (newest first)
      if (a.date.year !== b.date.year) return b.date.year - a.date.year;
      if (a.date.month !== b.date.month) return b.date.month - a.date.month;
      return b.date.day - a.date.day;
    })
    .slice(0, limit);
}
