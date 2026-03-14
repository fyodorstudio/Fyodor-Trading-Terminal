import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, 
  Type,
  Palette,
  Check,
  ChevronDown
} from "lucide-react";
import { FONT_OPTIONS, COLOR_PALETTES, FontId, ColorPaletteId } from "../config/themeConfig";

interface UiCommandPanelProps {
  currentFont: FontId;
  currentColor: ColorPaletteId;
  onFontChange: (id: FontId) => void;
  onColorChange: (id: ColorPaletteId) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const transition = { type: "spring", stiffness: 300, damping: 30 };

export function UiCommandPanel({ 
  currentFont, 
  currentColor, 
  onFontChange, 
  onColorChange, 
  isOpen, 
  onOpenChange 
}: UiCommandPanelProps) {
  const [isFontSelectOpen, setIsFontSelectOpen] = useState(false);
  const selectedFont = FONT_OPTIONS.find(f => f.id === currentFont) || FONT_OPTIONS[0];

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
          onClick={() => {
            onOpenChange(!isOpen);
            if (isOpen) setIsFontSelectOpen(false);
          }}
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 w-[260px]">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
              className="space-y-10"
            >
              {/* TYPOGRAPHY SECTION */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Type className="h-3 w-3 text-gray-400" />
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Typography Forge</div>
                </div>
                
                <div className="relative">
                  <button
                    onClick={() => setIsFontSelectOpen(!isFontSelectOpen)}
                    className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all shadow-sm"
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Active Font</span>
                      <span className="text-sm font-bold text-gray-900" style={{ fontFamily: selectedFont.family }}>{selectedFont.label}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isFontSelectOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isFontSelectOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto p-1 space-y-1"
                      >
                        {FONT_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              onFontChange(option.id);
                              setIsFontSelectOpen(false);
                            }}
                            style={{ fontFamily: option.family }}
                            className={`
                              w-full flex items-center justify-between p-2.5 rounded-lg transition-all
                              ${currentFont === option.id 
                                ? 'bg-blue-50 text-blue-700' 
                                : 'hover:bg-gray-50 text-gray-600'}
                            `}
                          >
                            <div className="flex flex-col text-left">
                              <span className="text-sm font-bold">{option.label}</span>
                              <span className="text-[9px] uppercase tracking-tighter opacity-60 font-black">{option.category}</span>
                            </div>
                            {currentFont === option.id && <Check className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* COLOR SYSTEMS SECTION */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Palette className="h-3 w-3 text-gray-400" />
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Color Systems</div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {COLOR_PALETTES.map((palette) => (
                    <button
                      key={palette.id}
                      onClick={() => onColorChange(palette.id)}
                      className={`
                        w-full flex items-center gap-4 p-3 rounded-xl transition-all border group
                        ${currentColor === palette.id 
                          ? 'bg-gray-900 border-gray-800 text-white shadow-lg' 
                          : 'bg-white border-gray-100 hover:border-gray-300 text-gray-600'}
                      `}
                    >
                      <div 
                        className="h-6 w-6 rounded-full shadow-inner border border-white/20 flex-shrink-0" 
                        style={{ background: palette.colors.accent }}
                      />
                      <div className="text-left">
                        <div className="text-xs font-black uppercase tracking-tight">{palette.label}</div>
                      </div>
                      {currentColor === palette.id && <Check className="h-3.5 w-3.5 text-blue-400 ml-auto" />}
                    </button>
                  ))}
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
