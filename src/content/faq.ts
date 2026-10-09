import { PACKS, PLANS, TRIAL, formatPrice } from "@/content/plans";
import { PRESENTERS } from "@/content/presenters";

export interface Faq {
  q: string;
  a: string;
  tags: ("product" | "credits" | "compliance" | "account" | "general")[];
}

export const FAQS: Faq[] = [
  {
    q: "What does WindowMuse actually make?",
    a: "A vertical 9:16 video, 10 to 30 seconds long, in which a fictional on-camera presenter holds and shows your real product and speaks a short script about why it is worth buying. You upload the product photos, pick the presenter, approve the script, and download an MP4 ready to post on TikTok with your shop link.",
    tags: ["product", "general"],
  },
  {
    q: "How long does a video take?",
    a: "Most videos finish within a few minutes of pressing Generate; busy periods can take up to 20 minutes. The job page updates on its own (queued, generating, saving) and you can leave and come back: finished videos stay in your studio.",
    tags: ["product"],
  },
  {
    q: "How do credits work?",
    a: `One credit is one video up to 15 seconds at 720p (480p costs the same). A 16 to 30 second video is two credits, and 1080p doubles the cost. Credits are reserved when a job starts and only charged when the video succeeds. Plans: Starter ${formatPrice(PLANS.starter.priceUsd)} for ${PLANS.starter.credits} credits a month, Growth ${formatPrice(PLANS.growth.priceUsd)} for ${PLANS.growth.credits}, Pro ${formatPrice(PLANS.pro.priceUsd)} for ${PLANS.pro.credits}. Packs: ${PACKS.pack10.credits} credits for ${formatPrice(PACKS.pack10.priceUsd)}, ${PACKS.pack50.credits} for ${formatPrice(PACKS.pack50.priceUsd)}, valid 90 days.`,
    tags: ["credits"],
  },
  {
    q: "Do I have to label these videos as AI-generated on TikTok?",
    a: "Yes. TikTok requires realistic AI-generated video to carry its AI-generated content label (the toggle under More options when you post), and content that promotes a product you sell needs the commercial content disclosure as well. Unlabeled AI video can be removed, restricted or labeled by TikTok. Every download page repeats these two steps so you never skip them.",
    tags: ["compliance"],
  },
  {
    q: "Can I get a refund?",
    a: "Credits that failed to produce a video are never charged, so the common case needs no refund. For a plan or pack you bought by mistake and have not used, email us within 14 days and we refund it in full. Partly used purchases are refunded for the unused credits at the per-credit price you paid; see the refund policy for the details.",
    tags: ["credits", "account"],
  },
  {
    q: "Which languages can the presenter speak?",
    a: "Eleven: English, Chinese (Mandarin), Spanish, Indonesian, Malay, Thai, Arabic, Portuguese, Vietnamese, Japanese and Korean. The speech is generated natively by the video model, not dubbed, so lip movement matches. The site and the studio are in English.",
    tags: ["product"],
  },
  {
    q: "What product photos work best?",
    a: "Three to five clear photos of the real product from different angles, on a plain background, with the packaging and logo readable. JPEG, PNG or WebP, 300 to 6000 pixels on each side, up to 20 MB each. Photos must not show people. The model shows the product as photographed and never invents it, so what you upload is what the presenter holds.",
    tags: ["product"],
  },
  {
    q: "Are the presenters real people?",
    a: `No. All ${PRESENTERS.length} presenters are fictional personas written by us: a described look, setting and way of speaking, rendered by the video model. None is based on a real person, and we do not accept uploads of faces, so no real likeness is ever used. That is also why they can be labeled honestly as AI-generated.`,
    tags: ["compliance", "product"],
  },
  {
    q: "What happens if a generation fails?",
    a: "You pay nothing. Credits are reserved when the job starts and released back to your balance if the video fails, is cancelled, or times out after two hours. You can retry with the same photos and script, or adjust them first.",
    tags: ["credits", "product"],
  },
  {
    q: "What happens to my photos, scripts and videos?",
    a: "They are stored privately in our own storage, served only through short-lived signed links to you, and sent to the video model only to generate your video. We never publish them, never use them to train anything, and delete a product's photos from storage the moment you delete the product (finished videos stay in your library for their retention period). The privacy policy lists every processor we use.",
    tags: ["account", "general"],
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Open Billing in your studio to manage or cancel your plan in Stripe's portal. Your current credits stay valid until their expiry date; nothing is charged after you cancel.",
    tags: ["credits", "account"],
  },
  {
    q: "Does the video include my TikTok Shop link?",
    a: "The link is not burned into the video; TikTok attaches products through its own product card when you post. Add your shop link to the product in WindowMuse and the download page reminds you to attach that product when you upload, which is what makes the video shoppable.",
    tags: ["product"],
  },
  {
    q: "Can I use the videos commercially?",
    a: "Yes. Every video you generate on a paid plan or pack is yours to use in your own marketing on TikTok and elsewhere, with no attribution to us. Trial videos are 480p and also yours. You remain responsible for the claims in the script and for platform labels and disclosures.",
    tags: ["compliance", "general"],
  },
  {
    q: "When would I need 1080p?",
    a: "720p is what most phones display and what TikTok re-encodes to; it looks sharp on a feed. 1080p is worth it for product close-ups with fine text or texture, or when you will reuse the clip in ads. 1080p costs double and is available on Growth and Pro; the free trial renders at " + TRIAL.resolution + ".",
    tags: ["product", "credits"],
  },
];
