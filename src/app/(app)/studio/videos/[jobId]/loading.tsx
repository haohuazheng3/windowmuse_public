export default function JobLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading the video">
      <div className="skeleton h-3 w-32" />
      <div>
        <div className="skeleton h-3 w-16" />
        <div className="skeleton mt-4 h-10 w-64 max-w-full" />
        <div className="skeleton mt-3 h-4 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start">
        <div className="pane p-3 sm:p-4">
          <div className="skeleton mx-auto aspect-[9/16] w-full max-w-[360px] !rounded-[20px]" />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="skeleton h-12 w-full rounded-full" />
            <div className="skeleton h-12 w-full rounded-full" />
          </div>
        </div>
        <div className="pane p-5 sm:p-6">
          <div className="skeleton h-5 w-20 rounded-full" />
          <div className="skeleton mt-4 h-7 w-3/4" />
          <div className="skeleton mt-4 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-5/6" />
          <div className="skeleton mt-2 h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
