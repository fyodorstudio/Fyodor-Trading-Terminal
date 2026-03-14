import { motion } from 'framer-motion';
import { TabId } from '@/app/types';

interface TabNavigationProps {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
  tabOrder: { id: TabId; label: string }[];
}

export function TabNavigation({ activeTab, setActiveTab, tabOrder }: TabNavigationProps) {
  return (
    <nav className="relative flex p-1.5 gap-2 backdrop-blur-xl bg-[var(--nav-bg)] border border-[var(--line)] rounded-2xl mb-8 max-w-fit mx-auto mt-6 shadow-sm transition-colors duration-300">
      {tabOrder.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 rounded-xl outline-none
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
          </button>
        );
      })}
    </nav>
  );
}
