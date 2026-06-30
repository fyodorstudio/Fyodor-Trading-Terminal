import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { TabId } from '@/app/types';

interface TabNavigationProps {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
  tabOrder: { id: TabId; label: string; children?: { id: TabId; label: string; groupLabel?: string }[] }[];
  placement?: "page" | "header";
}

const TAB_HELP_TEXT: Partial<Record<TabId, string>> = {
  overview: "What matters right now?",
  charts: "What is price doing right now?",
  calendar: "What events are scheduled and when?",
  "central-banks": "What is the policy and inflation backdrop?",
  dashboard: "Event replay first; older drafts and prototypes stay available for reference.",
};

export function TabNavigation({ activeTab, setActiveTab, tabOrder, placement = "page" }: TabNavigationProps) {
  const [openMenuId, setOpenMenuId] = useState<TabId | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const isHeader = placement === "header";

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!navRef.current?.contains(target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const activeParentId = useMemo(() => {
    const parent = tabOrder.find((tab) => tab.children?.some((child) => child.id === activeTab));
    return parent?.id ?? null;
  }, [activeTab, tabOrder]);

  return (
    <nav
      ref={navRef}
      className={`relative flex items-center backdrop-blur-xl bg-[var(--nav-bg)] border border-[var(--line)] shadow-sm transition-colors duration-300 ${
        isHeader
          ? "z-[930] max-w-full flex-nowrap gap-0.5 rounded-xl p-0.5"
          : "z-[60] mx-auto mb-8 mt-6 max-w-fit flex-wrap gap-2 rounded-2xl p-1.5"
      }`}
    >
      {tabOrder.map((tab) => {
        const isActive = activeTab === tab.id || activeParentId === tab.id;
        const hasChildren = Boolean(tab.children && tab.children.length > 0);
        const helpText = TAB_HELP_TEXT[tab.id];
        return (
          <div
            key={tab.id}
            className="relative tab-help-anchor"
            data-menu-open={hasChildren && openMenuId === tab.id ? "true" : "false"}
          >
            <button
              type="button"
              onClick={() => {
                if (hasChildren) {
                  setOpenMenuId((current) => (current === tab.id ? null : tab.id));
                  return;
                }
                setOpenMenuId(null);
                setActiveTab(tab.id);
              }}
              className={`
                relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl font-black uppercase transition-all duration-300 outline-none
                ${isHeader ? "px-2.5 py-1.5 text-[11px] tracking-[0.11em]" : "px-5 py-2.5 text-xs tracking-widest"}
                ${isActive ? 'text-[var(--tab-active-text)]' : 'text-[var(--tab-inactive-text)] hover:opacity-80'}
              `}
              aria-describedby={helpText ? `tab-help-${tab.id}` : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-[var(--tab-active-bg)] shadow-md rounded-xl z-0"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
              {hasChildren && (
                <ChevronDown
                  size={14}
                  className={`relative z-10 transition-transform duration-150 ${openMenuId === tab.id ? 'rotate-180' : ''}`}
                />
              )}
            </button>

            {helpText && (
              <div
                id={`tab-help-${tab.id}`}
                role="tooltip"
                className="tab-help-popover"
              >
                {helpText}
              </div>
            )}

            {hasChildren && openMenuId === tab.id && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-[950] min-w-[220px] rounded-xl border border-[var(--line)] bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                {tab.children!.map((child, index) => {
                  const childActive = activeTab === child.id;
                  const previous = tab.children![index - 1];
                  const showGroupLabel = child.groupLabel && child.groupLabel !== previous?.groupLabel;
                  return (
                    <div key={child.id} className={index > 0 ? "mt-2" : ""}>
                      {showGroupLabel && (
                        <div className="px-2 pb-1 pt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {child.groupLabel}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab(child.id);
                          setOpenMenuId(null);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                          childActive
                            ? 'border-slate-300 bg-slate-100 text-slate-950'
                            : 'border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{child.label}</span>
                        {childActive && <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Open</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
