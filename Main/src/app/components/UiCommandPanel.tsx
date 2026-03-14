import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, 
  Type,
  Palette,
  Check,
  Zap,
  Eye
} from "lucide-react";
import { FONT_OPTIONS, COLOR_PALETTES, FontId, ColorPaletteId, FontOption } from "../config/themeConfig";

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
  const [hoveredFont, setHoveredFont] = useState<FontOption | null>(null);
  const [isForging, setIsForging] = useState(false);

  return (
    <div className="relative">
      {/* BACKDROP ISOLATION (Triggered by Forge state) */}
      <AnimatePresence>
        {(isForging || hoveredFont) && isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/10 backdrop-blur-md z-[150] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: isOpen ? 260 : 64 }}
        transition={transition}
        onMouseEnter={() => setIsForging(true)}
        onMouseLeave={() => {
          setIsForging(false);
          setHoveredFont(null);
        }}
        className="fixed left-0 top-0 bottom-0 z-[200] bg-white border-r border-gray-200 flex flex-col shadow-2xl overflow-hidden select-none"
      >
        {/* Header / Toggle (Fixed Gear) */}
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
                {/* HYBRID: TYPOGRAPHY TILES */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Type className="h-3 w-3 text-gray-400" />
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Typography Forge</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => onFontChange(option.id)}
                        onMouseEnter={() => setHoveredFont(option)}
                        onMouseLeave={() => setHoveredFont(null)}
                        className={`
                          relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all group
                          ${currentFont === option.id 
                            ? 'bg-gray-900 border-gray-800 text-white shadow-lg scale-[1.02]' 
                            : 'bg-white border-gray-100 hover:border-blue-200 hover:scale-[1.05]'}
                        `}
                      >
                        <div 
                          className={`text-xl mb-1 ${currentFont === option.id ? 'text-white' : 'text-gray-900 group-hover:text-blue-600'}`}
                          style={{ fontFamily: option.family }}
                        >
                          Aa
                        </div>
                        <div className={`text-[9px] font-black uppercase tracking-tighter ${currentFont === option.id ? 'text-gray-400' : 'text-gray-500'}`}>
                          {option.id}
                        </div>
                        {currentFont === option.id && (
                          <div className="absolute top-1 right-1">
                            <Check className="h-3 w-3 text-blue-400" />
                          </div>
                        )}
                      </button>
                    ))}
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

      {/* HYBRID: FLOATING PREVIEW POPOVER (From Option B) */}
      <AnimatePresence>
        {hoveredFont && isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed left-[270px] top-1/2 -translate-y-1/2 w-[340px] bg-white border border-gray-200 rounded-3xl shadow-2xl z-[300] p-6 pointer-events-none"
          >
            <div className="mb-4">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">{hoveredFont.category} Squadron</span>
              <h4 className="text-xl font-black text-gray-900 tracking-tight">{hoveredFont.label}</h4>
            </div>
            
            <div className="space-y-4">
              <div 
                className="text-3xl text-gray-900 tracking-tighter leading-tight" 
                style={{ fontFamily: hoveredFont.family }}
              >
                EUR/USD 1.0845
              </div>
              <div 
                className="text-sm text-gray-500 leading-relaxed italic" 
                style={{ fontFamily: hoveredFont.family }}
              >
                "The quick brown fox jumps over the lazy dog."
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Numbers</span>
                  <span className="text-lg font-bold text-gray-900" style={{ fontFamily: hoveredFont.family }}>0123456789</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Weight Test</span>
                  <span className="text-lg font-black text-gray-900" style={{ fontFamily: hoveredFont.family }}>BOLD</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
