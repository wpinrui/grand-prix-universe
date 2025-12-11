/**
 * Design Processor Module
 *
 * Handles design updates, chassis progress, technology projects, and testing updates.
 */

import { randomUUID } from 'crypto';
import type {
  GameState,
  GameDate,
  CalendarEvent,
  Chief,
} from '../../shared/domain';
import type {
  DesignUpdate,
  TestingUpdate,
} from '../../shared/domain/engines';
import {
  CalendarEventType,
  EmailCategory,
  TechnologyAttribute,
  ChiefRole,
  CHASSIS_STAGE_ORDER,
  CHASSIS_STAGE_DISPLAY_NAMES,
  TECH_COMPONENT_DISPLAY_NAMES,
  TECH_ATTRIBUTE_SHORT_NAMES,
  TECH_ATTRIBUTE_DISPLAY_NAMES,
  HANDLING_PROBLEM_DISPLAY_NAMES,
  TYPICAL_WORK_UNITS_PER_DAY,
  getProjectedMilestones,
} from '../../shared/domain';
import {
  PendingPartSource,
  type EmailData,
  type ChassisStageCompleteData,
  type TechBreakthroughData,
  type TechDevelopmentCompleteData,
  type HandlingSolutionCompleteData,
  type TestCompleteData,
  type PendingPart,
} from '../../shared/domain/types';
import { offsetDate } from '../../shared/utils/date-utils';

/** Days to build a part after design completes */
const PART_BUILD_TIME_DAYS = 7;

/**
 * Check if a design update has any milestones (events that should be shown on calendar)
 */
export function hasMilestones(update: DesignUpdate): boolean {
  return (
    update.breakthroughs.length > 0 ||
    update.completions.length > 0 ||
    update.chassisStageCompletions.length > 0
  );
}

/**
 * Create an email calendar event for design notifications
 */
export function createDesignEmail(
  date: GameDate,
  subject: string,
  body: string,
  sender: string,
  senderId: string | undefined,
  emailCategory: EmailCategory,
  critical: boolean,
  data?: EmailData
): CalendarEvent {
  return {
    id: randomUUID(),
    date,
    type: CalendarEventType.Email,
    subject,
    critical,
    emailCategory,
    sender,
    senderId,
    body,
    data,
  };
}

/**
 * Format a chief's name with their role for email sender
 */
export function formatChiefSender(chief: Chief | null): string {
  if (!chief) return 'Design Department';
  return `${chief.firstName} ${chief.lastName} (Chief Designer)`;
}

/**
 * Create a news headline for design events from AI teams
 */
export function createDesignNewsHeadline(
  date: GameDate,
  subject: string,
  body: string
): CalendarEvent {
  return {
    id: randomUUID(),
    date,
    type: CalendarEventType.Headline,
    subject,
    body,
    critical: false,
  };
}

/**
 * Generate news headlines for a team's design milestones
 */
export function generateDesignNewsForTeam(
  state: GameState,
  update: DesignUpdate,
  currentDate: GameDate,
  teamName: string
): void {
  // Chassis stage completions
  for (const completion of update.chassisStageCompletions) {
    const stageName = CHASSIS_STAGE_DISPLAY_NAMES[completion.stage];
    const subject = `${teamName} complete ${stageName} stage`;
    const body = `${teamName} have completed the ${stageName} stage of their next year's chassis development. ` +
      `The team continues to make progress on their car design for the upcoming season.`;
    state.calendarEvents.push(createDesignNewsHeadline(currentDate, subject, body));
  }

  // Technology breakthroughs
  for (const breakthrough of update.breakthroughs) {
    const techName = TECH_COMPONENT_DISPLAY_NAMES[breakthrough.component];
    const attrShortName = TECH_ATTRIBUTE_SHORT_NAMES[breakthrough.attribute];
    const subject = `${teamName} achieve ${techName} breakthrough`;
    const body = `${teamName} have made a breakthrough in ${techName} ${attrShortName}. ` +
      `The team's engineering department is now working to implement this improvement into their car.`;
    state.calendarEvents.push(createDesignNewsHeadline(currentDate, subject, body));
  }

  // Technology completions
  for (const completion of update.completions) {
    if (completion.type === 'technology') {
      const techName = TECH_COMPONENT_DISPLAY_NAMES[completion.component];
      const attrShortName = TECH_ATTRIBUTE_SHORT_NAMES[completion.attribute];
      const subject = `${teamName} upgrade ${techName}`;
      const body = `${teamName} have completed development of an upgraded ${techName} component. ` +
        `The improvement to ${attrShortName} is now available for use in their cars.`;
      state.calendarEvents.push(createDesignNewsHeadline(currentDate, subject, body));
    } else {
      // Handling solution completion
      const problemName = HANDLING_PROBLEM_DISPLAY_NAMES[completion.problem];
      const subject = `${teamName} resolve handling issue`;
      const body = `${teamName} have successfully addressed the ${problemName} handling problem with their current chassis. ` +
        `Drivers should notice improved performance in affected conditions.`;
      state.calendarEvents.push(createDesignNewsHeadline(currentDate, subject, body));
    }
  }
}

/**
 * Apply design updates to game state and create calendar events for milestones
 * Returns true if player team had any milestones (for auto-stop)
 */
export function applyDesignUpdates(
  state: GameState,
  updates: DesignUpdate[],
  currentDate: GameDate
): boolean {
  let playerHadMilestone = false;
  const playerTeamId = state.player.teamId;

  for (const update of updates) {
    // Update the team's design state
    const teamState = state.teamStates[update.teamId];
    if (teamState) {
      teamState.designState = update.updatedDesignState;
    }

    // Check if this is the player's team and has milestones
    const isPlayerTeam = update.teamId === playerTeamId;
    if (isPlayerTeam && hasMilestones(update)) {
      playerHadMilestone = true;
    }

    // For non-player teams: generate news headlines if they have milestones, then skip
    if (!isPlayerTeam) {
      if (hasMilestones(update)) {
        const team = state.teams.find((t) => t.id === update.teamId);
        if (team) {
          generateDesignNewsForTeam(state, update, currentDate, team.name);
        }
      }
      continue;
    }

    // Get the Chief Designer for sender
    const chiefDesigner = state.chiefs.find(
      (c) => c.teamId === update.teamId && c.role === ChiefRole.Designer
    ) ?? null;
    const sender = formatChiefSender(chiefDesigner);

    // Chassis stage completions
    for (const completion of update.chassisStageCompletions) {
      const stageName = CHASSIS_STAGE_DISPLAY_NAMES[completion.stage];
      const stageIndex = CHASSIS_STAGE_ORDER.indexOf(completion.stage);
      const chassisYear = update.updatedDesignState.nextYearChassis?.targetSeason ?? 0;
      const body = `The ${stageName} stage of next year's chassis design is now complete. ` +
        `The new efficiency rating is ${completion.newEfficiencyRating.toFixed(1)}. ` +
        `We can now proceed to the next phase of development.`;
      const data: ChassisStageCompleteData = {
        category: EmailCategory.ChassisStageComplete,
        chassisYear,
        completedStageIndex: stageIndex,
        stageName,
        efficiency: completion.newEfficiencyRating,
        chiefId: chiefDesigner?.id,
      };
      state.calendarEvents.push(
        createDesignEmail(
          currentDate,
          `${stageName} stage complete`,
          body,
          sender,
          chiefDesigner?.id,
          EmailCategory.ChassisStageComplete,
          true,
          data
        )
      );
    }

    // Technology breakthroughs
    for (const breakthrough of update.breakthroughs) {
      const techName = TECH_COMPONENT_DISPLAY_NAMES[breakthrough.component];
      const attrShortName = TECH_ATTRIBUTE_SHORT_NAMES[breakthrough.attribute];
      const attrFullName = TECH_ATTRIBUTE_DISPLAY_NAMES[breakthrough.attribute];
      const subject = `${techName} ${attrShortName} breakthrough (+${breakthrough.statIncrease})`;
      const body = `Excellent news! Our research into ${techName} ${attrShortName} has yielded a breakthrough. ` +
        `We've discovered an improvement worth +${breakthrough.statIncrease} points. ` +
        `The development team is now working to implement this into a production-ready component.`;
      const estimatedDays = Math.ceil(breakthrough.workUnitsRequired / TYPICAL_WORK_UNITS_PER_DAY);
      const data: TechBreakthroughData = {
        category: EmailCategory.TechBreakthrough,
        component: breakthrough.component,
        attribute: breakthrough.attribute,
        componentName: techName,
        attributeName: attrFullName,
        statIncrease: breakthrough.statIncrease,
        estimatedDays,
        chiefId: chiefDesigner?.id,
      };
      state.calendarEvents.push(
        createDesignEmail(
          currentDate,
          subject,
          body,
          sender,
          chiefDesigner?.id,
          EmailCategory.TechBreakthrough,
          true,
          data
        )
      );
    }

    // Technology completions
    for (const completion of update.completions) {
      if (completion.type === 'technology') {
        const techName = TECH_COMPONENT_DISPLAY_NAMES[completion.component];
        const attrShortName = TECH_ATTRIBUTE_SHORT_NAMES[completion.attribute];
        const attrFullName = TECH_ATTRIBUTE_DISPLAY_NAMES[completion.attribute];
        const subject = `${techName} ${attrShortName} development complete`;
        const body = `The ${techName} ${attrShortName} development project is now complete. ` +
          `Our ${attrShortName} rating has improved by +${completion.statIncrease} points. ` +
          `The part is now being built and will be ready for installation in ${PART_BUILD_TIME_DAYS} days.`;
        // Get the new value from updated technology levels
        const techLevel = update.updatedDesignState.technologyLevels.find(
          (t) => t.component === completion.component
        );
        const newValue = completion.attribute === TechnologyAttribute.Performance
          ? techLevel?.performance ?? 0
          : techLevel?.reliability ?? 0;
        const data: TechDevelopmentCompleteData = {
          category: EmailCategory.TechDevelopmentComplete,
          component: completion.component,
          attribute: completion.attribute,
          componentName: techName,
          attributeName: attrFullName,
          statIncrease: completion.statIncrease,
          newValue,
          chiefId: chiefDesigner?.id,
        };
        state.calendarEvents.push(
          createDesignEmail(
            currentDate,
            subject,
            body,
            sender,
            chiefDesigner?.id,
            EmailCategory.TechDevelopmentComplete,
            true,
            data
          )
        );

        // Create pending part for player team
        if (isPlayerTeam) {
          const itemName = `${techName} ${attrShortName} +${completion.statIncrease}`;
          const pendingPart: PendingPart = {
            id: randomUUID(),
            source: PendingPartSource.Technology,
            item: itemName,
            payoff: completion.statIncrease,
            baseCost: 50000, // TODO: Calculate based on component/improvement
            buildStartDate: currentDate,
            readyDate: offsetDate(currentDate, PART_BUILD_TIME_DAYS),
            installedOnCars: [],
            component: completion.component,
            attribute: completion.attribute,
          };
          teamState.pendingParts.push(pendingPart);
        }
      } else {
        // Handling solution completion
        const problemName = HANDLING_PROBLEM_DISPLAY_NAMES[completion.problem];
        const subject = `Handling solution complete: ${problemName}`;
        const body = `We have successfully resolved the ${problemName} handling issue. ` +
          `The chassis handling has improved by +${completion.statIncrease} points. ` +
          `The part is now being built and will be ready for installation in ${PART_BUILD_TIME_DAYS} days.`;
        const data: HandlingSolutionCompleteData = {
          category: EmailCategory.HandlingSolutionComplete,
          problem: completion.problem,
          problemName,
          handlingImprovement: completion.statIncrease,
          chiefId: chiefDesigner?.id,
        };
        state.calendarEvents.push(
          createDesignEmail(
            currentDate,
            subject,
            body,
            sender,
            chiefDesigner?.id,
            EmailCategory.HandlingSolutionComplete,
            true,
            data
          )
        );

        // Create pending part for player team
        if (isPlayerTeam) {
          const itemName = `${problemName} Fix`;
          const pendingPart: PendingPart = {
            id: randomUUID(),
            source: PendingPartSource.HandlingSolution,
            item: itemName,
            payoff: completion.statIncrease,
            baseCost: 75000, // TODO: Calculate based on problem
            buildStartDate: currentDate,
            readyDate: offsetDate(currentDate, PART_BUILD_TIME_DAYS),
            installedOnCars: [],
            handlingProblem: completion.problem,
          };
          teamState.pendingParts.push(pendingPart);
        }
      }
    }
  }

  return playerHadMilestone;
}

/**
 * Apply testing updates to game state and create emails for completions
 * Returns true if player team had a test completion (for potential auto-stop)
 */
export function applyTestingUpdates(
  state: GameState,
  updates: TestingUpdate[],
  currentDate: GameDate
): boolean {
  let playerHadCompletion = false;
  const playerTeamId = state.player.teamId;

  for (const update of updates) {
    const teamState = state.teamStates[update.teamId];
    if (!teamState) continue;

    // Update the team's test session
    teamState.testSession = update.updatedTestSession;

    // Handle test completion
    if (update.completion) {
      const isPlayerTeam = update.teamId === playerTeamId;

      if (isPlayerTeam) {
        playerHadCompletion = true;

        // Update testsCompleted count (already in updatedTestSession)
        // But we need to apply handling/problem discovery to currentYearChassis

        if (update.completion.handlingRevealed !== null) {
          // First test: reveal handling percentage
          teamState.designState.currentYearChassis.handlingRevealed =
            update.completion.handlingRevealed;
        }

        if (update.completion.problemDiscovered !== null) {
          // Subsequent test: mark problem as discovered
          const problemState = teamState.designState.currentYearChassis.problems.find(
            (p) => p.problem === update.completion!.problemDiscovered
          );
          if (problemState) {
            problemState.discovered = true;
          }
        }

        // Generate test completion email for player
        const chiefMechanic = state.chiefs.find(
          (c) => c.teamId === update.teamId && c.role === ChiefRole.Mechanic
        ) ?? null;
        const sender = formatChiefSender(chiefMechanic);

        let subject: string;
        let body: string;

        if (update.completion.handlingRevealed !== null) {
          // First test - handling revealed
          subject = `Development Test Complete - Handling: ${update.completion.handlingRevealed}%`;
          body = `Our first development test has concluded. We've measured the chassis handling at ${update.completion.handlingRevealed}%. ` +
            `Run additional tests to discover specific handling problems that can be solved to improve performance.`;
        } else if (update.completion.problemDiscovered !== null) {
          // Subsequent test - problem discovered
          const problemName = HANDLING_PROBLEM_DISPLAY_NAMES[update.completion.problemDiscovered];
          subject = `Development Test Complete - Problem Discovered: ${problemName}`;
          body = `Our development test has identified a handling issue: ${problemName}. ` +
            `This problem can now be assigned to the Design department for a solution to be developed.`;
        } else {
          // No more problems to discover
          subject = 'Development Test Complete - No New Problems Found';
          body = 'Our development test has concluded. All handling problems have already been discovered. ' +
            'Focus on solving the known problems in the Design department.';
        }

        const problemName = update.completion.problemDiscovered
          ? HANDLING_PROBLEM_DISPLAY_NAMES[update.completion.problemDiscovered]
          : null;

        const data: TestCompleteData = {
          category: EmailCategory.TestComplete,
          testsCompleted: update.completion.testsCompleted,
          handlingRevealed: update.completion.handlingRevealed,
          problemDiscovered: update.completion.problemDiscovered,
          problemName,
          chiefMechanicId: chiefMechanic?.id,
        };

        state.calendarEvents.push({
          id: randomUUID(),
          date: currentDate,
          type: CalendarEventType.Email,
          subject,
          body,
          sender,
          critical: true,
          data,
        });
      }
    }
  }

  return playerHadCompletion;
}

/**
 * Update projected milestone events on the calendar
 * Clears old projections and adds new ones based on current allocations
 */
export function updateProjectedMilestones(state: GameState): void {
  // Remove old projection events
  state.calendarEvents = state.calendarEvents.filter(
    (e) => e.type !== CalendarEventType.Projection
  );

  // Get player team data
  const playerTeamId = state.player.teamId;
  const playerTeam = state.teams.find((t) => t.id === playerTeamId);
  const playerTeamState = state.teamStates[playerTeamId];
  if (!playerTeam || !playerTeamState) return;

  const chiefDesigner = state.chiefs.find(
    (c) => c.teamId === playerTeamId && c.role === ChiefRole.Designer
  ) ?? null;

  // Compute projected milestones
  const projections = getProjectedMilestones(
    playerTeamState.designState,
    {
      staffCounts: playerTeamState.staffCounts.design,
      facilities: playerTeam.factory.facilities,
      chiefDesigner,
    },
    state.currentDate
  );

  // Add projection events to calendar
  for (const projection of projections) {
    state.calendarEvents.push({
      id: randomUUID(),
      date: projection.estimatedDate,
      type: CalendarEventType.Projection,
      subject: projection.description,
      critical: false,
    });
  }
}
