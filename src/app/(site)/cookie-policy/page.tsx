import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsLink } from "@/components/Consent";
import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { CONTENT_UPDATED } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Cookie policy",
  description:
    "Every cookie and browser-storage item windowmuse.com uses: the wm_consent choice, Clerk sign-in session cookies, the wm-theme preference, a checkout nonce, Stripe’s checkout cookies and FlowGlance analytics identifiers.",
  path: "/cookie-policy",
});

type Row = { name: string; type: "Essential" | "Preference" | "Analytics"; setBy: string; purpose: string; duration: string };

const ROWS: Row[] = [
  {
    name: "wm_consent",
    type: "Essential",
    setBy: "windowmuse.com",
    purpose: "Remembers whether you accepted analytics (“all”) or chose essential only, so we do not ask again.",
    duration: "180 days",
  },
  {
    name: "__session, __client_uat and related Clerk cookies",
    type: "Essential",
    setBy: "windowmuse.com / clerk.windowmuse.com",
    purpose: "Keep you signed in to the studio after you enter the email code, and let the server know which account is asking. Set only once you sign in; visitors to the public pages never receive them.",
    duration: "Session cookie plus a 7-day refresh token; cleared when you sign out",
  },
  {
    name: "wm-theme (local storage)",
    type: "Preference",
    setBy: "windowmuse.com",
    purpose: "Remembers an explicit light or dark choice from the footer toggle. Not set while you follow your system theme. Never sent to us.",
    duration: "Until you clear it or choose “system”",
  },
  {
    name: "wm_checkout_nonce:<offer> and wm_checkout_url:<offer> (session storage)",
    type: "Essential",
    setBy: "windowmuse.com",
    purpose: "A random key for one checkout attempt and the Stripe page it opened, so a refresh or a double tap lands on the same Stripe session instead of opening two. Cleared when the purchase completes.",
    duration: "20 minutes, or when the tab closes",
  },
  {
    name: "wm_me_v2 and wm_flow_<product> (session storage)",
    type: "Essential",
    setBy: "windowmuse.com",
    purpose: "Only inside the studio: a copy of your plan and credit balance so the numbers show before the server answers, and the unsaved choices of the create flow (presenter, script options and text, resolution) so a refresh never loses work. Never sent anywhere; the server remains the record.",
    duration: "Until the tab closes",
  },
  {
    name: "wm_post_<job>, wm_unlocked_<job> and wm_purchase_<session> (local storage)",
    type: "Preference",
    setBy: "windowmuse.com",
    purpose: "Only inside the studio: which items of the “Post it right” checklist you ticked for a video, and one-time markers so the analytics events for a finished video or a completed purchase fire once instead of on every visit.",
    duration: "Until you clear your browser data",
  },
  {
    name: "Stripe cookies (__stripe_mid, __stripe_sid and others)",
    type: "Essential",
    setBy: "checkout.stripe.com, billing.stripe.com, m.stripe.network",
    purpose: "Process the payment and detect fraud on Stripe’s own pages. Stripe sets them when you reach checkout or the billing portal.",
    duration: "Set by Stripe (the session id about 30 minutes, the device id about 1 year)",
  },
  {
    name: "FlowGlance identifiers",
    type: "Analytics",
    setBy: "flowglance.com",
    purpose: "Recognise repeat visits and connect page views into one journey. Set only when analytics are on: after you accept in the EU/EEA, UK and Switzerland, by default elsewhere until you opt out.",
    duration: "Set by FlowGlance",
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie policy"
      path="/cookie-policy"
      updated={CONTENT_UPDATED}
      intro="Short list, honestly described: one consent cookie, Clerk’s sign-in cookies once you are in the studio, your theme choice in local storage, a checkout key for a few minutes, a few studio-only entries that keep your work and settings in your own browser, Stripe’s cookies on its own pages, and our one analytics tool, which you control."
    >
      <h2>What we use</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[0.9rem]">
          <thead>
            <tr className="border-b border-line text-ink">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Set by</th>
              <th className="py-2 pr-3">Purpose</th>
              <th className="py-2">Duration</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.name} className="border-b border-line align-top">
                <td className="py-2.5 pr-3 font-medium text-ink-2">{r.name}</td>
                <td className="py-2.5 pr-3">{r.type}</td>
                <td className="py-2.5 pr-3">{r.setBy}</td>
                <td className="py-2.5 pr-3">{r.purpose}</td>
                <td className="py-2.5">{r.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Analytics and your choice</h2>
      <p>
        FlowGlance is the only analytics on this site. It records page activity, including the text you submit in forms and the images you
        upload through the site, as the <Link href="/privacy">privacy policy</Link> explains. In the EU, EEA, UK and Switzerland it loads
        only after you accept; everywhere else it loads by default with a notice and you can opt out. Your choice is stored in{" "}
        <code>wm_consent</code> and applies from the next page you load.
      </p>
      <p>
        <CookieSettingsLink /> ← change your choice at any time.
      </p>

      <h2>No advertising cookies</h2>
      <p>We run no ad pixels, no retargeting and no social-media tracking tags. No third party is allowed to set cookies here except the ones listed above.</p>

      <h2>Blocking cookies</h2>
      <p>
        You can block or delete cookies in your browser. If you block the essential ones, you cannot stay signed in to the studio and Stripe
        checkout may not complete. The public pages work without any cookie at all.
      </p>
    </LegalPage>
  );
}
