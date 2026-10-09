export default function VideosLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your videos">
      <div>
        <div className="skeleton h-3 w-14" />
        <div className="skeleton mt-4 h-11 w-56" />
        <div className="skeleton mt-3 h-4 w-40" />
      </div>
      <div className="pane-grid">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="pane p-2">
            <div className="skeleton aspect-[9/16] w-full !rounded-[20px]" />
            <div className="skeleton mt-3 h-4 w-3/4" />
            <div className="skeleton mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
