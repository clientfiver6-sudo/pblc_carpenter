"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import type { Customer } from "@/types/database";

interface QuickMessageProps {
  customer: Customer;
  businessId: string;
}

export function QuickMessage({ customer, businessId }: QuickMessageProps) {
  const router = useRouter();
  void businessId;

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full border-border bg-surface text-ink-2 hover:bg-surface-2 gap-2"
      onClick={() => router.push(`/dashboard/conversations?customer=${customer.id}`)}
    >
      <MessageCircle className="w-4 h-4" />
      Enviar Mensagem no WhatsApp
    </Button>
  );
}
