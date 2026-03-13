import type { ReactNode } from "react";

import { AppWorkspaceLayout } from "@/components/app-workspace-layout";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AppWorkspaceLayout>{children}</AppWorkspaceLayout>;
}
