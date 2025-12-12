/**
 * AppointmentNewsModal - Full-screen modal for team appointment news
 *
 * Displayed when the player starts a new game or joins a new team.
 * FM-style layout with headline, article body, and driver cards.
 */

import { Newspaper, ArrowRight } from 'lucide-react';
import type { AppointmentNews, AppointmentDriverSummary } from '../../shared/domain';
import { formatCurrency } from '../utils/format';
import { seasonToYear, yearToSeason } from '../../shared/utils/date-utils';
import { PRIMARY_BUTTON_CLASSES } from '../utils/theme-styles';

interface AppointmentNewsModalProps {
  news: AppointmentNews;
  onContinue: () => void;
}

interface DriverCardProps {
  driver: AppointmentDriverSummary;
  seasonNumber: number;
  lastSeasonYear: number;
}

/**
 * Renders a single driver card with photo, stats, and contract info
 */
function DriverCard({ driver, seasonNumber, lastSeasonYear }: DriverCardProps) {
  const contractEndYear = seasonToYear(driver.contractEnd);
  const contractYears = driver.contractEnd - seasonNumber;
  // contractYears: 0 = final year, 1 = 2 years left (this + next), etc.
  const contractText = contractYears <= 0
    ? 'Final year'
    : `${contractYears + 1} years`;

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--neutral-850)] border border-[var(--neutral-700)]">
      {/* Driver photo */}
      <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--neutral-700)] flex-shrink-0">
        {driver.photoUrl ? (
          <img
            src={driver.photoUrl}
            alt={`${driver.firstName} ${driver.lastName}`}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xl font-bold">
            {driver.firstName[0]}{driver.lastName[0]}
          </div>
        )}
      </div>

      {/* Driver info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {driver.raceNumber && (
            <span className="text-xs font-bold text-muted">#{driver.raceNumber}</span>
          )}
          <span className="font-semibold text-primary truncate">
            {driver.firstName} {driver.lastName}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {driver.lastSeasonPosition !== undefined && (
            <span className="text-secondary">
              <span className="text-muted">{lastSeasonYear}:</span>{' '}
              <span className="text-primary font-medium">P{driver.lastSeasonPosition}</span>
              {driver.lastSeasonPoints !== undefined && (
                <span className="text-muted"> ({driver.lastSeasonPoints} pts)</span>
              )}
            </span>
          )}
          <span className="text-secondary">
            <span className="text-muted">Rating:</span>{' '}
            <span className="text-primary font-medium">{driver.reputation}</span>
          </span>
        </div>

        {/* Contract row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
          <span className="text-secondary">
            <span className="text-muted">Contract:</span>{' '}
            <span className="text-primary">{contractText}</span>
            <span className="text-muted"> (until {contractEndYear})</span>
          </span>
          <span className="text-secondary">
            <span className="text-muted">Salary:</span>{' '}
            <span className="text-primary">{formatCurrency(driver.salary)}/yr</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Main appointment news modal component
 */
export function AppointmentNewsModal({ news, onContinue }: AppointmentNewsModalProps) {
  const seasonNumber = yearToSeason(news.year);
  const lastSeasonYear = news.year - 1;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header - News icon and date */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="p-2 rounded-lg"
            style={{
              backgroundColor: `${news.teamPrimaryColor}20`,
              border: `1px solid ${news.teamPrimaryColor}40`,
            }}
          >
            <Newspaper size={20} style={{ color: news.teamPrimaryColor }} />
          </div>
          <div>
            <span className="text-xs text-muted uppercase tracking-wider">Breaking News</span>
            <p className="text-sm text-secondary">1 January {news.year}</p>
          </div>
        </div>

        {/* Main article card */}
        <div
          className="card p-6 mb-4"
          style={{
            borderColor: `${news.teamPrimaryColor}30`,
            boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 40px ${news.teamPrimaryColor}15`,
          }}
        >
          {/* Headline */}
          <h1
            className="text-2xl font-bold mb-6"
            style={{ color: news.teamPrimaryColor }}
          >
            {news.headline}
          </h1>

          {/* Article body */}
          <div className="space-y-4 text-secondary leading-relaxed">
            {news.articleBody.split('\n\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        {/* Bottom banner - Team & Drivers */}
        <div
          className="card p-6"
          style={{
            background: `linear-gradient(145deg, ${news.teamPrimaryColor}15 0%, transparent 100%)`,
            borderColor: `${news.teamPrimaryColor}30`,
          }}
        >
          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">Your Driver Lineup</h2>
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: `${news.teamPrimaryColor}30`,
                color: news.teamPrimaryColor,
              }}
            >
              {news.teamShortName}
            </span>
          </div>

          {/* Driver cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {news.drivers.map((driver) => (
              <DriverCard
                key={driver.driverId || 'tba'}
                driver={driver}
                seasonNumber={seasonNumber}
                lastSeasonYear={lastSeasonYear}
              />
            ))}
          </div>

          {/* Continue button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onContinue}
              className={PRIMARY_BUTTON_CLASSES}
              style={{
                backgroundColor: news.teamPrimaryColor,
                borderColor: news.teamPrimaryColor,
              }}
            >
              <span>Begin Season</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
