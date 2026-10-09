export default function SignInLoading() {
  return (
    <div className="px-3 pt-8 sm:px-5 sm:pt-14" aria-busy="true" aria-label="Loading sign-in">
      <div className="mx-auto grid max-w-[1000px] items-center gap-8 lg:grid-cols-[1fr_440px] lg:gap-14">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="skeleton h-3 w-40" />
          <div className="skeleton mt-5 h-12 w-full max-w-md" />
          <div className="skeleton mt-3 h-12 w-3/4 max-w-sm" />
          <div className="skeleton mt-6 h-4 w-full max-w-md" />
          <div className="skeleton mt-2 h-4 w-2/3 max-w-sm" />
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="skeleton h-[72px]" />
            <div className="skeleton h-[72px]" />
            <div className="skeleton h-[72px]" />
          </div>
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          <div className="pane-ink p-5 sm:p-8">
            <div className="skeleton h-4 w-20 !bg-white/10" />
            <div className="skeleton mt-6 h-7 w-48 !bg-white/10" />
            <div className="skeleton mt-3 h-4 w-64 max-w-full !bg-white/10" />
            <div className="skeleton mt-8 h-[50px] w-full !bg-white/10" />
            <div className="skeleton mt-4 h-[50px] w-full rounded-full !bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
