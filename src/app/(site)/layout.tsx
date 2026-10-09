import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { organizationLd, websiteLd } from "@/lib/seo";

/*
 * Every public page: no Clerk, no per-request work, so the whole group is static HTML
 * served from the CDN. The Organization and WebSite nodes are emitted once here; pages
 * add their own (FAQPage, HowTo, SoftwareApplication, BreadcrumbList) and reference the
 * organization by its @id.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={[organizationLd(), websiteLd()]} />
      <Header />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer />
    </>
  );
}
