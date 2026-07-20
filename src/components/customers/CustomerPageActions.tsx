"use client";

import { ExportButton } from "@/components/customers/ExportButton";
import { ImportDialog } from "@/components/customers/ImportDialog";

interface CustomerPageActionsProps {
  businessId: string;
  availableTags?: string[];
}

export function CustomerPageActions({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  businessId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  availableTags = [],
}: CustomerPageActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <ExportButton />
      <ImportDialog />
    </div>
  );
}
