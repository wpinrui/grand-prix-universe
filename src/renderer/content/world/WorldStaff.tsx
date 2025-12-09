/**
 * World Staff page - view any staff member's profile (chiefs and principals)
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useDerivedGameState } from '../../hooks';
import {
  PersonHeader,
  AttributeBar,
  StatPanel,
  StatRow,
  ContractPanel,
  TabBar,
  getContractRelationship,
} from '../../components';
import type { Chief, ChiefRole } from '../../../shared/domain';
import { FREE_AGENT_COLORS } from '../../utils/face-generator';

// ===========================================
// TYPES
// ===========================================

type StaffFilterType = 'all' | 'principal' | ChiefRole;

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: StaffFilterType;
  ability: number;
  teamId: string | null;
  salary: number;
  contractEnd: number;
  nationality?: string; // Only principals have this
}

const STAFF_FILTER_TABS: { id: StaffFilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'principal', label: 'Principals' },
  { id: 'designer', label: 'Designers' },
  { id: 'engineer', label: 'Engineers' },
  { id: 'mechanic', label: 'Mechanics' },
  { id: 'commercial', label: 'Commercial' },
];

const ROLE_DISPLAY_NAMES: Record<StaffFilterType, string> = {
  all: 'Staff',
  principal: 'Team Principal',
  designer: 'Chief Designer',
  engineer: 'Chief Engineer',
  mechanic: 'Chief Mechanic',
  commercial: 'Commercial Director',
};

// ===========================================
// COMPONENT
// ===========================================

interface WorldStaffProps {
  initialStaffId?: string | null;
}

export function WorldStaff({ initialStaffId }: WorldStaffProps) {
  const { gameState, playerTeam } = useDerivedGameState();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(initialStaffId ?? null);
  const [activeFilter, setActiveFilter] = useState<StaffFilterType>('all');
  const lastAppliedInitialRef = useRef<string | null>(initialStaffId ?? null);

  // Update selection when navigating with a NEW initialStaffId
  useEffect(() => {
    if (initialStaffId && initialStaffId !== lastAppliedInitialRef.current) {
      lastAppliedInitialRef.current = initialStaffId;
      setSelectedStaffId(initialStaffId);
    }
  }, [initialStaffId]);

  // Build unified staff list
  const { allStaff, teamMap } = useMemo(() => {
    if (!gameState) {
      return { allStaff: [], teamMap: new Map() };
    }

    const teams = new Map(gameState.teams.map((t) => [t.id, t]));

    // Convert chiefs to StaffMember
    // TODO: Add principals when they're added to gameState
    const chiefsAsStaff: StaffMember[] = gameState.chiefs.map((c: Chief) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      role: c.role,
      ability: c.ability,
      teamId: c.teamId,
      salary: c.salary,
      contractEnd: c.contractEnd,
      // Chiefs don't have nationality
    }));

    // Sort by ability descending
    const sorted = chiefsAsStaff.sort((a, b) => b.ability - a.ability);

    return { allStaff: sorted, teamMap: teams };
  }, [gameState]);

  // Filter staff by active tab
  const filteredStaff = useMemo(() => {
    if (activeFilter === 'all') return allStaff;
    return allStaff.filter((s) => s.role === activeFilter);
  }, [allStaff, activeFilter]);

  // When filter changes, select first matching staff if current selection doesn't match
  useEffect(() => {
    if (filteredStaff.length === 0) {
      setSelectedStaffId(null);
      return;
    }
    const currentInFilter = filteredStaff.find((s) => s.id === selectedStaffId);
    if (!currentInFilter) {
      setSelectedStaffId(filteredStaff[0].id);
    }
  }, [filteredStaff, selectedStaffId]);

  // Loading state
  if (!gameState || !playerTeam) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-secondary">Loading staff...</p>
      </div>
    );
  }

  // Find selected staff member
  const selectedStaff = allStaff.find((s) => s.id === selectedStaffId);

  // Build dropdown options
  const dropdownOptions = filteredStaff.map((s) => ({
    id: s.id,
    label: `${s.firstName} ${s.lastName}`,
  }));

  // Get team info for selected staff
  const staffTeam = selectedStaff?.teamId ? teamMap.get(selectedStaff.teamId) ?? null : null;
  const teamColors = staffTeam
    ? { primary: staffTeam.primaryColor, secondary: staffTeam.secondaryColor }
    : FREE_AGENT_COLORS;

  // Handle contract talks (placeholder)
  const handleEnterContractTalks = () => {
    console.log('Enter contract talks with:', selectedStaff?.id);
  };

  return (
    <div className="max-w-6xl space-y-6">
      {/* Filter tabs */}
      <TabBar
        tabs={STAFF_FILTER_TABS}
        activeTab={activeFilter}
        onTabChange={setActiveFilter}
      />

      {/* Empty state */}
      {!selectedStaff ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-secondary">No staff found in this category</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header with dropdown */}
          <PersonHeader
            name={`${selectedStaff.firstName} ${selectedStaff.lastName}`}
            nationality={selectedStaff.nationality ?? 'UN'}
            photoUrl={null}
            teamName={staffTeam?.name ?? null}
            teamId={staffTeam?.id}
            roleText={ROLE_DISPLAY_NAMES[selectedStaff.role]}
            personId={selectedStaff.id}
            teamColors={teamColors}
            allOptions={dropdownOptions}
            selectedId={selectedStaff.id}
            onSelect={setSelectedStaffId}
          />

          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Ability Panel */}
            <StatPanel title="Ability">
              <AttributeBar label="Overall" value={selectedStaff.ability} />
            </StatPanel>

            {/* Status Panel */}
            <StatPanel title="Status">
              <StatRow
                label="Employment"
                value={staffTeam ? staffTeam.name : 'Available'}
              />
              <StatRow label="Role" value={ROLE_DISPLAY_NAMES[selectedStaff.role]} />
            </StatPanel>

            {/* Contract Panel */}
            <ContractPanel
              salary={selectedStaff.salary}
              contractEndSeason={selectedStaff.contractEnd}
              currentSeason={gameState.currentSeason.seasonNumber}
              relationship={getContractRelationship(selectedStaff.teamId, playerTeam.id)}
              onEnterTalks={handleEnterContractTalks}
            />
          </div>
        </div>
      )}
    </div>
  );
}
