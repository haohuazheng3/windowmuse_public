export default function StudioLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your studio">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="skeleton h-3 w-16" />
          <div className="skeleton mt-4 h-11 w-72 max-w-full" />
        </div>
        <div className="skeleton h-14 w-40 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="pane px-5 py-5">
            <div className="skeleton h-3 w-14" />
            <div className="skeleton mt-3 h-8 w-20" />
            <div className="skeleton mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div>
        <div className="skeleton h-7 w-40" />
        <div className="pane-grid mt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pane p-2">
              <div className="skeleton aspect-[9/16] w-full !rounded-[20px]" />
              <div className="skeleton mt-3 h-4 w-3/4" />
              <div className="skeleton mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
