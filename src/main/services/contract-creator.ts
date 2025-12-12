/**
 * Contract Creation Module
 *
 * Handles creating contracts from completed negotiations and generating news/events.
 */

import { randomUUID } from 'crypto';
import {
  getChiefRoleDisplayName,
  getSponsorTierDisplayName,
} from '../engines/evaluators';
import { pushNewsEvent } from './news-generator';
import type {
  GameState,
  ActiveManufacturerContract,
  ActiveSponsorDeal,
  ManufacturerNegotiation,
  DriverNegotiation,
  SponsorNegotiation,
  StaffNegotiation,
  DriverContractTerms,
  SponsorContractTerms,
  StaffContractTerms,
} from '../../shared/domain';
import {
  CalendarEventType,
  ManufacturerType,
  ManufacturerDealType,
  createEvent,
  teamRef,
  ChiefRole,
  EntityType,
  NewsEventType,
} from '../../shared/domain';
import { NegotiationPhase } from '../../shared/domain/types';
import { getFullName } from '../../shared/utils/format';
import { seasonToYear } from '../../shared/utils/date-utils';

/** Initial bonus level for new contracts (0 = no bonus) */
const INITIAL_BONUS_LEVEL = 0;

/** Early termination penalty multiplier (100% of remaining contract value) */
const EARLY_TERMINATION_PENALTY_MULTIPLIER = 1.0;

// =============================================================================
// MANUFACTURER CONTRACT CREATION
// =============================================================================

/**
 * Result of creating a contract from a completed negotiation
 */
export interface ContractCreationResult {
  newContract: ActiveManufacturerContract;
  earlyTerminationPenalty: number;
  oldManufacturerId: string | null;
}

/**
 * Creates a manufacturer contract from a completed negotiation.
 * Handles early termination penalty if switching mid-contract.
 *
 * @param negotiation - The completed manufacturer negotiation
 * @param state - Current game state (will be mutated)
 * @returns Contract creation result with penalty info
 */
export function createContractFromNegotiation(
  negotiation: ManufacturerNegotiation,
  state: GameState
): ContractCreationResult {
  const teamId = negotiation.teamId;
  const manufacturerId = negotiation.manufacturerId;
  const forSeason = negotiation.forSeason;

  // Get the accepted terms from the last round
  const lastRound = negotiation.rounds[negotiation.rounds.length - 1];
  const terms = lastRound.terms;

  // Find existing engine contract for this team
  const existingContractIndex = state.manufacturerContracts.findIndex(
    (c) => c.teamId === teamId && c.type === ManufacturerType.Engine
  );
  const existingContract =
    existingContractIndex !== -1 ? state.manufacturerContracts[existingContractIndex] : null;

  // Calculate early termination penalty
  let earlyTerminationPenalty = 0;
  let oldManufacturerId: string | null = null;

  if (existingContract) {
    oldManufacturerId = existingContract.manufacturerId;
    const remainingSeasons = existingContract.endSeason - state.currentSeason.seasonNumber;

    // Only apply penalty if contract extends beyond current season
    if (remainingSeasons > 0) {
      earlyTerminationPenalty = Math.round(
        remainingSeasons * existingContract.annualCost * EARLY_TERMINATION_PENALTY_MULTIPLIER
      );
    }

    // Remove the old contract
    state.manufacturerContracts.splice(existingContractIndex, 1);
  }

  // Deduct penalty from team budget (if any)
  if (earlyTerminationPenalty > 0) {
    const team = state.teams.find((t) => t.id === teamId);
    if (team) {
      team.budget -= earlyTerminationPenalty;
    }
  }

  // Create the new contract
  const newContract: ActiveManufacturerContract = {
    manufacturerId,
    teamId,
    type: ManufacturerType.Engine,
    dealType: ManufacturerDealType.Customer, // MVP: all deals are customer deals
    annualCost: terms.annualCost,
    bonusLevel: INITIAL_BONUS_LEVEL,
    startSeason: forSeason,
    endSeason: forSeason + terms.duration - 1,
  };

  // Add the new contract
  state.manufacturerContracts.push(newContract);

  // Update team engine state with negotiated benefits
  const teamState = state.teamStates[teamId];
  if (teamState) {
    teamState.engineState.customisationPointsOwned += terms.customisationPointsIncluded;
    teamState.engineState.preNegotiatedUpgrades = terms.upgradesIncluded;
    if (terms.optimisationIncluded) {
      teamState.engineState.optimisationPurchasedForNextSeason = true;
    }
  }

  return {
    newContract,
    earlyTerminationPenalty,
    oldManufacturerId,
  };
}

/**
 * Generates a news headline for a completed engine contract signing.
 * Used when any team (player or AI) completes a manufacturer negotiation.
 */
export function generateContractSigningHeadline(
  state: GameState,
  contractResult: ContractCreationResult,
  teamId: string,
  newManufacturerId: string
): void {
  const team = state.teams.find((t) => t.id === teamId);
  const newManufacturer = state.manufacturers.find((m) => m.id === newManufacturerId);
  const oldManufacturer = contractResult.oldManufacturerId
    ? state.manufacturers.find((m) => m.id === contractResult.oldManufacturerId)
    : null;

  if (!team || !newManufacturer) return;

  const isSwitching = oldManufacturer && oldManufacturer.id !== newManufacturer.id;
  const contractDuration =
    contractResult.newContract.endSeason - contractResult.newContract.startSeason + 1;

  const headline = isSwitching
    ? `${team.name} switches to ${newManufacturer.name} engines`
    : `${team.name} extends ${newManufacturer.name} engine deal`;
  const body = isSwitching
    ? `${team.name} has signed a ${contractDuration}-year engine supply deal with ${newManufacturer.name}, ending their relationship with ${oldManufacturer.name}.`
    : `${team.name} has renewed their engine partnership with ${newManufacturer.name} for ${contractDuration} seasons.`;

  state.calendarEvents.push({
    id: randomUUID(),
    date: state.currentDate,
    type: CalendarEventType.Headline,
    subject: headline,
    body,
    critical: false,
  });
}

// =============================================================================
// DRIVER CONTRACT CREATION
// =============================================================================

/**
 * Result of creating a driver contract
 */
export interface DriverContractResult {
  driverId: string;
  teamId: string;
  oldTeamId: string | null;
  salary: number;
  contractDuration: number;
  endSeason: number;
}

/**
 * Create a driver contract from a completed negotiation.
 * Updates the driver's teamId, contractEnd, and salary.
 */
export function createDriverContractFromNegotiation(
  negotiation: DriverNegotiation,
  state: GameState
): DriverContractResult | null {
  const driver = state.drivers.find((d) => d.id === negotiation.driverId);
  if (!driver) return null;

  const lastRound = negotiation.rounds[negotiation.rounds.length - 1];
  if (!lastRound) return null;

  const terms = lastRound.terms as DriverContractTerms;

  const oldTeamId = driver.teamId;
  const newTeamId = negotiation.teamId;
  const endSeason = negotiation.forSeason + terms.duration - 1;

  // Update driver
  driver.teamId = newTeamId;
  driver.contractEnd = endSeason;
  driver.salary = terms.salary;
  driver.role = terms.driverStatus;

  return {
    driverId: driver.id,
    teamId: newTeamId,
    oldTeamId,
    salary: terms.salary,
    contractDuration: terms.duration,
    endSeason,
  };
}

/**
 * Generate news headline and email for a driver signing.
 * Called for ALL driver signings (not just player team).
 */
export function generateDriverSigningEvent(
  state: GameState,
  result: DriverContractResult,
  isPlayerTeamInvolved: boolean
): void {
  const driver = state.drivers.find((d) => d.id === result.driverId);
  const newTeam = state.teams.find((t) => t.id === result.teamId);
  const oldTeam = result.oldTeamId ? state.teams.find((t) => t.id === result.oldTeamId) : null;

  if (!driver || !newTeam) return;

  const driverName = getFullName(driver);
  const isSwitching = oldTeam && oldTeam.id !== newTeam.id;

  // Calculate the season year for the contract start
  const forSeasonYear = seasonToYear(state.currentSeason.seasonNumber + 1);

  // Emit news event for reactive news generation
  pushNewsEvent(state, NewsEventType.DriverSigned, isSwitching ? 'high' : 'medium', {
    driverId: driver.id,
    driverName,
    teamId: newTeam.id,
    teamName: newTeam.name,
    previousTeamName: oldTeam && oldTeam.id !== newTeam.id ? oldTeam.name : undefined,
    contractYears: result.contractDuration,
    forSeason: forSeasonYear,
  });

  // Email to player (for all signings, but don't stop sim)
  const headline = isSwitching
    ? `${driverName} joins ${newTeam.name}`
    : oldTeam && oldTeam.id === newTeam.id
      ? `${newTeam.name} extends ${driverName} contract`
      : `${driverName} signs for ${newTeam.name}`;

  const body = isSwitching
    ? `${driverName} has signed a ${result.contractDuration}-year deal with ${newTeam.name}, leaving ${oldTeam!.name}.`
    : oldTeam && oldTeam.id === newTeam.id
      ? `${newTeam.name} has renewed ${driverName}'s contract for ${result.contractDuration} seasons.`
      : `${driverName} has signed a ${result.contractDuration}-year contract with ${newTeam.name}.`;

  state.calendarEvents.push({
    id: randomUUID(),
    date: state.currentDate,
    type: CalendarEventType.Email,
    subject: headline,
    body: isPlayerTeamInvolved
      ? body
      : `${body} This may affect the driver market for next season.`,
    critical: false, // Don't stop sim
  });
}

// =============================================================================
// STAFF CONTRACT CREATION
// =============================================================================

/**
 * Result of creating a staff contract
 */
export interface StaffContractResult {
  chiefId: string;
  teamId: string;
  oldTeamId: string | null;
  salary: number;
  contractDuration: number;
  endSeason: number;
  buyoutPaid: number;
  signingBonus: number;
  role: ChiefRole;
}

/**
 * Create a staff contract from a completed negotiation.
 * Updates the chief's teamId, contractEnd, and salary.
 * Deducts buyout and signing bonus from team budget.
 */
export function createStaffContractFromNegotiation(
  negotiation: StaffNegotiation,
  state: GameState
): StaffContractResult | null {
  const chief = state.chiefs.find((c) => c.id === negotiation.staffId);
  if (!chief) return null;

  const lastRound = negotiation.rounds[negotiation.rounds.length - 1];
  if (!lastRound) return null;

  const terms = lastRound.terms as StaffContractTerms;

  const oldTeamId = chief.teamId;
  const newTeamId = negotiation.teamId;
  const endSeason = negotiation.forSeason + terms.duration - 1;

  // Update chief
  chief.teamId = newTeamId;
  chief.contractEnd = endSeason;
  chief.salary = terms.salary;

  // Deduct buyout and signing bonus from player's team budget (if applicable)
  const team = state.teams.find((t) => t.id === newTeamId);
  if (team && newTeamId === state.player.teamId) {
    if (terms.buyoutRequired > 0) {
      team.budget -= terms.buyoutRequired;
    }
    if (terms.signingBonus > 0) {
      team.budget -= terms.signingBonus;
    }
  }

  return {
    chiefId: chief.id,
    teamId: newTeamId,
    oldTeamId,
    salary: terms.salary,
    contractDuration: terms.duration,
    endSeason,
    buyoutPaid: terms.buyoutRequired,
    signingBonus: terms.signingBonus,
    role: chief.role,
  };
}

/**
 * Generate news headline and email for a staff signing.
 * Called for ALL staff signings (not just player team).
 */
export function generateStaffSigningEvent(
  state: GameState,
  result: StaffContractResult,
  isPlayerTeamInvolved: boolean
): void {
  const chief = state.chiefs.find((c) => c.id === result.chiefId);
  const newTeam = state.teams.find((t) => t.id === result.teamId);
  const oldTeam = result.oldTeamId ? state.teams.find((t) => t.id === result.oldTeamId) : null;

  if (!chief || !newTeam) return;

  const chiefName = getFullName(chief);
  const roleName = getChiefRoleDisplayName(result.role);
  const isPoaching = oldTeam && oldTeam.id !== newTeam.id;
  const isRenewal = oldTeam && oldTeam.id === newTeam.id;

  // Generate news headline for all signings
  let headline: string;
  let body: string;

  if (isPoaching) {
    headline = `${newTeam.name} signs ${chiefName} from ${oldTeam.name}`;
    body = `${newTeam.name} has signed ${chiefName} as ${roleName}, poaching them from ${oldTeam.name} with a ${result.contractDuration}-year deal.`;
  } else if (isRenewal) {
    headline = `${newTeam.name} extends ${chiefName} contract`;
    body = `${newTeam.name} has renewed ${chiefName}'s contract as ${roleName} for ${result.contractDuration} seasons.`;
  } else {
    // New hire (from free agency)
    headline = `${newTeam.name} hires ${chiefName} as ${roleName}`;
    body = `${newTeam.name} has hired ${chiefName} as their new ${roleName} on a ${result.contractDuration}-year contract.`;
  }

  // Create news headline event
  state.calendarEvents.push({
    id: randomUUID(),
    date: state.currentDate,
    type: CalendarEventType.Headline,
    subject: headline,
    body,
    critical: false,
  });

  // Create STAFF_HIRED game event for Player Wiki
  state.events.push(
    createEvent({
      type: 'STAFF_HIRED',
      date: { ...state.currentDate },
      involvedEntities: [
        { type: EntityType.Staff, id: chief.id },
        teamRef(newTeam.id),
        ...(oldTeam ? [teamRef(oldTeam.id)] : []),
      ],
      data: {
        chiefId: chief.id,
        chiefName,
        role: chief.role,
        teamId: newTeam.id,
        teamName: newTeam.name,
        previousTeamId: oldTeam?.id ?? null,
        salary: result.salary,
        duration: result.contractDuration,
        buyoutPaid: result.buyoutPaid,
      },
      importance: chief.ability >= 85 ? 'high' : 'medium',
    })
  );

  // Email for player team
  if (isPlayerTeamInvolved) {
    state.calendarEvents.push({
      id: randomUUID(),
      date: state.currentDate,
      type: CalendarEventType.Email,
      subject: `${chiefName} contract confirmed`,
      body: `Your agreement with ${chiefName} as ${roleName} is now official. Contract duration: ${result.contractDuration} season(s).`,
      critical: false,
    });
  }
}

// =============================================================================
// SPONSOR CONTRACT CREATION
// =============================================================================

/** Result of creating a sponsor contract */
export interface SponsorContractResult {
  sponsorId: string;
  teamId: string;
  tier: import('../../shared/domain').SponsorTier;
  signingBonus: number;
  monthlyPayment: number;
  contractDuration: number;
  startSeason: number;
  endSeason: number;
}

/**
 * Create a sponsor deal from a completed negotiation.
 * Updates the team's sponsor deals array.
 */
export function createSponsorContractFromNegotiation(
  negotiation: SponsorNegotiation,
  state: GameState
): SponsorContractResult | null {
  const sponsor = state.sponsors.find((s) => s.id === negotiation.sponsorId);
  if (!sponsor) return null;

  const lastRound = negotiation.rounds[negotiation.rounds.length - 1];
  if (!lastRound) return null;

  const terms = lastRound.terms as SponsorContractTerms;
  const startSeason = negotiation.forSeason;
  const endSeason = startSeason + terms.duration - 1;

  // Create the active sponsor deal
  const deal: ActiveSponsorDeal = {
    sponsorId: sponsor.id,
    teamId: negotiation.teamId,
    tier: sponsor.tier,
    signingBonus: terms.signingBonus,
    monthlyPayment: terms.monthlyPayment,
    guaranteed: !terms.exitClausePosition, // If no exit clause, payment is guaranteed
    startSeason,
    endSeason,
  };

  // Add to sponsor deals
  state.sponsorDeals.push(deal);

  return {
    sponsorId: sponsor.id,
    teamId: negotiation.teamId,
    tier: sponsor.tier,
    signingBonus: terms.signingBonus,
    monthlyPayment: terms.monthlyPayment,
    contractDuration: terms.duration,
    startSeason,
    endSeason,
  };
}

/**
 * Generate news headline and email for a sponsor signing.
 */
export function generateSponsorSigningEvent(
  state: GameState,
  result: SponsorContractResult,
  isPlayerTeamInvolved: boolean
): void {
  const sponsor = state.sponsors.find((s) => s.id === result.sponsorId);
  const team = state.teams.find((t) => t.id === result.teamId);

  if (!sponsor || !team) return;

  const tierName = getSponsorTierDisplayName(result.tier);
  const headline = `${team.name} announces ${sponsor.name} as ${tierName}`;
  const annualValue = result.monthlyPayment * 12;
  const body = `${team.name} has signed ${sponsor.name} as their ${tierName} in a ${result.contractDuration}-year deal worth $${(annualValue / 1_000_000).toFixed(1)}M per season.`;

  // News headline (visible to everyone)
  state.calendarEvents.push({
    id: randomUUID(),
    date: state.currentDate,
    type: CalendarEventType.Headline,
    subject: headline,
    body,
    critical: false,
  });

  // Email to player if their team is involved
  if (isPlayerTeamInvolved) {
    state.calendarEvents.push({
      id: randomUUID(),
      date: state.currentDate,
      type: CalendarEventType.Email,
      subject: headline,
      body: `${body} This sponsorship will provide important funding for your team.`,
      critical: false, // Don't stop sim
    });
  }
}

// =============================================================================
// NEGOTIATION UPDATE EMAIL
// =============================================================================

/**
 * Generate an email for player team negotiation updates (sim-stopping events).
 * Used by both driver and manufacturer negotiations.
 */
export function generateNegotiationUpdateEmail(
  state: GameState,
  stakeholderName: string,
  phase: NegotiationPhase,
  isUltimatum: boolean,
  failedSuffix?: string
): void {
  let subject: string;
  let body: string;

  if (phase === NegotiationPhase.Completed) {
    subject = `${stakeholderName} accepts your offer`;
    body = `Great news! ${stakeholderName} has accepted your contract proposal. The deal is now complete.`;
  } else if (phase === NegotiationPhase.Failed) {
    subject = `${stakeholderName} rejects negotiation`;
    body = `${stakeholderName} has declined to continue negotiations.${failedSuffix ?? ''}`;
  } else if (phase === NegotiationPhase.ResponseReceived) {
    subject = `${stakeholderName} responds with counter-offer`;
    body = isUltimatum
      ? `${stakeholderName} has made a final offer. This is their last position - accept or reject.`
      : `${stakeholderName} has responded with a counter-proposal. Review their terms and decide how to proceed.`;
  } else {
    subject = `Update from ${stakeholderName}`;
    body = `${stakeholderName} has updated the negotiation status.`;
  }

  state.calendarEvents.push({
    id: randomUUID(),
    date: state.currentDate,
    type: CalendarEventType.Email,
    subject,
    body,
    critical: true,
  });
}
