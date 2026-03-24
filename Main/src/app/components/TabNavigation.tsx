import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { TabId } from '@/app/types';

interface TabNavigationProps {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
  tabOrder: { id: TabId; label: string; children?: { id: TabId; label: string }[] }[];
}

export function TabNavigation({ activeTab, setActiveTab, tabOrder }: TabNavigationProps) {
  const [openMenuId, setOpenMenuId] = useState<TabId | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

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
      className="relative z-[60] flex flex-wrap items-center p-1.5 gap-2 backdrop-blur-xl bg-[var(--nav-bg)] border border-[var(--line)] rounded-2xl mb-8 max-w-fit mx-auto mt-6 shadow-sm transition-colors duration-300"
    >
      {tabOrder.map((tab) => {
        const isActive = activeTab === tab.id || activeParentId === tab.id;
        const hasChildren = Boolean(tab.children && tab.children.length > 0);
        return (
          <div key={tab.id} className="relative">
            <button
              onClick={() => {
                if (hasChildren) {
                  setOpenMenuId((current) => (current === tab.id ? null : tab.id));
                  return;
                }
                setOpenMenuId(null);
                setActiveTab(tab.id);
              }}
              className={`
                relative inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 rounded-xl outline-none
                ${isActive ? 'text-[var(--tab-active-text)]' : 'text-[var(--tab-inactive-text)] hover:opacity-80'}
              `}
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

            {hasChildren && openMenuId === tab.id && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-[70] min-w-[220px] rounded-xl border border-[var(--line)] bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
                {tab.children!.map((child) => {
                  const childActive = activeTab === child.id;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(child.id);
                        setOpenMenuId(null);
                      }}
                      className={`mb-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors last:mb-0 ${
                        childActive
                          ? 'border-slate-300 bg-slate-100 text-slate-950'
                          : 'border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{child.label}</span>
                      {childActive && <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Open</span>}
                    </button>
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
