"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { FlowSkeleton } from "./FlowSkeleton";

/** The flow reads session storage on first render, so it is loaded client-side only; the skeleton holds its place. */
const CreateFlow = dynamic(() => import("./CreateFlow").then((m) => m.CreateFlow), { ssr: false, loading: () => <FlowSkeleton /> });

export function CreateFlowLoader(props: ComponentProps<typeof CreateFlow>) {
  return <CreateFlow {...props} />;
}
