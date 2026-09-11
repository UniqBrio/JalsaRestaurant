'use client';
/**
 * DashboardShell - the frame every dashboard shares: header, filter slot, metric grid, sections.
 *
 * THE TEN-SECOND RULE DRIVES THE ORDER
 *   Title, then the metrics, then what needs attention, then the evidence, then the exact rows.
 *   A business owner who reads only the top of the screen should already know whether today is
 *   fine. Anything that pushes the numbers below the fold - a filter panel expanded by default,
 *   a hero banner, a chart above the tiles - costs every visit, forever.
 *
 * SECTIONS ARE SLOTS, NOT OPINIONS
 *   The shell lays out and titles; the host renders what belongs in each section. That is what
 *   keeps this business-agnostic: a restaurant and an academy differ entirely in content and not
 *   at all in frame.
 *
 * THE HEADER ACTIONS ARE OPTIONAL AND ABSENT UNLESS PASSED
 *   Refresh, export and customize appear only when a handler exists. A disabled toolbar of
 *   things the app has not built yet teaches users that buttons here do nothing.
 */
import React from 'react';
import type { DashboardConfig, DashboardSection } from '../../lib/analytics/dashboard';

export function DashboardShell({
  config,
  filterBar,
  renderSection,
  onRefresh,
  onExport,
  onCustomize,
  updatedAt,
  testId = 'dashboard',
}: {
  /** Already resolved for the current role (see resolveDashboard). */
  config: DashboardConfig;
  /** The date range and filters - normally a ListControls-driven bar. */
  filterBar?: React.ReactNode;
  renderSection: (section: DashboardSection) => React.ReactNode;
  onRefresh?: () => void;
  onExport?: () => void;
  onCustomize?: () => void;
  /** When the figures were last read - a dashboard with no timestamp is a dashboard you cannot trust. */
  updatedAt?: string;
  testId?: string;
}) {
  return (
    <div className="dash" data-testid={testId}>
      <header className="dash__header">
        <div className="dash__titles">
          <h1 className="dash__title">{config.title}</h1>
          {config.subtitle && <p className="dash__subtitle">{config.subtitle}</p>}
        </div>
        <div className="dash__actions">
          {updatedAt && <span className="dash__updated" data-testid={`${testId}-updated`}>Updated {updatedAt}</span>}
          {onRefresh && (
            <button type="button" className="dash__action" data-testid={`${testId}-refresh`} onClick={onRefresh}>
              Refresh
            </button>
          )}
          {onExport && (
            <button type="button" className="dash__action" data-testid={`${testId}-export`} onClick={onExport}>
              Export
            </button>
          )}
          {onCustomize && (
            <button type="button" className="dash__action" data-testid={`${testId}-customize`} onClick={onCustomize}>
              Customise
            </button>
          )}
        </div>
      </header>

      {filterBar && <div className="dash__filters">{filterBar}</div>}

      {config.sections.map((section) => (
        <section
          key={section.id}
          className={`dash__section dash__section--${section.kind}`}
          aria-labelledby={section.title ? `${testId}-${section.id}-title` : undefined}
          data-testid={`${testId}-section-${section.id}`}
        >
          {section.title && (
            <h2 className="dash__section-title" id={`${testId}-${section.id}-title`}>{section.title}</h2>
          )}
          {/* The question is the section's justification. Rendered as a caption so the reader
              knows what they are meant to learn here - and so a section that answers nothing is
              visibly missing one. */}
          {section.question && <p className="dash__section-question">{section.question}</p>}
          <div className={section.kind === 'metrics' ? 'dash__metrics' : 'dash__body'}>
            {renderSection(section)}
          </div>
        </section>
      ))}
    </div>
  );
}
