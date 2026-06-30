import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import {
  Check,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Type,
  X,
} from "lucide-react";
import { COLOR_PALETTES, FONT_OPTIONS, type ColorPaletteId, type FontId, type FontOption } from "@/app/config/themeConfig";

interface UiCommandPanelProps {
  currentFont: FontId;
  currentColor: ColorPaletteId;
  onFontChange: (id: FontId) => void;
  onColorChange: (id: ColorPaletteId) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  showClosedTrigger?: boolean;
}

const transition: Transition = { type: "spring", stiffness: 300, damping: 30 };

export function UiCommandPanel({
  currentFont,
  currentColor,
  onFontChange,
  onColorChange,
  isOpen,
  onOpenChange,
  showClosedTrigger = true,
}: UiCommandPanelProps) {
  const [pendingFont, setPendingFont] = useState<FontId>(currentFont);
  const [pendingColor, setPendingColor] = useState<ColorPaletteId>(currentColor);
  const [hoveredFont, setHoveredFont] = useState<FontOption | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPendingFont(currentFont);
    setPendingColor(currentColor);
  }, [isOpen, currentFont, currentColor]);

  const hasChanges = pendingFont !== currentFont || pendingColor !== currentColor;

  const handleApply = () => {
    onFontChange(pendingFont);
    onColorChange(pendingColor);
  };

  const handleReset = () => {
    setPendingFont(currentFont);
    setPendingColor(currentColor);
  };

  return (
    <>
      <AnimatePresence>
        {showClosedTrigger && !isOpen && (
          <motion.button
            type="button"
            initial={{ opacity: 0, x: -10, y: -6 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -10, y: -6 }}
            transition={{ duration: 0.16 }}
            onClick={() => onOpenChange(true)}
            className="fixed left-4 top-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-2xl border border-white/25 bg-slate-950/75 text-white shadow-xl shadow-slate-950/20 backdrop-blur-xl transition hover:bg-slate-950/90 active:scale-95"
            aria-label="Open Aesthetic Forge"
            title="Open Aesthetic Forge"
          >
            <Settings className="h-4 w-4 text-blue-300" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isPreviewing || hoveredFont) && isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[800] bg-white/10 backdrop-blur-xl pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ opacity: 0, x: -28, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -28, scale: 0.98 }}
            transition={transition}
            onMouseEnter={() => setIsPreviewing(true)}
            onMouseLeave={() => {
              setIsPreviewing(false);
              setHoveredFont(null);
            }}
            className="fixed bottom-4 left-4 top-4 z-[1000] flex w-[340px] select-none flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-2xl shadow-slate-950/20 backdrop-blur-xl"
          >
            <div className="flex min-h-[64px] flex-shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 outline-none transition-opacity hover:opacity-80 active:scale-95"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900 shadow-lg">
                  <Settings className="h-4 w-4 text-blue-400" />
                </div>
                <div className="overflow-hidden text-left">
                  <div className="text-xs font-black uppercase tracking-widest text-gray-900 whitespace-nowrap">Aesthetic Forge</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">BETA</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 active:scale-95"
                aria-label="Close Aesthetic Forge"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="w-[340px] flex-1 overflow-y-auto overflow-x-hidden p-5">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-10 pb-20"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Type className="h-3.5 w-3.5 text-gray-400" />
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">Typography Forge</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {FONT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPendingFont(option.id)}
                        onMouseEnter={() => setHoveredFont(option)}
                        onMouseLeave={() => setHoveredFont(null)}
                        className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all group ${
                          pendingFont === option.id
                            ? "scale-[1.02] border-gray-800 bg-gray-900 text-white shadow-lg"
                            : "border-gray-100 bg-white hover:scale-[1.05] hover:border-blue-200"
                        }`}
                      >
                        <div
                          className={`mb-1 text-2xl ${
                            pendingFont === option.id ? "text-white" : "text-gray-900 group-hover:text-blue-600"
                          }`}
                          style={{ fontFamily: option.family }}
                        >
                          Aa
                        </div>
                        <div className={`text-[8px] font-black uppercase tracking-tighter ${pendingFont === option.id ? "text-gray-400" : "text-gray-500"}`}>
                          {option.id}
                        </div>
                        {pendingFont === option.id ? (
                          <div className="absolute right-1.5 top-1.5">
                            <Check className="h-3 w-3 text-blue-400" />
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Palette className="h-3.5 w-3.5 text-gray-400" />
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">Color Systems</div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {COLOR_PALETTES.map((palette) => (
                      <button
                        key={palette.id}
                        type="button"
                        onClick={() => setPendingColor(palette.id)}
                        className={`flex w-full items-center gap-4 rounded-xl border p-4 transition-all group ${
                          pendingColor === palette.id
                            ? "border-gray-800 bg-gray-900 text-white shadow-lg"
                            : "border-gray-100 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className="h-7 w-7 flex-shrink-0 rounded-full border border-white/20 shadow-inner"
                          style={{ background: palette.colors.accent }}
                        />
                        <div className="text-left">
                          <div className="text-xs font-black uppercase tracking-tight">{palette.label}</div>
                        </div>
                        {pendingColor === palette.id ? <Check className="ml-auto h-4 w-4 text-blue-400" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="relative w-[340px] flex-shrink-0">
              <AnimatePresence>
                {hasChanges && (
                  <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    exit={{ y: 100 }}
                    className="absolute bottom-0 left-0 right-0 flex gap-3 border-t border-gray-100 bg-white p-5 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]"
                  >
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 p-3.5 text-gray-500 transition-all hover:bg-gray-50 active:scale-95"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span className="text-xs font-black uppercase tracking-widest">Reset</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleApply}
                      className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-blue-600 p-3.5 text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95"
                    >
                      <Save className="h-4 w-4" />
                      <span className="text-xs font-black uppercase tracking-widest">Apply</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="min-h-[64px] border-t border-gray-100 bg-gray-50/50 p-6">
                <div className="flex items-center gap-4">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                  <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 whitespace-nowrap">
                    System Live
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hoveredFont && isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed left-[372px] top-1/2 z-[1100] w-[380px] -translate-y-1/2 rounded-[32px] border border-gray-200 bg-white p-8 shadow-2xl pointer-events-none"
          >
            <div className="mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">{hoveredFont.category} Squadron</span>
              <h4 className="text-xl font-black tracking-tight text-gray-900">{hoveredFont.label}</h4>
            </div>

            <div className="space-y-4">
              <div className="text-3xl leading-tight tracking-tighter text-gray-900" style={{ fontFamily: hoveredFont.family }}>
                EUR/USD 1.0845
              </div>
              <div className="text-sm italic leading-relaxed text-gray-500" style={{ fontFamily: hoveredFont.family }}>
                "The quick brown fox jumps over the lazy dog."
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold uppercase text-gray-400">Numbers</span>
                  <span className="text-lg font-bold text-gray-900" style={{ fontFamily: hoveredFont.family }}>0123456789</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[8px] font-bold uppercase text-gray-400">Weight Test</span>
                  <span className="text-lg font-black text-gray-900" style={{ fontFamily: hoveredFont.family }}>BOLD</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
