import { motion } from 'framer-motion';
import { TabId } from '@/app/types';

interface TabNavigationProps {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
  tabOrder: { id: TabId; label: string }[];
}

export function TabNavigation({ activeTab, setActiveTab, tabOrder }: TabNavigationProps) {
  return (
    <nav className="relative flex p-1.5 gap-2 backdrop-blur-xl bg-white/40 border border-gray-200/50 rounded-2xl mb-8 max-w-fit mx-auto mt-6 shadow-sm">
      {tabOrder.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors duration-300 rounded-xl
              ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 bg-white shadow-md rounded-xl z-0"
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
