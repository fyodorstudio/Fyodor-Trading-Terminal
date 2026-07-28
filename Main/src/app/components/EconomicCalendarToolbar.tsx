import { type Ref } from "react";
import { Calendar, Check, ChevronDown, Clock, Globe, Search } from "lucide-react";
import {
  CalendarClockCard,
  FreshnessChip,
  HelpHint,
  ImpactSummary,
} from "@/app/components/EconomicCalendarControls";
import { ImpactPill } from "@/app/components/EconomicCalendarInspector";
import { FlagIcon } from "@/app/components/FlagIcon";
import {
  getCalendarFreshness,
  summarizeCountries,
} from "@/app/lib/calendarDisplay";
import {
  formatCountdown,
  parseDateInput,
  toDateInputValue,
} from "@/app/lib/format";
import { getCountryDisplayName } from "@/app/config/currencyConfig";
import type { CalendarEvent, ImpactLevel } from "@/app/types";
import type { DisplayTimezoneSelection, DisplayTimezoneOption } from "@/app/lib/timezoneDisplay";

export type CalendarRangeMode = "today" | "this_week" | "next_week" | "custom";

interface EconomicCalendarToolbarProps {
  preset: CalendarRangeMode;
  rangeLabel: string;
  visibleEventCountLabel: string;
  status: string;
  statusLabel: string;
  statusHelpText: string;
  viewFreshness: ReturnType<typeof getCalendarFreshness>;
  brokerFreshness: ReturnType<typeof getCalendarFreshness>;
  draftFrom: Date | null;
  draftTo: Date | null;
  impacts: ImpactLevel[];
  allImpacts: ImpactLevel[];
  countries: string[];
  availableCountries: string[];
  search: string;
  mt5TimeLabel: string;
  mt5ServerTime: number | null;
  currentViewerTime: string;
  timezoneMode: DisplayTimezoneSelection;
  timezoneOptions: DisplayTimezoneOption[];
  nextVisibleEvent: CalendarEvent | null;
  uiNow: number;
  isRangePopoverOpen: boolean;
  isImpactMenuOpen: boolean;
  isCountryMenuOpen: boolean;
  isTimezoneMenuOpen: boolean;
  rangePopoverRef: Ref<HTMLDivElement>;
  impactMenuRef: Ref<HTMLDivElement>;
  countryMenuRef: Ref<HTMLDivElement>;
  timezoneMenuRef: Ref<HTMLDivElement>;
  customStartInputRef: Ref<HTMLInputElement>;
  onSelectToday: () => void;
  onSelectThisWeek: () => void;
  onSelectNextWeek: () => void;
  onOpenRangePopover: () => void;
  onDraftFromChange: (value: Date | null) => void;
  onDraftToChange: (value: Date | null) => void;
  onApplyCustomRange: () => void;
  onToggleImpactMenu: () => void;
  onToggleImpact: (impact: ImpactLevel) => void;
  onToggleCountryMenu: () => void;
  onClearCountries: () => void;
  onToggleCountry: (country: string) => void;
  onSearchChange: (value: string) => void;
  onToggleTimezoneMenu: () => void;
  onTimezoneChange: (timezone: DisplayTimezoneSelection) => void;
}

export function EconomicCalendarToolbar({
  preset,
  rangeLabel,
  visibleEventCountLabel,
  status,
  statusLabel,
  statusHelpText,
  viewFreshness,
  brokerFreshness,
  draftFrom,
  draftTo,
  impacts,
  allImpacts,
  countries,
  availableCountries,
  search,
  mt5TimeLabel,
  mt5ServerTime,
  currentViewerTime,
  timezoneMode,
  timezoneOptions,
  nextVisibleEvent,
  uiNow,
  isRangePopoverOpen,
  isImpactMenuOpen,
  isCountryMenuOpen,
  isTimezoneMenuOpen,
  rangePopoverRef,
  impactMenuRef,
  countryMenuRef,
  timezoneMenuRef,
  customStartInputRef,
  onSelectToday,
  onSelectThisWeek,
  onSelectNextWeek,
  onOpenRangePopover,
  onDraftFromChange,
  onDraftToChange,
  onApplyCustomRange,
  onToggleImpactMenu,
  onToggleImpact,
  onToggleCountryMenu,
  onClearCountries,
  onToggleCountry,
  onSearchChange,
  onToggleTimezoneMenu,
  onTimezoneChange,
}: EconomicCalendarToolbarProps) {
  return (
    <>
      <div className="calendar-operational-rail">
        <div className="calendar-rail-title">
          <div className="calendar-rail-heading">
            <h2>Economic Calendar</h2>
            <div className={`calendar-feed-status calendar-feed-status-${status}`}>
              <span className="calendar-feed-dot" aria-hidden="true" />
              <HelpHint label={statusLabel} detail={statusHelpText} />
            </div>
          </div>
          <p>{visibleEventCountLabel} in current view</p>
        </div>

        <div className="calendar-rail-freshness">
          <FreshnessChip
            label="View refreshed"
            detail="When this tab last asked the local bridge for calendar rows and received a response. If this is fresh but Broker feed is stale, the app is working but MT5/broker data may be old."
            freshness={viewFreshness}
          />
          <FreshnessChip
            label="Broker feed"
            detail="When the bridge last ingested economic-calendar rows from MT5/broker. This is the main freshness check for whether the calendar data itself is stale."
            freshness={brokerFreshness}
          />
        </div>
      </div>

      <div className="calendar-tv-shell">
        <div className="calendar-tv-toolbar">
          <div className="calendar-tv-left">
            <button
              type="button"
              className={preset === "today" ? "tv-toolbar-button is-active" : "tv-toolbar-button"}
              onClick={onSelectToday}
            >
              Today
            </button>

            <button
              type="button"
              className={preset === "this_week" ? "tv-toolbar-button is-active" : "tv-toolbar-button"}
              onClick={onSelectThisWeek}
            >
              This Week
            </button>

            <button
              type="button"
              className={preset === "next_week" ? "tv-toolbar-button is-active" : "tv-toolbar-button"}
              onClick={onSelectNextWeek}
            >
              Next Week
            </button>

            <div className="tv-toolbar-anchor" ref={rangePopoverRef}>
              <button
                type="button"
                className={preset === "custom" ? "tv-toolbar-button is-active" : "tv-toolbar-button"}
                onClick={onOpenRangePopover}
              >
                <Calendar size={16} />
                <span>{rangeLabel}</span>
                <ChevronDown size={15} />
              </button>

              {isRangePopoverOpen && (
                <div className="tv-popover tv-range-popover">
                  <div className="tv-popover-head">
                    <strong>Custom range</strong>
                    <span>MT5/UTC ordering stays unchanged.</span>
                  </div>
                  <div className="tv-date-grid">
                    <label className="tv-field">
                      <span>Start</span>
                      <input
                        ref={customStartInputRef}
                        type="date"
                        value={toDateInputValue(draftFrom)}
                        onChange={(event) => onDraftFromChange(parseDateInput(event.target.value))}
                      />
                    </label>
                    <label className="tv-field">
                      <span>End</span>
                      <input
                        type="date"
                        value={toDateInputValue(draftTo)}
                        onChange={(event) => onDraftToChange(parseDateInput(event.target.value))}
                      />
                    </label>
                  </div>
                  <div className="tv-popover-actions">
                    <button type="button" className="tv-text-button" onClick={onSelectToday}>
                      Back to today
                    </button>
                    <button type="button" className="tv-solid-button" onClick={onApplyCustomRange}>
                      Apply range
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="calendar-tv-right">
            <div className="tv-toolbar-anchor" ref={impactMenuRef}>
              <button type="button" className="tv-toolbar-button" onClick={onToggleImpactMenu}>
                <ImpactSummary impacts={impacts} />
                <ChevronDown size={15} />
              </button>

              {isImpactMenuOpen && (
                <div className="tv-popover tv-filter-popover">
                  <div className="tv-popover-head">
                    <strong>Impact</strong>
                    <span>Broker importance label. This only filters visible rows.</span>
                  </div>
                  {allImpacts.map((impact) => {
                    const selected = impacts.includes(impact);
                    return (
                      <button
                        key={impact}
                        type="button"
                        className={selected ? "tv-option-row is-selected" : "tv-option-row"}
                        onClick={() => onToggleImpact(impact)}
                      >
                        <span className="tv-option-main">
                          <ImpactPill level={impact} />
                        </span>
                        {selected && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="tv-toolbar-anchor" ref={countryMenuRef}>
              <button type="button" className="tv-toolbar-button" onClick={onToggleCountryMenu}>
                <Globe size={16} />
                <span className="calendar-control-text">
                  <span>Countries</span>
                  <strong>{summarizeCountries(countries)}</strong>
                </span>
                <ChevronDown size={15} />
              </button>

              {isCountryMenuOpen && (
                <div className="tv-popover tv-filter-popover">
                  <div className="tv-popover-head">
                    <strong>Countries</strong>
                    <span>Countries found in the loaded MT5 calendar range. This only filters the current table.</span>
                  </div>
                  <button type="button" className="tv-option-row" onClick={onClearCountries}>
                    <span className="tv-option-main">
                      <Globe size={15} />
                      <span className="tv-option-label">All countries</span>
                    </span>
                    {countries.length === 0 && <Check size={15} />}
                  </button>
                  {availableCountries.map((country) => {
                    const selected = countries.includes(country);
                    return (
                      <button
                        key={country}
                        type="button"
                        className={selected ? "tv-option-row is-selected" : "tv-option-row"}
                        onClick={() => onToggleCountry(country)}
                      >
                        <span className="tv-option-main">
                          <FlagIcon countryCode={country} className="h-4 w-6 border border-gray-200 rounded-sm" />
                          <span className="tv-option-label">{getCountryDisplayName(country)}</span>
                        </span>
                        {selected && <Check size={15} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="calendar-tv-subbar">
          <label className="calendar-search calendar-search-compact">
            <Search size={15} />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search title, currency, or country"
            />
          </label>

          <div className="calendar-tv-meta">
            <CalendarClockCard
              label="MT5"
              value={mt5TimeLabel.replace(" (MT5)", "")}
              detail="The current MT5/server clock estimate from the local bridge. Use it to check whether broker time is moving and whether timing delay comes from MT5/bridge instead of this screen."
              offline={mt5ServerTime == null}
            />
            <div className="tv-toolbar-anchor" ref={timezoneMenuRef}>
              <div className="calendar-clock-card calendar-clock-select-card">
                <span className="calendar-clock-icon">
                  <Clock size={16} />
                </span>
                <span className="calendar-control-text">
                  <span>
                    <HelpHint
                      label="Viewer"
                      detail="The same event times converted into your selected viewing timezone. Change this when you want rows to match your local clock or another trading session clock."
                    />
                  </span>
                  <strong>{currentViewerTime}</strong>
                </span>
                <button
                  type="button"
                  className="calendar-card-menu-button"
                  aria-label="Change viewer timezone"
                  onClick={onToggleTimezoneMenu}
                >
                  <ChevronDown size={15} />
                </button>
              </div>

              {isTimezoneMenuOpen && (
                <div className="tv-popover tv-filter-popover">
                  <div className="tv-popover-head">
                    <strong>Viewer timezone</strong>
                    <span>Only changes how this tab displays event times. MT5 remains the broker audit clock.</span>
                  </div>
                  <div className="tv-timezone-list">
                    {timezoneOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={timezoneMode === option.id ? "tv-option-row is-selected" : "tv-option-row"}
                        onClick={() => onTimezoneChange(option.id)}
                      >
                        <span className="tv-option-main">
                          <Clock size={15} />
                          <span className="tv-option-label">
                            {option.label}
                            {option.isHighlighted ? <span className="tv-option-badge">Local</span> : null}
                          </span>
                        </span>
                        {timezoneMode === option.id && <Check size={15} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <CalendarClockCard
              label="Next event"
              value={nextVisibleEvent ? formatCountdown(nextVisibleEvent.time, uiNow) : "N/A"}
              detail="Countdown to the next future event currently visible after your range, impact, country, and search filters."
              icon={<Calendar size={16} />}
              subValue={nextVisibleEvent ? `${nextVisibleEvent.currency} ${nextVisibleEvent.title}` : "No future row"}
            />
          </div>
        </div>
      </div>
    </>
  );
}
