import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { CONTENT_UPDATED, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "What WindowMuse collects and why, who processes it (Clerk, Stripe, Neon, Cloudflare R2, Replicate and ByteDance Seedance, Anthropic, FlowGlance, Vercel), how long photos, scripts and videos are kept, and how to get or delete your data.",
  path: "/privacy",
});

const PROCESSORS: [string, string, string][] = [
  ["Clerk", "Sign-in", "Your email address, the one-time codes it sends you, session cookies, sign-in times and the device and IP address used. Clerk is the only place your sign-in history lives."],
  ["Stripe", "Payments", "Card details (entered on Stripe’s pages, never ours), billing name and address if you give them, the amount, the plan or pack, and Stripe’s customer, subscription, invoice and payment identifiers. Stripe emails receipts."],
  ["Neon", "Database", "Our application data: your account row (Clerk id, email), products and selling points, scripts, job records, credit ledger, orders, contact messages, error reports. Hosted in the US (AWS us-east-1)."],
  ["Cloudflare R2 and Workers", "File storage, email", "Your uploaded product photos and the generated videos, in a private bucket reachable only through short-lived signed links. Cloudflare also routes our email domain (mail you send to contact@ passes through it)."],
  ["Replicate, running ByteDance Seedance", "Video generation", "The product photos of the job, the presenter description, the approved script text and rendering settings. This is what is sent to generate a video; the finished file comes back to our storage and the provider’s copy is not shown to you."],
  ["Anthropic", "Script drafting", "When you press “Write it for me” and the AI writer is on: the product name, category, selling points, audience and price text you entered, plus your tone, angle, language and length choices. Never your photos, email or identity."],
  ["FlowGlance", "Analytics", "Page views, clicks, scrolling, navigation, device and browser type, approximate location from your IP address, and, because we have enabled its detailed capture, the text you type into forms on the site and images you upload through it. Only after consent in the EU/EEA, UK and Switzerland; by default elsewhere with an opt-out."],
  ["Vercel", "Hosting", "Serves the site and runs our server code; sees request logs (IP address, URL, user agent) for a short retention period set by Vercel."],
];

const RETENTION: [string, string][] = [
  ["Account (email, Clerk id)", "Until you delete the account or ask us to; deleting removes everything below with it."],
  ["Product photos", "Until you delete the product, or the account. Deleting a product removes its photos from storage right away."],
  ["Scripts and job records", "Until you delete the account. Scripts stay attached to the videos made from them, and job records (status, cost, timings, the prompt sent to the model) are kept so a video can be regenerated and a dispute about credits can be checked; deleting a product removes it from the studio but keeps these records."],
  ["Generated videos", "As long as your plan or pack is active, and for 90 days after your last plan or pack ends. After that the files are deleted; download what you want to keep."],
  ["Credit ledger, orders, Stripe events", "7 years, as accounting records."],
  ["Contact messages", "2 years from the last reply, so a follow-up has context."],
  ["Test inbox (mail to test@ and unknown addresses at our domain)", "Used to verify our own email delivery. Messages are kept for 30 days and are not read for any other purpose."],
  ["Error reports", "Grouped by error signature; individual occurrences 90 days, groups until resolved."],
  ["Analytics", "Set by FlowGlance; see its policy."],
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      path="/privacy"
      updated={CONTENT_UPDATED}
      intro="Plain language first: we collect what we need to sign you in, charge you, generate your videos and answer your messages. Your photos and videos are private, sent only to the video model that renders them, never used to train anything, and deleted when you delete the product. We do not sell data and we do not run ads."
    >
      <h2>Who we are</h2>
      <p>
        {SITE.legalName} (“we”, “us”) operates {SITE.domain}, the studio at {SITE.domain}/studio and the related services. For anything in
        this policy, write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. {SITE.replyTime}
      </p>

      <h2>What we collect, and why</h2>
      <h3>Your account</h3>
      <p>
        Signing in needs one thing: your email address. <strong>Clerk</strong> sends a one-time code to it and keeps the session; we store
        your Clerk user id, your email, when the account was created and when you last used it. There are no passwords and no social
        logins. The free trial credits are granted to this account once.
      </p>
      <h3>Your products and photos</h3>
      <p>
        To make a video you give us a product name, category, selling points and optionally a brand, an audience, a price text and your
        TikTok Shop link, plus one to eight photos of the product. Photos go from your browser straight to our private storage
        (<strong>Cloudflare R2</strong>) over a signed, single-use upload link; they are shown back to you through links that expire. You
        confirm at upload that the photos are yours and show no people; we do not want faces, and uploads that contain them may be
        removed.
      </p>
      <h3>Scripts and video generation</h3>
      <p>
        When you ask us to draft a script and the AI writer is enabled, the product facts and your choices are sent to{" "}
        <strong>Anthropic</strong>’s API to produce the draft; the text comes back to you to edit. When you press Generate, the product
        photos of that job, the chosen presenter’s written description, the approved script and the rendering settings are sent to our video
        provider (<strong>Replicate</strong>, running the <strong>ByteDance Seedance</strong> model) to render the video. We stream the
        finished file into our own storage and never show you the provider’s copy. We keep the exact prompt we sent with the job record so
        we can explain any result. We have not opted your content into any provider’s training programme, and we never use it to train
        anything ourselves.
      </p>
      <h3>Payments</h3>
      <p>
        <strong>Stripe</strong> processes every payment on its own pages. We never see or store your card number. Stripe tells us what we
        need to deliver and support the purchase: the amount, currency, plan or pack, the email at checkout, any promotion code, and Stripe’s
        customer, subscription, invoice and payment identifiers. We keep one Stripe customer per account so plan changes and the billing portal
        work. Stripe’s handling of your payment details is described in{" "}
        <a href="https://stripe.com/privacy" rel="noopener" target="_blank">
          its privacy policy
        </a>
        .
      </p>
      <h3>The credit ledger</h3>
      <p>
        Every credit grant, reservation, charge, release and refund is a row in our ledger, tied to your account and, where relevant, to a
        job or an order. That is how we show your balance, never charge a failed video and settle disputes.
      </p>
      <h3>Messages you send us</h3>
      <p>
        The contact form stores your name (optional), email, topic and message, with a one-way hash of your IP address and your browser’s
        user agent to filter spam, and whether you were signed in. We receive a notification so a person can reply.
      </p>
      <h3>Analytics (FlowGlance)</h3>
      <p>
        We use <strong>FlowGlance</strong> as our only analytics tool, to see which pages help sellers and where the studio loses people. It
        records page views, clicks, scrolling and navigation, device and browser type, and approximate location derived from your IP
        address. We have enabled FlowGlance’s detailed capture, which means it also records <strong>the text you submit in forms</strong> on
        this site (for example a product’s selling points, a script you edit, or a contact message) and <strong>images you upload</strong>{" "}
        through the site (your product photos). It never sees card details, because those are entered on Stripe’s pages. When you are
        signed in we tell FlowGlance your account id and email so your visits before and after sign-in connect.
      </p>
      <p>
        If you visit from the European Union, the European Economic Area, the United Kingdom or Switzerland, FlowGlance loads only after
        you accept it. Elsewhere it loads by default with a notice, and you can opt out at any time from “Cookie settings” in the footer.
        See the <Link href="/cookie-policy">cookie policy</Link>.
      </p>
      <h3>Error reports and logs</h3>
      <p>
        When something breaks, our servers and your browser send a technical report (error message, page, browser and device details, your
        account id if signed in) to our own error log so we can fix it. Our rate limiter keeps a hashed IP address with a counter for a few
        minutes to stop abuse.
      </p>

      <h2>Who processes data for us</h2>
      <p>These are the companies that touch your data on our behalf, and exactly what each one receives.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[0.92rem]">
          <thead>
            <tr className="border-b border-line text-ink">
              <th className="py-2 pr-3">Provider</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2">What it receives</th>
            </tr>
          </thead>
          <tbody>
            {PROCESSORS.map((r) => (
              <tr key={r[0]} className="border-b border-line align-top">
                <td className="py-2.5 pr-3 font-medium text-ink-2">{r[0]}</td>
                <td className="py-2.5 pr-3">{r[1]}</td>
                <td className="py-2.5">{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        We do not sell personal data, share it with advertisers, or give any third party access beyond the roles above. If the law or a
        court requires us to disclose something, we will, and we will tell you unless we are forbidden to.
      </p>

      <h2>How long we keep things</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[0.92rem]">
          <thead>
            <tr className="border-b border-line text-ink">
              <th className="py-2 pr-3">Data</th>
              <th className="py-2">Kept</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION.map((r) => (
              <tr key={r[0]} className="border-b border-line align-top">
                <td className="py-2.5 pr-3 font-medium text-ink-2">{r[0]}</td>
                <td className="py-2.5">{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Your rights</h2>
      <p>
        Wherever you live, you can ask us for a copy of the personal data we hold about you, ask us to correct it, or ask us to delete it.
        Deleting a product in the studio removes its photos from storage at once; its scripts and finished videos stay in your
        library under the retention periods above. Deleting your account removes everything except the accounting records we must
        keep. To exercise any of these, email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> from the address
        you sign in with. We confirm within two business days and complete the request within 30 days. If you are in the EU, EEA, UK or
        Switzerland you also have the right to object to or restrict processing, to data portability, and to complain to your supervisory
        authority; our legal bases are the contract with you (account, videos, payments), our legitimate interest in running a secure
        service (security, error reports, fraud prevention) and your consent (analytics where consent is required).
      </p>

      <h2>Where data lives</h2>
      <p>
        Our database and file storage are in the United States. Clerk, Stripe, Vercel, Replicate and Anthropic are US companies; FlowGlance
        and Cloudflare operate globally. If you use WindowMuse from outside the US, your data is transferred there under each provider’s
        standard contractual terms.
      </p>

      <h2>Children</h2>
      <p>WindowMuse is for sellers running a business and is not directed at anyone under 18. We do not knowingly keep data about minors.</p>

      <h2>Cookies</h2>
      <p>
        We set a consent cookie (<code>wm_consent</code>), Clerk sets session cookies when you sign in, your theme choice stays in your
        browser’s local storage, Stripe sets cookies on its checkout pages, and FlowGlance sets identifiers when analytics are on. Every one
        is listed in the <Link href="/cookie-policy">cookie policy</Link>.
      </p>

      <h2>Changes</h2>
      <p>
        When we change this policy in a way that matters (a new processor, a new use of your data, a shorter retention period) we update
        the date at the top and, for signed-in users, say so in the studio. The current version is always at {SITE.domain}/privacy.
      </p>
    </LegalPage>
  );
}
