interface MacroStatePrototypeTabProps {
  onBack: () => void;
}

export function MacroStatePrototypeTab({ onBack }: MacroStatePrototypeTabProps) {
  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.92))] px-8 py-8 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-100/80">Fresh Specialist Prototype</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Macro State Prototype</h2>
          <p className="mt-3 max-w-3xl text-sm text-blue-100/90">
            This hidden tab is the clean entry point for the new macro workflow. It stays outside the main specialist dropdown until the replacement flow is coherent enough to promote.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <h3 className="text-lg font-black tracking-tight text-slate-900">Status</h3>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
          Placeholder shell only. This is where the new watchlist-first, macro-state-second, replay-assisted workflow will be built without inheriting the old specialist-tab baggage.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50"
          >
            Back To WORK IN PROGRESS
          </button>
        </div>
      </section>
    </div>
  );
}
