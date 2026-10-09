import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { PACKS, PLANS, TRIAL } from "@/content/plans";
import { pageMetadata } from "@/lib/seo";
import { CONTENT_UPDATED, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of service",
  description:
    "The agreement for using WindowMuse: your account, credits and billing, what you may and may not generate, who owns the uploads and the videos, your duty to label AI content on TikTok, and our limits of liability.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      path="/terms"
      updated={CONTENT_UPDATED}
      intro="The short version: you bring real product photos and honest selling points; we render a fictional presenter who shows the product and says why it is worth buying. The video is yours to use. You label it as AI-generated when you post it, you do not make it say things that are false or that a real customer or doctor would say, and you only pay for videos that succeed."
    >
      <h2>1. Who and what</h2>
      <p>
        These terms are an agreement between you and {SITE.legalName} (“WindowMuse”, “we”) for the website {SITE.domain}, the studio and
        every related service (the “Service”). By creating an account or using the Service you accept them, together with the{" "}
        <Link href="/acceptable-use">acceptable-use policy</Link>, the <Link href="/privacy">privacy policy</Link> and the{" "}
        <Link href="/refund-policy">refund policy</Link>, which are part of this agreement. If you use the Service for a business, you
        confirm you may bind that business.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be 18 or older and signing in with an email address you control. One person, one account; teams share by agreement with us.</li>
        <li>Sign-in uses one-time codes sent by Clerk. Keep your mailbox secure; anything done from your signed-in session is treated as done by you.</li>
        <li>You may close your account at any time from the studio or by emailing {SITE.email}. Section 9 says what happens to your content.</li>
      </ul>

      <h2>3. What the Service does</h2>
      <p>
        You upload photos of a product you sell, describe it, choose one of our fictional presenters and approve a short spoken script. We
        send those inputs to a third-party video model and return a vertical video file (“Output”). Generation is probabilistic: the
        presenter’s gestures, exact framing and delivery vary between runs, and a run can fail. We do not promise a particular look, a
        particular performance on TikTok, or that TikTok or any platform will accept, distribute or monetise any video.
      </p>

      <h2>4. Credits and billing</h2>
      <ul>
        <li>
          <strong>Credits.</strong> One credit is one video up to 15 seconds at 720p (480p costs the same). A 20- or 30-second video is two
          credits. 1080p doubles the cost. Prices are shown in the studio before you generate.
        </li>
        <li>
          <strong>Reservation.</strong> Credits are reserved when you press Generate and charged only when the video succeeds. A video that
          fails, is cancelled, or times out (after two hours) releases its reservation. Failed generations never cost credits.
        </li>
        <li>
          <strong>Free trial.</strong> New accounts receive {TRIAL.credits} credits, usable at {TRIAL.resolution} only, for {TRIAL.expiryDays}{" "}
          days. The trial is granted once per person; creating accounts to collect more trials is a breach of these terms.
        </li>
        <li>
          <strong>Plans.</strong> Starter (${PLANS.starter.priceUsd}/month, {PLANS.starter.credits} credits), Growth (${PLANS.growth.priceUsd}
          /month, {PLANS.growth.credits} credits) and Pro (${PLANS.pro.priceUsd}/month, {PLANS.pro.credits} credits) renew monthly through
          Stripe until you cancel. Credits of a billing month arrive when its invoice is paid. Starter credits expire at the end of that
          billing month; Growth and Pro credits stay usable for 30 days after it. Growth and Pro include 1080p and three videos generating
          at once.
        </li>
        <li>
          <strong>Packs.</strong> {PACKS.pack10.credits} credits for ${PACKS.pack10.priceUsd} and {PACKS.pack50.credits} credits for $
          {PACKS.pack50.priceUsd}, paid once, valid 90 days from purchase, used with the limits of whatever plan you are on (720p and one
          video at a time without a plan).
        </li>
        <li>
          <strong>Cancelling.</strong> Cancel a plan at any time from Billing in the studio. It stays active until the end of the paid
          period, nothing further is charged, and credits you already have keep their expiry date.
        </li>
        <li>
          <strong>Refunds.</strong> A plan or pack that has not been used is refunded in full if you ask within 14 days of purchase; partly
          used purchases are refunded for the unused credits as the <Link href="/refund-policy">refund policy</Link> describes. A refund
          removes the credits it covers.
        </li>
        <li>
          <strong>Taxes and prices.</strong> Prices are in US dollars and exclude any sales tax Stripe is required to collect for your
          location. We may change prices for future periods with at least 30 days’ notice by email or in the studio; the change never
          applies to a period you have already paid for.
        </li>
      </ul>

      <h2>5. Your content</h2>
      <ul>
        <li>
          <strong>Ownership.</strong> Your photos, product descriptions and scripts (“Inputs”) remain yours. You grant us a licence to store,
          process and transmit them to our providers solely to run the Service for you, and to keep the prompt and job records needed to
          support you and to resolve disputes about credits.
        </li>
        <li>
          <strong>Your promises about Inputs.</strong> You own or are licensed to use every photo and every word you upload. The photos show
          the real product you sell and show no person. Every objective claim in a script is true and you hold the evidence for it. Nothing
          you upload infringes anyone’s rights or breaks any law.
        </li>
        <li>
          <strong>Output.</strong> Subject to payment and to these terms, the Output of each successful generation is yours to use, reproduce
          and publish for your own marketing on any platform, with no attribution to us. To the extent we hold any right in the Output we
          assign it to you on delivery. We keep a copy only to serve it to you for the retention period in the privacy policy. We make no
          claim that any Output is protectable by copyright; that depends on your jurisdiction.
        </li>
        <li>
          <strong>Presenters.</strong> The presenter personas, names, descriptions and avatars are ours. You may use them as they appear in
          your Output; you may not extract them, present them as your employees or as real people, or use them outside Output of the Service.
        </li>
      </ul>

      <h2>6. AI content and disclosure duties</h2>
      <p>
        Every Output is AI-generated and shows a fictional person. You are responsible for every disclosure the platform you post on and
        the law where you sell require, including:
      </p>
      <ul>
        <li>
          turning on TikTok’s <strong>“AI-generated content”</strong> setting on every post that uses Output, and the{" "}
          <strong>commercial content disclosure</strong> on every post that promotes a product you sell (TikTok Shop’s rules and the FTC
          Endorsement Guides, 16 CFR Part 255, both require this);
        </li>
        <li>the equivalent disclosures on any other platform (for example YouTube’s altered-or-synthetic-content disclosure, Meta’s AI label);</li>
        <li>where the EU AI Act applies to you, the disclosure duty of its Article 50 for AI-generated video.</li>
      </ul>
      <p>
        We may embed visible or invisible AI-disclosure markers or Content Credentials in Output. You must not remove, disable or obscure
        them. We remind you of the TikTok steps on every download page; the reminder does not shift the duty to us.
      </p>

      <h2>7. Prohibited uses</h2>
      <p>The <Link href="/acceptable-use">acceptable-use policy</Link> has the full list. In short, you must not use the Service to:</p>
      <ul>
        <li>depict the likeness or voice of any real person, living or dead, including public figures, without their documented consent;</li>
        <li>depict or present a presenter as a minor;</li>
        <li>present a presenter as a doctor, nurse, pharmacist, lawyer, government official, police officer, journalist, or representative of any institution you are not authorised to represent;</li>
        <li>present a presenter as an actual customer, user or reviewer of a product, or otherwise use Output as a consumer review or testimonial within the meaning of 16 CFR Part 465;</li>
        <li>claim that a product diagnoses, treats, cures, prevents or mitigates any disease or condition, or make weight-loss, muscle-gain or sexual-performance claims not supported by competent and reliable scientific evidence;</li>
        <li>alter the appearance, size, colour, materials, contents or performance of a product, or depict results it cannot achieve;</li>
        <li>use Output in live streams where the platform prohibits synthetic or non-real-time audio or video (TikTok Shop LIVE does);</li>
        <li>break the TikTok Community Guidelines, the TikTok Shop content policies, TikTok’s advertising policies, or any advertising or consumer-protection law.</li>
      </ul>
      <p>
        The studio’s compliance check blocks the most common of these before a credit is spent. Passing the check is not a legal opinion;
        the script is yours.
      </p>

      <h2>8. What we may do</h2>
      <ul>
        <li>Refuse or stop a generation, remove content, or suspend or close an account that breaks these terms, and cooperate with a platform’s takedown or likeness-detection process. We tell you why unless the law prevents it.</li>
        <li>Change the Service, its presenters, models and limits. If a change removes something you paid for in the current period, section 4 refunds apply.</li>
        <li>Suspend the Service for maintenance or when a provider is down. Reservations during an outage are released, not charged.</li>
      </ul>

      <h2>9. Ending the agreement</h2>
      <p>
        You can stop at any time: cancel your plan and delete your account. Deleting the account removes your products, photos, scripts and
        videos as the privacy policy describes; unused credits are forfeited unless the refund policy returns them. We can end the agreement
        with 30 days’ notice, or immediately for a serious breach of section 7; in the first case we refund unused paid credits.
      </p>

      <h2>10. Warranties and liability</h2>
      <p>
        The Service is provided as it is. We do not warrant that it will be uninterrupted or error-free, that Output will meet your
        expectations, or that any platform will accept it. To the fullest extent the law allows, we are not liable for lost profits, lost
        sales, platform penalties, or indirect or consequential loss, and our total liability to you for any claim in a twelve-month period
        is limited to the amount you paid us in that period. Nothing here limits liability that cannot be limited by law, including for
        fraud or for death or personal injury caused by negligence.
      </p>
      <p>
        You will indemnify us against claims that arise from your Inputs, your scripts, your failure to make required disclosures, or your
        breach of section 7.
      </p>

      <h2>11. Disputes and law</h2>
      <p>
        Write to us first: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. Nearly every problem (a failed video, a wrong charge, a
        misunderstanding about credits) is solved in one email, and we would rather fix it than argue about it. These terms are governed by
        the law of the place where WindowMuse is established, and disputes that cannot be settled by email go to the courts of that place,
        without prejudice to any mandatory consumer rights where you live.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        We may update these terms. For material changes we give at least 14 days’ notice by email or in the studio before they apply; if
        you do not agree, cancel before the date and section 9 applies. The current version is always at {SITE.domain}/terms.
      </p>
    </LegalPage>
  );
}
