export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="skeleton h-9 w-48" />
      <div className="skeleton mt-3 h-4 w-96 max-w-full" />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pane p-5">
            <div className="skeleton h-3 w-28" />
            <div className="mt-4 space-y-2.5">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-5/6" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
