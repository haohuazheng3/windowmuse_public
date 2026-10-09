export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="skeleton h-9 w-56" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="pane px-5 py-5">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="pane p-5">
          <div className="skeleton h-3 w-24" />
          <div className="mt-4 space-y-2.5">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        </div>
        <div className="pane p-5">
          <div className="skeleton h-3 w-24" />
          <div className="mt-4 space-y-2.5">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-4/6" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}
