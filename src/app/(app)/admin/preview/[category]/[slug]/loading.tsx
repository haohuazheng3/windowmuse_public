import { Container, SkeletonLines } from "@/components/ui";

/** Skeleton in the article's shape: breadcrumb, title, meta line, then the body pane. */
export default function PreviewLoading() {
  return (
    <Container className="pt-8 sm:pt-12">
      <div className="skeleton h-4 w-56" />
      <div className="mt-8 max-w-3xl space-y-3">
        <div className="skeleton h-3 w-28" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-4/5" />
        <div className="skeleton mt-2 h-5 w-3/4" />
        <div className="skeleton h-3 w-64" />
      </div>
      <div className="pane mt-8 px-5 py-8 sm:px-10 sm:py-12">
        <SkeletonLines lines={6} />
        <SkeletonLines lines={5} className="mt-8" />
      </div>
    </Container>
  );
}
