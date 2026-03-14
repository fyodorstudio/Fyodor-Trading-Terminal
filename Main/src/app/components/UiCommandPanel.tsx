import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, 
  Type,
  Palette,
  Check,
  LayoutGrid,
  ArrowRight,
  X
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
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const selectedFont = FONT_OPTIONS.find(f => f.id === currentFont) || FONT_OPTIONS[0];

  return (
    <div className="relative">
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
              if (isOpen) setIsGalleryOpen(false);
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
                  
                  <button
                    onClick={() => setIsGalleryOpen(true)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl hover:border-blue-300 hover:bg-white transition-all group shadow-sm"
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Open Gallery</span>
                      <span className="text-sm font-black text-gray-900" style={{ fontFamily: selectedFont.family }}>{selectedFont.label}</span>
                    </div>
                    <LayoutGrid className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </button>
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

      {/* OPTION B: TYPE GALLERY POPOVER */}
      <AnimatePresence>
        {isGalleryOpen && isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGalleryOpen(false)}
              className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-[150]"
            />
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={transition}
              className="fixed left-[270px] top-4 bottom-4 w-[480px] bg-white border border-gray-200 rounded-[32px] shadow-2xl z-[200] flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Typography Gallery</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Visual Character Selection</p>
                </div>
                <button 
                  onClick={() => setIsGalleryOpen(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {['Sans', 'Mono', 'Display'].map((cat) => {
                  const fonts = FONT_OPTIONS.filter(f => f.category === cat);
                  if (fonts.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-4">
                      <div className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] px-2">{cat} Squadron</div>
                      <div className="grid grid-cols-1 gap-3">
                        {fonts.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => {
                              onFontChange(f.id);
                              setIsGalleryOpen(false);
                            }}
                            className={`
                              w-full text-left p-5 rounded-2xl border-2 transition-all group
                              ${currentFont === f.id 
                                ? 'border-blue-500 bg-blue-50/30' 
                                : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}
                            `}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{f.label}</span>
                              {currentFont === f.id && <Check className="h-4 w-4 text-blue-500" />}
                            </div>
                            <div 
                              className="text-2xl text-gray-900 tracking-tight" 
                              style={{ fontFamily: f.family }}
                            >
                              EUR/USD 1.0845
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="p-6 bg-gray-50 border-t border-gray-100">
                <div className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest">
                  {FONT_OPTIONS.length} Tactical Families Ready
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
