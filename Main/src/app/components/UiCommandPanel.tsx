import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, 
  Type,
  Zap,
  Eye
} from "lucide-react";
import { THEME_PRESETS, ThemeId } from "../config/themeConfig";

interface UiCommandPanelProps {
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const transition = { type: "spring", stiffness: 300, damping: 30 };

export function UiCommandPanel({ currentTheme, onThemeChange, isOpen, onOpenChange }: UiCommandPanelProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: isOpen ? 260 : 64 }}
      transition={transition}
      className="fixed left-0 top-0 bottom-0 z-[100] bg-white border-r border-gray-200 flex flex-col shadow-2xl overflow-hidden select-none"
    >
      {/* Header / Toggle */}
      <div className="flex items-center px-4 min-h-[64px] border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
        <button 
          onClick={() => onOpenChange(!isOpen)}
          className="flex items-center gap-3 hover:opacity-80 active:scale-95 transition-opacity outline-none"
        >
          <div className="p-2 bg-gray-900 rounded-lg shadow-lg flex-shrink-0">
            <Settings className="h-4 w-4 text-blue-400" />
          </div>
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="text-xs font-black text-gray-900 uppercase tracking-widest whitespace-nowrap">Aesthetic Forge</div>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Internal Content (Fixed Width to prevent wrapping) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 w-[260px]">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-8"
            >
              {/* Profile Selection */}
              <div className="space-y-4">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Tactical Profiles</div>
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
                        className="h-10 w-10 rounded-lg shadow-inner border border-gray-200/50 flex-shrink-0 flex flex-col p-1 gap-0.5" 
                        style={{ background: THEME_PRESETS[themeId].bg }}
                      >
                        <div className="h-2 w-full rounded-sm" style={{ background: THEME_PRESETS[themeId].accent }} />
                        <div className="flex-1 flex gap-0.5">
                          <div className="flex-1 rounded-sm" style={{ background: THEME_PRESETS[themeId].tabActiveBg }} />
                          <div className="flex-1 rounded-sm border border-gray-200/20" style={{ background: THEME_PRESETS[themeId].panel }} />
                        </div>
                      </div>
                      <div className="text-left overflow-hidden">
                        <div className={`text-xs font-black uppercase tracking-tight ${currentTheme === themeId ? 'text-white' : 'text-gray-900'}`}>
                          {themeId.split('-').join(' ')}
                        </div>
                        <div className={`text-[10px] font-bold truncate ${currentTheme === themeId ? 'text-gray-400' : 'text-gray-500'}`}>
                          {THEME_PRESETS[themeId].fontFamily.split(',')[0].replace(/"/g, '')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Placeholder Controls */}
              <div className="space-y-4">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Tactical Overlays</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100 opacity-60">
                    <div className="h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">Focus Mode</div>
                  </div>
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-100 opacity-60">
                    <div className="h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center">
                      <Eye className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">High Contrast</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="p-6 border-t border-gray-100 bg-gray-50/30 min-h-[64px] w-[260px] flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap"
              >
                System Live
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
