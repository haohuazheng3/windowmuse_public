/** The five panes as skeletons: shown by loading.tsx and while the client flow loads. */
export function FlowSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading the create flow">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="pane p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="flex-1">
              <div className="skeleton h-6 w-32" />
              <div className="skeleton mt-2 h-3 w-64 max-w-full" />
            </div>
          </div>
          <div className={`mt-5 grid gap-2 ${i === 2 ? "grid-cols-2 sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className={`skeleton ${i === 2 ? "aspect-[4/5]" : "h-[66px]"} ${i !== 2 && j === 3 ? "hidden" : ""}`} />
            ))}
          </div>
        </div>
      ))}
      <div className="pane-ink p-5 sm:p-6">
        <div className="skeleton h-6 w-28 !bg-white/10" />
        <div className="mt-5 flex gap-2">
          <div className="skeleton h-10 w-20 rounded-full !bg-white/10" />
          <div className="skeleton h-10 w-20 rounded-full !bg-white/10" />
          <div className="skeleton h-10 w-20 rounded-full !bg-white/10" />
        </div>
        <div className="skeleton mt-6 h-14 w-full rounded-full !bg-white/10 sm:w-64" />
      </div>
    </div>
  );
}
