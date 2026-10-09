import { FlowSkeleton } from "@/components/studio/FlowSkeleton";

export default function NewVideoLoading() {
  return (
    <div className="space-y-6">
      <div aria-hidden="true">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton mt-4 h-11 w-72 max-w-full" />
        <div className="skeleton mt-3 h-4 w-full max-w-2xl" />
      </div>
      <FlowSkeleton />
    </div>
  );
}
