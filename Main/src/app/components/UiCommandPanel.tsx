import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Layers, 
  Zap, 
  Monitor, 
  Smartphone,
  Eye,
  Type
} from "lucide-react";
import { THEME_PRESETS, ThemeId } from "../config/themeConfig";

interface UiCommandPanelProps {
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
}

export function UiCommandPanel({ currentTheme, onThemeChange }: UiCommandPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 260 : 64 }}
      className="fixed left-0 top-0 bottom-0 z-[100] bg-white border-r border-gray-200 flex flex-col shadow-2xl overflow-hidden"
    >
      {/* Header / Toggle */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gray-900 rounded-lg shadow-lg flex-shrink-0">
            <Settings className="h-4 w-4 text-blue-400" />
          </div>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <div className="text-xs font-black text-gray-900 uppercase tracking-widest whitespace-nowrap">Aesthetic Forge</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 hover:bg-gray-200 rounded-md transition-colors"
        >
          {isOpen ? <ChevronLeft className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-8">
        {/* Profile Selection */}
        <div className="space-y-4">
          {isOpen && (
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Tactical Profiles</div>
          )}
          <div className="space-y-2">
            {(Object.keys(THEME_PRESETS) as ThemeId[]).map((themeId) => (
              <button
                key={themeId}
                onClick={() => onThemeChange(themeId)}
                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all border group
                  ${currentTheme === themeId 
                    ? 'bg-gray-900 border-gray-800 shadow-lg scale-[1.02]' 
                    : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-gray-50'}
                `}
              >
                <div 
                  className="h-8 w-8 rounded-lg shadow-inner border border-gray-200/50 flex-shrink-0" 
                  style={{ background: THEME_PRESETS[themeId].bg }}
                >
                  <div className="h-full w-full flex items-center justify-center">
                    <Type className={`h-4 w-4 ${currentTheme === themeId ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                </div>
                {isOpen && (
                  <div className="text-left overflow-hidden">
                    <div className={`text-xs font-black uppercase tracking-tight ${currentTheme === themeId ? 'text-white' : 'text-gray-900'}`}>
                      {themeId.split('-').join(' ')}
                    </div>
                    <div className={`text-[10px] font-bold truncate ${currentTheme === themeId ? 'text-gray-400' : 'text-gray-500'}`}>
                      {THEME_PRESETS[themeId].fontFamily.split(',')[0].replace(/"/g, '')}
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Global Overlays */}
        <div className="space-y-4">
          {isOpen && (
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Tactical Overlays</div>
          )}
          <div className="space-y-2">
            <button className="w-full flex items-center gap-4 p-3 rounded-xl bg-white border border-gray-100 hover:border-blue-200 hover:bg-gray-50 transition-all opacity-50 cursor-not-allowed group">
              <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Zap className="h-4 w-4 text-gray-400" />
              </div>
              {isOpen && <div className="text-xs font-bold text-gray-400 uppercase tracking-tight">Focus Mode (Soon)</div>}
            </button>
            <button className="w-full flex items-center gap-4 p-3 rounded-xl bg-white border border-gray-100 hover:border-blue-200 hover:bg-gray-50 transition-all opacity-50 cursor-not-allowed group">
              <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Eye className="h-4 w-4 text-gray-400" />
              </div>
              {isOpen && <div className="text-xs font-bold text-gray-400 uppercase tracking-tight">High Contrast (Soon)</div>}
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-6 border-t border-gray-100 bg-gray-50/30">
        <div className="flex items-center gap-4">
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          {isOpen && <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">System Live</div>}
        </div>
      </div>
    </motion.aside>
  );
}
