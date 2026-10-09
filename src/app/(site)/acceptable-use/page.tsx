import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { CONTENT_UPDATED, SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Acceptable use",
  description:
    "What you may and may not generate with WindowMuse: no real people, no minors, no fake experts or fake customers, no medical or guaranteed claims, no altered products, no live streams, and the AI-disclosure duties on every post.",
  path: "/acceptable-use",
});

const PROHIBITED: { title: string; body: string }[] = [
  {
    title: "Real people",
    body: "Creating content that depicts the likeness or voice of any real person without that person’s documented, express consent. This includes public figures, celebrities, influencers, your own customers, and people who have died. Our presenters are fictional for exactly this reason, and we do not accept face uploads at all.",
  },
  {
    title: "Minors",
    body: "Creating content that depicts anyone under 18, or presenting a presenter as a minor, in any context.",
  },
  {
    title: "Fake experts and officials",
    body: "Presenting a presenter as a licensed professional (doctor, nurse, dermatologist, pharmacist, dentist, lawyer, financial adviser), a government official, a police officer, soldier or customs officer, a journalist or news anchor, or a representative of any institution you are not authorised to represent. “As a dermatologist, I recommend…” is a breach even if the product is good.",
  },
  {
    title: "Fake customers and testimonials",
    body: "Presenting a presenter as an actual customer, user or reviewer of a product, or otherwise using a video as a consumer review or testimonial within the meaning of the FTC’s rule on consumer reviews and testimonials (16 CFR Part 465). “I’ve been using this for three weeks” from a person who does not exist is a fake review. Presenters speak as your shop, about facts.",
  },
  {
    title: "Health and body claims",
    body: "Claiming that a product diagnoses, treats, cures, prevents, heals or mitigates any disease or medical condition, or making any weight-loss, muscle-gain, hair-growth or sexual-performance claim that is not substantiated by competent and reliable scientific evidence. Before-and-after framing needs real evidence and a “results may vary” qualifier.",
  },
  {
    title: "Altered products",
    body: "Using AI to alter the appearance, size, colour, materials, contents, quantity, bundle or performance of a product, or to depict results the product cannot achieve. The presenter holds the product as photographed; your photos must show the real item you ship.",
  },
  {
    title: "Removing disclosure",
    body: "Removing, disabling or obscuring AI-disclosure labels, watermarks or Content Credentials we embed in a video, or posting a video while hiding that it is AI-generated.",
  },
  {
    title: "Live streams",
    body: "Using a video or its audio in live streams where the platform prohibits non-real-time or synthetic audio or video. TikTok Shop does not allow AI-generated voices or recordings in LIVE; WindowMuse offers no live feature and must not be used to fake one.",
  },
  {
    title: "Deception and platform rules",
    body: "Any use that violates the TikTok Community Guidelines, the TikTok Shop content and AI-generated-content policies, TikTok’s advertising policies, the rules of any other platform you post on, or applicable advertising and consumer-protection law. Also: misleading pricing (a discount that does not match your listing), counterfeit or prohibited goods, and content that is hateful, harassing, sexual or violent.",
  },
  {
    title: "Abuse of the Service",
    body: "Multiple accounts to farm free trials, automated scraping, probing or overloading the Service, reselling access without agreement, reverse-engineering the presenters or prompts, or uploading malware or anything you have no right to upload.",
  },
];

const OBLIGATIONS = [
  "You are solely responsible for enabling the platform’s AI-disclosure settings (for example TikTok’s “AI-generated content” toggle under More options) and the commercial-content disclosures required by each platform and by law, including the FTC Endorsement Guides (16 CFR Part 255) and, where it applies to you, Article 50 of the EU AI Act.",
  "You represent that you hold all rights and consents necessary for every photo, product description and script you upload, and that your photos show the real product and no person.",
  "You must retain substantiation for every objective claim in your scripts (materials, measurements, capacity, certifications, test results) for as long as the video is public.",
  "You must keep prices and discounts spoken in a video consistent with the listing the video links to.",
  "If a platform removes or restricts a video made with the Service, you tell us if you want help understanding why, and you do not re-upload it unchanged.",
];

export default function AcceptableUsePage() {
  return (
    <LegalPage
      title="Acceptable use"
      path="/acceptable-use"
      updated={CONTENT_UPDATED}
      intro="WindowMuse makes a fictional presenter say true things about a real product. Everything on this page follows from that sentence. The list is specific because TikTok Shop’s AI policies and the FTC’s rules on fake reviews and endorsements are specific, and because a breach can cost you your shop, not just a video."
    >
      <h2>Why this policy exists</h2>
      <p>
        TikTok Shop allows AI-generated product demonstrations when the AI is disclosed, the physical product is shown accurately and nobody
        is impersonated. It penalises the opposite with warnings, restricted posting, withheld commissions and bans. The US Federal Trade
        Commission bans fake reviews and testimonials, including AI-generated ones, with civil penalties per violation, and treats a virtual
        presenter’s recommendation as an endorsement the advertiser is responsible for. This policy is our translation of those rules into
        what you may and may not do with the Service. It is part of the <Link href="/terms">terms of service</Link>.
      </p>

      <h2>Prohibited uses</h2>
      <p>You must not use the Service, or any video it produces, for any of the following.</p>
      <ol>
        {PROHIBITED.map((p) => (
          <li key={p.title}>
            <strong>{p.title}.</strong> {p.body}
          </li>
        ))}
      </ol>

      <h2>Your obligations</h2>
      <ul>
        {OBLIGATIONS.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>

      <h2>How we enforce it</h2>
      <ul>
        <li>
          <strong>Before generation.</strong> The script check in the studio blocks medical cure/treat/prevent claims, “guaranteed”,
          first-person customer testimony and professional personas, and warns about “instant”, before/after without a qualifier and price
          mentions. Photo uploads require your confirmation that they show your product and no people.
        </li>
        <li>
          <strong>After generation.</strong> We may review videos and accounts that are reported or that trip our checks, remove content,
          refuse further generations, and suspend or close accounts that breach this policy. Credits spent on a video that breached this
          policy are not refunded; reservations for refused generations are released.
        </li>
        <li>
          <strong>Disclosure markers.</strong> We may embed visible or invisible AI-disclosure markers or Content Credentials in every video
          and may cooperate with platforms’ takedown and likeness-detection processes.
        </li>
        <li>
          <strong>Reports.</strong> If you believe a video made with the Service depicts you or breaks this policy, email{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> with the link; we respond within two business days.
        </li>
      </ul>

      <h2>Allowed, and encouraged</h2>
      <ul>
        <li>Product demonstrations that are accurate to the actual product: what it is, what it is made of, how to use it, what is in the box.</li>
        <li>Scripts in any of the 11 supported languages, for markets where you sell.</li>
        <li>Comparisons to your own other products or to doing without, stated factually.</li>
        <li>Reusing a video in paid ads, on your own site, or on other platforms, with that platform’s AI disclosure.</li>
        <li>Honest “early access” language and “results may vary” qualifiers. Modesty ages better than hype.</li>
      </ul>
    </LegalPage>
  );
}
