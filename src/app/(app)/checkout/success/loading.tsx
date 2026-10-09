export default function CheckoutSuccessLoading() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-3 pb-16 pt-8 sm:px-5 sm:pt-14" aria-busy="true" aria-label="Confirming your payment">
      <div className="mx-auto max-w-3xl">
        <div className="pane p-6 sm:p-10">
          <div className="skeleton h-6 w-40 rounded-full" />
          <div className="skeleton mt-5 h-11 w-3/4" />
          <div className="skeleton mt-4 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-5/6" />
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="skeleton h-28 rounded-[20px]" />
            <div className="skeleton h-28 rounded-[20px]" />
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <div className="skeleton h-14 w-full rounded-full sm:w-48" />
            <div className="skeleton h-14 w-full rounded-full sm:w-44" />
          </div>
        </div>
        <p className="mt-4 text-center text-[0.9rem] text-ink-3">Confirming your payment with Stripe and adding your credits…</p>
      </div>
    </div>
  );
}
