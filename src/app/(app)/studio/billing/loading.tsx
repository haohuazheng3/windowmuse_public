export default function BillingLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading billing">
      <div>
        <div className="skeleton h-3 w-14" />
        <div className="skeleton mt-4 h-11 w-64 max-w-full" />
        <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="pane px-5 py-5">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton mt-3 h-8 w-24" />
            <div className="skeleton mt-3 h-3 w-48 max-w-full" />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="pane p-5 sm:p-6">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton mt-3 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-3/4" />
          <div className="mt-5 flex gap-2">
            <div className="skeleton h-12 w-36 rounded-full" />
            <div className="skeleton h-12 w-32 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
