export default function ProductLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the product">
      <div className="skeleton h-3 w-32" />
      <div>
        <div className="skeleton h-3 w-20" />
        <div className="skeleton mt-4 h-10 w-64 max-w-full" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-12 w-64 max-w-full rounded-full" />
        <div className="skeleton h-12 w-32 rounded-full" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="pane p-5 sm:p-6">
          <div className="skeleton h-6 w-24" />
          <div className="skeleton mt-3 h-3 w-72 max-w-full" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="skeleton h-[50px]" />
            <div className="skeleton h-[50px]" />
            <div className="skeleton h-[50px]" />
            <div className="skeleton h-[50px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
