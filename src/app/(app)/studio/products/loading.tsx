export default function ProductsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your products">
      <div>
        <div className="skeleton h-3 w-16" />
        <div className="skeleton mt-4 h-11 w-64 max-w-full" />
        <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="pane-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="pane p-4">
            <div className="skeleton h-5 w-24 rounded-full" />
            <div className="skeleton mt-4 h-5 w-3/4" />
            <div className="skeleton mt-2 h-3 w-1/2" />
            <div className="skeleton mt-3 h-3 w-full" />
            <div className="skeleton mt-4 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
