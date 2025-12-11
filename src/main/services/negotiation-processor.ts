/**
 * Negotiation Processor Module
 *
 * Handles proactive outreach from manufacturers, drivers, sponsors, and staff.
 * Also handles applying negotiation updates and creating contracts.
 */

import { randomUUID } from 'crypto';
import {
  getPlacementForTier,
  getSponsorTierDisplayName,
  hasRivalGroupConflict,
  evaluateStaffApproach,
  getChiefRoleDisplayName,
} from '../engines/evaluators';
import { evaluateDriverApproach } from '../engines/evaluators/team-evaluator';
import {
  createContractFromNegotiation,
  generateContractSigningHeadline,
  createDriverContractFromNegotiation,
  generateDriverSigningEvent,
  createStaffContractFromNegotiation,
  generateStaffSigningEvent,
  createSponsorContractFromNegotiation,
  generateSponsorSigningEvent,
  generateNegotiationUpdateEmail,
} from './contract-creator';
import type {
  GameState,
  Driver,
  Team,
  Sponsor,
  ManufacturerNegotiation,
  DriverNegotiation,
  SponsorNegotiation,
  StaffNegotiation,
  SponsorContractTerms,
  StaffContractTerms,
} from '../../shared/domain';
import type { NegotiationProcessingInput, NegotiationUpdate } from '../../shared/domain/engines';
import {
  CalendarEventType,
  ManufacturerType,
  SponsorTier,
  DriverRole,
} from '../../shared/domain';
import {
  NegotiationPhase,
  StakeholderType,
} from '../../shared/domain/types';
import {
  seasonToYear,
  offsetDate,
  daysBetween,
} from '../../shared/utils/date-utils';
import {
  generateBaseContractTerms,
  generateDefaultDriverTerms,
  createProactiveOutreach,
  createDriverOutreach,
  isContractExpiring,
  getCurrentManufacturer,
  DEFAULT_MAX_ROUNDS,
  DEFAULT_RELATIONSHIP_SCORE,
} from '../../shared/domain/engine-utils';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Proactive outreach timing - current supplier reaches out in May */
const OUTREACH_CURRENT_SUPPLIER_MONTH = 5;

/** Proactive outreach timing - other manufacturers reach out in June-July */
const OUTREACH_OTHER_MANUFACTURERS_MONTH = 6;

/** Driver outreach timing - drivers start looking for new teams in July */
const DRIVER_OUTREACH_START_MONTH = 7;

/** Default contract duration for driver outreach */
const DRIVER_DEFAULT_CONTRACT_YEARS = 2;

/** Cooldown days between driver outreach attempts to same team */
const DRIVER_OUTREACH_COOLDOWN_DAYS = 14;

/** Staff outreach timing - staff reach out in May-June (early transfer window) */
const STAFF_OUTREACH_START_MONTH = 5;
const STAFF_OUTREACH_END_MONTH = 6;

/** Buyout cost multiplier when staff approaches new team while under contract */
const STAFF_BUYOUT_SALARY_MULTIPLIER = 0.5;

/** Month when sponsors start reaching out (April) */
const SPONSOR_OUTREACH_MONTH = 4;

/** Default contract duration for sponsor outreach offers */
const DEFAULT_SPONSOR_OUTREACH_DURATION = 2;

// =============================================================================
// NEGOTIATION UPDATE APPLICATION
// =============================================================================

/**
 * Build input for negotiation engine processing
 */
export function buildNegotiationInput(state: GameState): NegotiationProcessingInput {
  // Get team IDs that have already secured contracts for next season
  const nextSeason = state.currentSeason.seasonNumber + 1;
  const securedTeamIds = state.manufacturerContracts
    .filter((c) => c.type === ManufacturerType.Engine && c.endSeason >= nextSeason)
    .map((c) => c.teamId);

  // Build constructor standings map from current season data
  const constructorStandings = new Map<string, number>();
  if (state.currentSeason.constructorStandings) {
    state.currentSeason.constructorStandings.forEach((standing, index) => {
      constructorStandings.set(standing.teamId, index + 1); // 1-indexed position
    });
  }

  return {
    negotiations: state.negotiations,
    currentDate: state.currentDate,
    teams: state.teams,
    drivers: state.drivers,
    driverStates: state.driverStates,
    constructorStandings,
    chiefs: state.chiefs,
    manufacturers: state.manufacturers,
    activeManufacturerContracts: state.manufacturerContracts,
    securedTeamIds,
    relationshipScores: {}, // TODO: Implement relationship tracking
    sponsors: state.sponsors,
    activeSponsorDeals: state.sponsorDeals,
  };
}

/**
 * Apply negotiation updates to game state
 * Returns true if any update should stop simulation (for player team)
 */
export function applyNegotiationUpdates(state: GameState, updates: NegotiationUpdate[]): boolean {
  let shouldStop = false;
  const playerTeamId = state.player.teamId;

  for (const update of updates) {
    // Find and update the negotiation
    const index = state.negotiations.findIndex((n) => n.id === update.negotiationId);
    if (index !== -1 && update.updatedNegotiation) {
      state.negotiations[index] = update.updatedNegotiation;

      const negotiation = update.updatedNegotiation;
      const isPlayerTeam = negotiation.teamId === playerTeamId;

      // Handle based on stakeholder type
      if (negotiation.stakeholderType === StakeholderType.Driver) {
        // Driver negotiation
        const driverNeg = negotiation as DriverNegotiation;

        // Handle completed driver negotiations - create contracts for ALL teams
        if (driverNeg.phase === NegotiationPhase.Completed) {
          const contractResult = createDriverContractFromNegotiation(driverNeg, state);
          if (contractResult) {
            generateDriverSigningEvent(state, contractResult, isPlayerTeam);
          }
        }

        // Generate email for player team driver negotiations (sim-stopping events)
        if (update.shouldStopSimulation && isPlayerTeam) {
          shouldStop = true;

          const driver = state.drivers.find((d) => d.id === driverNeg.driverId);
          if (driver) {
            const driverName = `${driver.firstName} ${driver.lastName}`;
            const latestRound = driverNeg.rounds[driverNeg.rounds.length - 1];
            generateNegotiationUpdateEmail(
              state,
              driverName,
              driverNeg.phase,
              latestRound?.isUltimatum ?? false
            );
          }
        }
      } else if (negotiation.stakeholderType === StakeholderType.Manufacturer) {
        // Manufacturer negotiation
        const manufacturerNeg = negotiation as ManufacturerNegotiation;

        // Handle completed negotiations - create contracts for ALL teams
        if (manufacturerNeg.phase === NegotiationPhase.Completed) {
          const contractResult = createContractFromNegotiation(manufacturerNeg, state);
          generateContractSigningHeadline(
            state,
            contractResult,
            manufacturerNeg.teamId,
            manufacturerNeg.manufacturerId
          );
        }

        // Check if this affects player and should stop simulation
        if (update.shouldStopSimulation && isPlayerTeam) {
          shouldStop = true;

          // Generate email for player
          const manufacturer = state.manufacturers.find(
            (m) => m.id === manufacturerNeg.manufacturerId
          );
          if (manufacturer) {
            const latestRound = manufacturerNeg.rounds[manufacturerNeg.rounds.length - 1];
            generateNegotiationUpdateEmail(
              state,
              manufacturer.name,
              manufacturerNeg.phase,
              latestRound?.isUltimatum ?? false,
              ' You may approach other manufacturers.'
            );
          }
        }
      } else if (negotiation.stakeholderType === StakeholderType.Sponsor) {
        // Sponsor negotiation
        const sponsorNeg = negotiation as SponsorNegotiation;

        // Handle completed negotiations - create sponsor deals for ALL teams
        if (sponsorNeg.phase === NegotiationPhase.Completed) {
          const contractResult = createSponsorContractFromNegotiation(sponsorNeg, state);
          if (contractResult) {
            generateSponsorSigningEvent(state, contractResult, isPlayerTeam);
          }
        }

        // Check if this affects player and should stop simulation
        if (update.shouldStopSimulation && isPlayerTeam) {
          shouldStop = true;

          // Generate email for player
          const sponsor = state.sponsors.find((s) => s.id === sponsorNeg.sponsorId);
          if (sponsor) {
            const latestRound = sponsorNeg.rounds[sponsorNeg.rounds.length - 1];
            generateNegotiationUpdateEmail(
              state,
              sponsor.name,
              sponsorNeg.phase,
              latestRound?.isUltimatum ?? false,
              ' You may approach other sponsors.'
            );
          }
        }
      } else if (negotiation.stakeholderType === StakeholderType.Staff) {
        // Staff negotiation
        const staffNeg = negotiation as StaffNegotiation;

        // Handle completed staff negotiations - create contracts for ALL teams
        if (staffNeg.phase === NegotiationPhase.Completed) {
          const contractResult = createStaffContractFromNegotiation(staffNeg, state);
          if (contractResult) {
            generateStaffSigningEvent(state, contractResult, isPlayerTeam);
          }
        }

        // Check if this affects player and should stop simulation
        if (update.shouldStopSimulation && isPlayerTeam) {
          shouldStop = true;

          // Generate email for player
          const chief = state.chiefs.find((c) => c.id === staffNeg.staffId);
          if (chief) {
            const chiefName = `${chief.firstName} ${chief.lastName}`;
            const latestRound = staffNeg.rounds[staffNeg.rounds.length - 1];
            generateNegotiationUpdateEmail(
              state,
              chiefName,
              staffNeg.phase,
              latestRound?.isUltimatum ?? false
            );
          }
        }
      }
    }
  }

  return shouldStop;
}

// =============================================================================
// MANUFACTURER OUTREACH
// =============================================================================

/**
 * Check if a manufacturer has already reached out to a team this season
 * (prevents spam - only one outreach per manufacturer per team per season)
 */
function hasExistingManufacturerNegotiation(
  state: GameState,
  teamId: string,
  manufacturerId: string,
  forSeason: number
): boolean {
  return state.negotiations.some(
    (n) =>
      n.stakeholderType === StakeholderType.Manufacturer &&
      n.teamId === teamId &&
      (n as ManufacturerNegotiation).manufacturerId === manufacturerId &&
      n.forSeason === forSeason
  );
}

/**
 * Generate proactive outreach from manufacturers to teams with expiring contracts
 * Called during daily processing - checks date triggers
 */
export function processProactiveOutreach(state: GameState): boolean {
  const { currentDate, currentSeason } = state;
  const { month, day } = currentDate;
  const nextSeason = currentSeason.seasonNumber + 1;
  const playerTeamId = state.player.teamId;
  let playerReceivedOutreach = false;

  // Only trigger on day 1 of the outreach months
  if (day !== 1) return false;

  // Get all teams with expiring contracts
  const teamsWithExpiringContracts = state.teams.filter((team) =>
    isContractExpiring(team.id, currentSeason.seasonNumber, state.manufacturerContracts)
  );

  if (teamsWithExpiringContracts.length === 0) return false;

  // Get engine manufacturers (non-factory teams can be approached)
  const engineManufacturers = state.manufacturers.filter(
    (m) => m.type === ManufacturerType.Engine
  );

  for (const team of teamsWithExpiringContracts) {
    const currentManufacturerId = getCurrentManufacturer(team.id, state.manufacturerContracts);

    // Current supplier reaches out in May
    if (month === OUTREACH_CURRENT_SUPPLIER_MONTH && currentManufacturerId) {
      if (!hasExistingManufacturerNegotiation(state, team.id, currentManufacturerId, nextSeason)) {
        const manufacturer = engineManufacturers.find((m) => m.id === currentManufacturerId);
        if (manufacturer) {
          // Generate terms (current supplier offers retention terms)
          const terms = generateBaseContractTerms(manufacturer, 0, false);
          const negotiation = createProactiveOutreach(
            team.id,
            currentManufacturerId,
            nextSeason,
            currentDate,
            terms
          );
          state.negotiations.push(negotiation);

          // Email for player team
          if (team.id === playerTeamId) {
            playerReceivedOutreach = true;
            state.calendarEvents.push({
              id: randomUUID(),
              date: currentDate,
              type: CalendarEventType.Email,
              subject: `${manufacturer.name} wishes to discuss contract renewal`,
              body: `Your current engine supplier, ${manufacturer.name}, would like to discuss renewing your contract for the ${seasonToYear(nextSeason)} season. They have sent an initial proposal for your consideration.`,
              critical: true,
            });
          }
        }
      }
    }

    // Other manufacturers reach out in June (poaching attempts)
    if (month === OUTREACH_OTHER_MANUFACTURERS_MONTH) {
      for (const manufacturer of engineManufacturers) {
        // Skip current supplier (already reached out)
        if (manufacturer.id === currentManufacturerId) continue;

        // Skip if negotiation already exists
        if (hasExistingManufacturerNegotiation(state, team.id, manufacturer.id, nextSeason)) continue;

        // TODO: Add desperation-based probability here
        // For now, all manufacturers reach out to all available teams

        const terms = generateBaseContractTerms(manufacturer, 0, false);
        const negotiation = createProactiveOutreach(
          team.id,
          manufacturer.id,
          nextSeason,
          currentDate,
          terms
        );
        state.negotiations.push(negotiation);

        // Email for player team
        if (team.id === playerTeamId) {
          playerReceivedOutreach = true;
          state.calendarEvents.push({
            id: randomUUID(),
            date: currentDate,
            type: CalendarEventType.Email,
            subject: `${manufacturer.name} approaches with engine supply offer`,
            body: `${manufacturer.name} has approached your team with a proposal to supply engines for the ${seasonToYear(nextSeason)} season. Review their offer in the Contracts screen.`,
            critical: true,
          });
        }
      }
    }
  }

  return playerReceivedOutreach;
}

// =============================================================================
// DRIVER OUTREACH
// =============================================================================

/**
 * Check if a driver has already approached a team this season
 * (prevents spam - respects cooldown period)
 */
function hasRecentDriverOutreach(
  state: GameState,
  teamId: string,
  driverId: string,
  forSeason: number
): boolean {
  const { currentDate } = state;

  return state.negotiations.some((n) => {
    if (n.stakeholderType !== StakeholderType.Driver) return false;
    if (n.teamId !== teamId) return false;
    if ((n as DriverNegotiation).driverId !== driverId) return false;
    if (n.forSeason !== forSeason) return false;

    // Check cooldown period
    const daysSinceStart = daysBetween(n.startedDate, currentDate);
    return daysSinceStart < DRIVER_OUTREACH_COOLDOWN_DAYS;
  });
}

/**
 * Get constructor standings as a Map (teamId → position)
 */
function getConstructorStandingsMap(state: GameState): Map<string, number> {
  const standings = new Map<string, number>();
  state.currentSeason.constructorStandings.forEach((standing) => {
    standings.set(standing.teamId, standing.position);
  });
  return standings;
}

/**
 * Get race drivers for a team (excludes test drivers)
 */
function getTeamRaceDrivers(state: GameState, teamId: string): Driver[] {
  return state.drivers.filter((d) => d.teamId === teamId && d.role !== DriverRole.Test);
}

/**
 * Check if team has a vacant seat (fewer than 2 race drivers)
 */
function teamHasVacancy(state: GameState, teamId: string): boolean {
  return getTeamRaceDrivers(state, teamId).length < 2;
}

/**
 * Check if any of team's drivers have committed elsewhere
 */
function teamDriverCommittedElsewhere(state: GameState, teamId: string, forSeason: number): boolean {
  const teamDrivers = getTeamRaceDrivers(state, teamId);

  // Check if any driver has an accepted negotiation with another team
  for (const driver of teamDrivers) {
    const hasCommitted = state.negotiations.some(
      (n) =>
        n.stakeholderType === StakeholderType.Driver &&
        (n as DriverNegotiation).driverId === driver.id &&
        n.teamId !== teamId &&
        n.forSeason === forSeason &&
        n.phase === NegotiationPhase.Completed
    );
    if (hasCommitted) return true;
  }
  return false;
}

/**
 * Generate proactive outreach from drivers to teams
 * Called during daily processing
 *
 * Triggers:
 * 1. Contract expiring - driver shops around for better options
 * 2. Received offer - driver informs other interested teams
 * 3. Team vacancy - driver sees opportunity
 */
export function processDriverOutreach(state: GameState): boolean {
  const { currentDate, currentSeason } = state;
  const { month, day } = currentDate;
  const nextSeason = currentSeason.seasonNumber + 1;
  const gameYear = seasonToYear(currentSeason.seasonNumber);
  const playerTeamId = state.player.teamId;
  let playerReceivedOutreach = false;

  // Only process during the outreach window (July-December)
  if (month < DRIVER_OUTREACH_START_MONTH) return false;

  // Process bi-weekly (1st and 15th) to avoid daily spam
  if (day !== 1 && day !== 15) return false;

  const constructorStandings = getConstructorStandingsMap(state);

  // Find drivers with expiring contracts (contract ends this season)
  const driversWithExpiringContracts = state.drivers.filter(
    (d) => d.teamId && d.contractEnd === currentSeason.seasonNumber && d.role !== DriverRole.Test
  );

  for (const driver of driversWithExpiringContracts) {
    // Get teams this driver would approach
    // Drivers look at teams above their current team in standings
    const driverTeam = state.teams.find((t) => t.id === driver.teamId);
    if (!driverTeam) continue;

    const driverTeamPosition = constructorStandings.get(driverTeam.id) ?? state.teams.length;

    // Find teams above driver's current team
    const targetTeams = state.teams.filter((team) => {
      const teamPosition = constructorStandings.get(team.id) ?? state.teams.length;
      // Driver approaches teams ranked higher (lower position number)
      return teamPosition < driverTeamPosition && team.id !== driver.teamId;
    });

    // Also consider teams with vacancies regardless of position
    const teamsWithVacancies = state.teams.filter(
      (team) =>
        team.id !== driver.teamId &&
        (teamHasVacancy(state, team.id) ||
          teamDriverCommittedElsewhere(state, team.id, nextSeason))
    );

    // Combine and deduplicate
    const allTargetTeams = new Map(
      [...targetTeams, ...teamsWithVacancies].map((t) => [t.id, t])
    );

    for (const team of allTargetTeams.values()) {
      // Skip if recent outreach exists
      if (hasRecentDriverOutreach(state, team.id, driver.id, nextSeason)) continue;

      // Find team principal
      const principal = state.principals.find((p) => p.teamId === team.id);
      if (!principal) continue;

      // Get team's current drivers
      const currentDrivers = getTeamRaceDrivers(state, team.id);

      // Check if team has vacancy (driver committed elsewhere)
      const hasVacancy =
        teamHasVacancy(state, team.id) ||
        teamDriverCommittedElsewhere(state, team.id, nextSeason);

      // Evaluate if team is interested
      const evaluation = evaluateDriverApproach({
        approachingDriver: driver,
        team,
        teamPrincipal: principal,
        currentDrivers,
        constructorStandings,
        allTeams: state.teams,
        allDrivers: state.drivers,
        gameYear,
        hasVacancy,
        proposedDuration: DRIVER_DEFAULT_CONTRACT_YEARS,
      });

      // If team is interested, create negotiation
      if (evaluation.interested) {
        const terms = generateDefaultDriverTerms(driver.salary, driver.role);
        const negotiation = createDriverOutreach(
          team.id,
          driver.id,
          nextSeason,
          currentDate,
          terms
        );
        state.negotiations.push(negotiation);

        // Email for player team
        if (team.id === playerTeamId) {
          playerReceivedOutreach = true;
          const reasonText =
            evaluation.reason === 'upgrade'
              ? 'believes they could be an asset to your team'
              : evaluation.reason === 'vacancy'
                ? 'has noticed you may have a seat available'
                : 'is exploring their options for next season';

          state.calendarEvents.push({
            id: randomUUID(),
            date: currentDate,
            type: CalendarEventType.Email,
            subject: `${driver.firstName} ${driver.lastName} expresses interest in joining`,
            body: `${driver.firstName} ${driver.lastName} has reached out to your team. The driver ${reasonText} and would like to discuss a contract for the ${seasonToYear(nextSeason)} season.`,
            critical: true,
          });
        }
      }
    }
  }

  return playerReceivedOutreach;
}

// =============================================================================
// STAFF OUTREACH
// =============================================================================

/**
 * Check if staff has already approached this team
 */
function hasExistingStaffNegotiation(
  state: GameState,
  teamId: string,
  staffId: string,
  forSeason: number
): boolean {
  return state.negotiations.some(
    (n) =>
      n.stakeholderType === StakeholderType.Staff &&
      n.teamId === teamId &&
      (n as StaffNegotiation).staffId === staffId &&
      n.forSeason === forSeason
  );
}

/**
 * Generate proactive outreach from staff to teams
 * Called during daily processing
 *
 * Triggers:
 * 1. Free agents looking for work
 * 2. Staff at smaller teams seeking upgrades
 */
export function processStaffOutreach(state: GameState): boolean {
  const { currentDate, currentSeason } = state;
  const { month, day } = currentDate;
  const nextSeason = currentSeason.seasonNumber + 1;
  const playerTeamId = state.player.teamId;
  let playerReceivedOutreach = false;

  // Only process during the outreach window (May-June)
  if (month < STAFF_OUTREACH_START_MONTH || month > STAFF_OUTREACH_END_MONTH) return false;

  // Process bi-weekly (1st and 15th)
  if (day !== 1 && day !== 15) return false;

  // Find staff with expiring contracts or free agents
  const chiefsToProcess = state.chiefs.filter((c) => {
    // Free agents always look
    if (!c.teamId) return true;
    // Staff with expiring contracts
    return c.contractEnd === currentSeason.seasonNumber;
  });

  for (const chief of chiefsToProcess) {
    // Evaluate which teams this chief would approach
    for (const targetTeam of state.teams) {
      // Skip own team
      if (targetTeam.id === chief.teamId) continue;

      // Skip if negotiation already exists
      if (hasExistingStaffNegotiation(state, targetTeam.id, chief.id, nextSeason)) continue;

      // Check if chief would approach this team
      const approachResult = evaluateStaffApproach({
        approachingChief: chief,
        targetTeam,
        allTeams: state.teams,
        allChiefs: state.chiefs,
      });

      if (!approachResult.shouldApproach) continue;

      // Create outreach negotiation
      const roleName = getChiefRoleDisplayName(chief.role);
      const chiefName = `${chief.firstName} ${chief.lastName}`;

      const negotiation: StaffNegotiation = {
        id: `neg-staff-${chief.id}-${targetTeam.id}-${Date.now()}`,
        stakeholderType: StakeholderType.Staff,
        teamId: targetTeam.id,
        staffId: chief.id,
        role: chief.role,
        phase: NegotiationPhase.ResponseReceived, // Team needs to respond
        forSeason: nextSeason,
        startedDate: { ...currentDate },
        lastActivityDate: { ...currentDate },
        rounds: [
          {
            roundNumber: 1,
            offeredBy: 'counterparty', // Staff initiated
            terms: {
              salary: approachResult.proposedSalary,
              duration: approachResult.proposedDuration,
              signingBonus: 0,
              buyoutRequired: chief.teamId ? Math.round(chief.salary * STAFF_BUYOUT_SALARY_MULTIPLIER) : 0,
              bonusPercent: 10, // 10% performance bonus
            } as StaffContractTerms,
            offeredDate: { ...currentDate },
            expiresDate: offsetDate(currentDate, 30),
          },
        ],
        currentRound: 1,
        maxRounds: DEFAULT_MAX_ROUNDS,
        relationshipScoreBefore: DEFAULT_RELATIONSHIP_SCORE,
        hasCompetingOffer: false,
        isProactiveOutreach: true,
      };

      state.negotiations.push(negotiation);

      // Email for player team
      if (targetTeam.id === playerTeamId) {
        playerReceivedOutreach = true;
        state.calendarEvents.push({
          id: randomUUID(),
          date: currentDate,
          type: CalendarEventType.Email,
          subject: `${chiefName} interested in joining your team`,
          body: `${chiefName}, a ${roleName}${chief.teamId ? ` currently at ${state.teams.find((t) => t.id === chief.teamId)?.name ?? 'another team'}` : ''}, has expressed interest in joining ${targetTeam.name}. Review their proposal in the Contracts screen.`,
          critical: true,
        });
      }
    }
  }

  return playerReceivedOutreach;
}

// =============================================================================
// SPONSOR OUTREACH
// =============================================================================

/**
 * Check if a sponsor has already reached out to a team this season
 */
function hasExistingSponsorNegotiation(
  state: GameState,
  teamId: string,
  sponsorId: string,
  forSeason: number
): boolean {
  return state.negotiations.some(
    (n) =>
      n.stakeholderType === StakeholderType.Sponsor &&
      n.teamId === teamId &&
      (n as SponsorNegotiation).sponsorId === sponsorId &&
      n.forSeason === forSeason
  );
}

/**
 * Check if team has a sponsor from the same rival group
 */
function teamHasRivalSponsor(
  state: GameState,
  teamId: string,
  sponsorRivalGroup: string | null
): boolean {
  const teamDeals = state.sponsorDeals.filter((d) => d.teamId === teamId);
  return hasRivalGroupConflict(sponsorRivalGroup, teamDeals, state.sponsors);
}

/**
 * Get teams ranked by constructor standings
 */
function getTeamsByPosition(state: GameState): Array<{ team: Team; position: number }> {
  const standings = getConstructorStandingsMap(state);
  return state.teams
    .map((team) => ({
      team,
      position: standings.get(team.id) ?? state.teams.length,
    }))
    .sort((a, b) => a.position - b.position);
}

/**
 * Create a sponsor negotiation from proactive outreach
 */
function createSponsorOutreachNegotiation(
  state: GameState,
  sponsor: Sponsor,
  team: Team,
  forSeason: number
): SponsorNegotiation {
  return {
    id: randomUUID(),
    teamId: team.id,
    forSeason,
    stakeholderType: StakeholderType.Sponsor,
    phase: NegotiationPhase.ResponseReceived, // Sponsor initiated, awaiting player response
    startedDate: { ...state.currentDate },
    lastActivityDate: { ...state.currentDate },
    sponsorId: sponsor.id,
    rounds: [
      {
        roundNumber: 1,
        offeredBy: 'counterparty',
        terms: {
          signingBonus: sponsor.baseMonthlyPayment * 2, // 2 months as signing bonus
          monthlyPayment: sponsor.baseMonthlyPayment,
          duration: DEFAULT_SPONSOR_OUTREACH_DURATION,
          placement: getPlacementForTier(sponsor.tier),
          exitClausePosition: undefined,
        } as SponsorContractTerms,
        offeredDate: state.currentDate,
        expiresDate: offsetDate(state.currentDate, 14),
      },
    ],
    currentRound: 1,
    maxRounds: DEFAULT_MAX_ROUNDS,
    relationshipScoreBefore: DEFAULT_RELATIONSHIP_SCORE,
    hasCompetingOffer: false,
    isProactiveOutreach: true,
  };
}

/**
 * Process proactive outreach from sponsors to teams.
 * Triggers in April - sponsors approach eligible teams.
 */
export function processSponsorOutreach(state: GameState): boolean {
  const { currentDate, currentSeason } = state;
  const { month, day } = currentDate;
  const nextSeason = currentSeason.seasonNumber + 1;
  const playerTeamId = state.player.teamId;
  let playerReceivedOutreach = false;

  // Only trigger in April, on the 1st
  if (month !== SPONSOR_OUTREACH_MONTH || day !== 1) return false;

  // Get teams by position
  const teamsByPosition = getTeamsByPosition(state);

  // Process each sponsor
  for (const sponsor of state.sponsors) {
    // Skip sponsors that are already fully committed
    const existingDeals = state.sponsorDeals.filter(
      (d) => d.sponsorId === sponsor.id && d.endSeason >= nextSeason
    );
    if (existingDeals.length > 0) continue; // Sponsor already has active deal

    // Determine target teams based on tier
    let targetTeams: Team[] = [];

    if (sponsor.tier === SponsorTier.Title) {
      // Title sponsors approach top 3 teams
      targetTeams = teamsByPosition.slice(0, 3).map((t) => t.team);
    } else if (sponsor.tier === SponsorTier.Major) {
      // Major sponsors approach top 6 teams
      targetTeams = teamsByPosition.slice(0, 6).map((t) => t.team);
    } else {
      // Minor sponsors approach teams lacking minor sponsors
      targetTeams = state.teams.filter((team) => {
        const teamDeals = state.sponsorDeals.filter(
          (d) => d.teamId === team.id && d.endSeason >= currentSeason.seasonNumber
        );
        const minorDeals = teamDeals.filter((d) => {
          const s = state.sponsors.find((sp) => sp.id === d.sponsorId);
          return s?.tier === SponsorTier.Minor;
        });
        return minorDeals.length < 2; // Teams with fewer than 2 minor sponsors
      });
    }

    // Approach each target team
    for (const team of targetTeams) {
      // Skip if rival group conflict
      if (teamHasRivalSponsor(state, team.id, sponsor.rivalGroup)) continue;

      // Skip if already negotiating
      if (hasExistingSponsorNegotiation(state, team.id, sponsor.id, nextSeason)) continue;

      // Create negotiation
      const negotiation = createSponsorOutreachNegotiation(state, sponsor, team, nextSeason);
      state.negotiations.push(negotiation);

      // If player's team, send email
      if (team.id === playerTeamId) {
        playerReceivedOutreach = true;

        const tierName = getSponsorTierDisplayName(sponsor.tier);
        state.calendarEvents.push({
          id: randomUUID(),
          date: currentDate,
          type: CalendarEventType.Email,
          subject: `${sponsor.name} interested in ${tierName} deal`,
          body: `${sponsor.name} has approached your team about becoming a ${tierName}. They are offering $${((sponsor.baseMonthlyPayment * 12) / 1_000_000).toFixed(1)}M per season for a ${DEFAULT_SPONSOR_OUTREACH_DURATION}-year deal. Review the offer in your negotiations.`,
          critical: true,
        });
      }
    }
  }

  return playerReceivedOutreach;
}
