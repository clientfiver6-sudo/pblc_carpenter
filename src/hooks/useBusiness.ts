"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import {
  getBusinessConfig,
  type BusinessType,
} from "@/lib/config/business-types";
import type { Database } from "@/types/database";

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];

interface UseBusinessReturn {
  business: BusinessRow | null;
  loading: boolean;
  businessConfig: ReturnType<typeof getBusinessConfig> | null;
}

export function useBusiness(): UseBusinessReturn {
  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchBusiness() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: rawBusinessUser } = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", user.id)
        .single();
      const businessUser = rawBusinessUser as { business_id: string } | null;

      if (!businessUser) {
        setLoading(false);
        return;
      }

      const { data: rawBiz } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", businessUser.business_id)
        .single();
      const biz = rawBiz as BusinessRow | null;

      setBusiness(biz);
      setLoading(false);
    }

    fetchBusiness();
  }, []);

  const businessConfig = business
    ? getBusinessConfig(business.type as BusinessType)
    : null;

  return { business, loading, businessConfig };
}
