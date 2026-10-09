import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, stripeEvents, subscriptions, type OrderRow, type SubscriptionRow } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { OFFERS, isSku } from "@/content/plans";
import { stripeMode } from "@/lib/stripe";
import { emailsForUsers, orderTotals } from "../_data";
import { AdminTable, AdminTitle, Mono, Tag, UserLink, ago, fmtDate, fmtInt, fmtMoney, orderTone, subscriptionTone, type Column } from "../_ui";

export const dynamic = "force-dynamic";

function offerName(sku: string): string {
  return isSku(sku) ? OFFERS[sku].name : sku;
}

export default async function OrdersPage() {
  await requireAdmin();
  const [orderRows, subRows, events, last30] = await Promise.all([
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(200),
    db.select().from(subscriptions).orderBy(desc(subscriptions.updatedAt)).limit(200),
    db.select().from(stripeEvents).orderBy(desc(stripeEvents.receivedAt)).limit(40),
    orderTotals(30),
  ]);
  const emails = await emailsForUsers([...new Set([...orderRows.map((o) => o.userId), ...subRows.map((s) => s.userId)])]);
  const mode = stripeMode();

  const orderColumns: Column<OrderRow>[] = [
    {
      key: "order",
      label: "Order",
      primary: true,
      render: (o) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-ink">
              {offerName(o.sku)} · {fmtMoney(o.amountTotal, o.currency)}
            </span>
            <Tag tone={orderTone(o.status)}>{o.status}</Tag>
            <Tag>{o.kind}</Tag>
            {o.promoCode ? <Tag tone="muse">{o.promoCode}</Tag> : null}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.78rem] text-ink-4">
            <Mono title="Checkout session">{o.stripeSessionId}</Mono>
            {o.stripePaymentIntent ? <Mono title="Payment intent">{o.stripePaymentIntent}</Mono> : null}
            {o.stripeInvoiceId ? <Mono title="Invoice">{o.stripeInvoiceId}</Mono> : null}
          </p>
        </div>
      ),
    },
    { key: "user", label: "Buyer", render: (o) => <UserLink id={o.userId} email={o.email ?? emails.get(o.userId)} /> },
    { key: "source", label: "Recorded by", render: (o) => <span className="text-ink-3">{o.source.replace("_", " ")}</span> },
    { key: "created", label: "Paid", render: (o) => <span title={fmtDate(o.createdAt)}>{ago(o.createdAt)}</span> },
    {
      key: "updated",
      label: "Updated",
      render: (o) => <span title={fmtDate(o.updatedAt)}>{o.updatedAt.getTime() - o.createdAt.getTime() > 60_000 ? ago(o.updatedAt) : "—"}</span>,
    },
  ];

  const subColumns: Column<SubscriptionRow>[] = [
    {
      key: "sub",
      label: "Subscription",
      primary: true,
      render: (s) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-ink">{offerName(s.sku)}</span>
            <Tag tone={subscriptionTone(s.status)}>{s.status.replace("_", " ")}</Tag>
            {s.cancelAtPeriodEnd ? <Tag tone="bad">cancels at period end</Tag> : null}
          </p>
          <p className="mt-1 text-[0.78rem] text-ink-4">
            <Mono title="Stripe subscription">{s.stripeSubscriptionId}</Mono>
          </p>
        </div>
      ),
    },
    { key: "user", label: "User", render: (s) => <UserLink id={s.userId} email={emails.get(s.userId)} /> },
    {
      key: "period",
      label: "Current period",
      render: (s) => (
        <span className="text-[0.86rem]">
          {s.currentPeriodStart ? fmtDate(s.currentPeriodStart).replace(" UTC", "") : "—"} → {s.currentPeriodEnd ? fmtDate(s.currentPeriodEnd) : "—"}
        </span>
      ),
    },
    { key: "updated", label: "Updated", render: (s) => <span title={fmtDate(s.updatedAt)}>{ago(s.updatedAt)}</span> },
  ];

  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <AdminTitle
          title="Orders"
          count={orderRows.length}
          lede={
            <>
              Every paid checkout, recorded by the success page, the webhook or the daily reconcile (whichever arrived first). Refunds and disputes update
              the status and revoke the matching credit lot. Stripe mode: <Tag tone={mode === "live" ? "ok" : mode === "test" ? "muse" : "bad"}>{mode}</Tag>
            </>
          }
        />
        <p className="text-[0.88rem] text-ink-3">
          Last 30 days: <strong className="text-ink">{fmtMoney(last30.revenueCents)}</strong> across {fmtInt(last30.paidCount)} paid orders
          {last30.refundedCount || last30.disputedCount ? (
            <>
              {" "}
              · {fmtInt(last30.refundedCount)} refunded · {fmtInt(last30.disputedCount)} disputed
            </>
          ) : null}
          .
        </p>
        <AdminTable columns={orderColumns} rows={orderRows} keyOf={(o) => o.id} empty="No orders yet. The first checkout appears here within seconds of payment." />
      </section>

      <section className="space-y-5">
        <AdminTitle title="Subscriptions" count={subRows.length} lede="Mirror of Stripe's subscription objects. Credits for each period arrive as a lot keyed by subscription id and period start." />
        <AdminTable columns={subColumns} rows={subRows} keyOf={(s) => s.id} empty="No subscriptions yet." />
      </section>

      <section className="space-y-4">
        <AdminTitle title="Stripe events" count={events.length} lede="The webhook's idempotency ledger: every event id Stripe delivered and what we did with it." />
        <ul className="pane divide-y divide-[var(--line)] px-2 text-[0.86rem]">
          {events.length === 0 ? <li className="px-3 py-5 text-ink-4">No webhook events received yet.</li> : null}
          {events.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className="min-w-0 break-all text-ink-2">
                {e.type} <Mono title="Event id">{e.id}</Mono>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-ink-4">
                <Tag tone={e.status === "processed" ? "ok" : e.status === "failed" ? "bad" : "neutral"}>{e.status}</Tag>
                <span title={fmtDate(e.receivedAt)}>{ago(e.receivedAt)}</span>
              </span>
              {e.error ? <span className="basis-full break-words text-[0.8rem] text-bad">{e.error}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
