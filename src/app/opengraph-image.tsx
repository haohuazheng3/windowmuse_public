import { ogCard, OG_SIZE } from "@/lib/og";

export const alt = "WindowMuse: your shop window, with a voice. AI presenter videos for TikTok Shop sellers.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "AI presenter videos for TikTok Shop",
    title: "Your shop window, with a voice.",
    subtitle: "Product photos in. A vertical presenter video out, ready to post with your shop link.",
  });
}
