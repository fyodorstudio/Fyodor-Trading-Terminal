export function OverviewPlaceholderTab() {
  return (
    <div className="mx-auto flex max-w-[1460px] flex-col gap-6 pb-12">
      <section className="overflow-hidden rounded-3xl border border-gray-200/60 bg-white/75 shadow-sm backdrop-blur-xl">
        <div className="bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,64,175,0.92))] px-8 py-8 text-white">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-100/80">Blank Surface</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Overview</h2>
          <p className="mt-3 max-w-3xl text-sm text-blue-100/90">
            This top-level overview surface is intentionally blank while the new product direction is being rebuilt.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/60 bg-white/75 p-8 shadow-sm backdrop-blur-xl">
        <h3 className="text-lg font-black tracking-tight text-slate-900">Status</h3>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
          The old overview remains accessible behind the `WORK IN PROGRESS` drawer as `Legacy Overview Tab` until a cleaner replacement is ready.
        </p>
      </section>
    </div>
  );
}
