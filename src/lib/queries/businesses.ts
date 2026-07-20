import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Business,
  BusinessUpdate,
  Service,
  Staff,
  BusinessFaq,
} from "@/types/database";

/**
 * Returns the current user's business using the server Supabase client with RLS.
 * Looks up the business via the business_users join table for the authenticated user.
 */
export async function getMyBusiness(): Promise<Business | null> {
  try {
    const { getCachedUser, getCachedBusinessId } = await import("@/lib/auth/cached")
    const [user, businessId] = await Promise.all([getCachedUser(), getCachedBusinessId()])
    if (!user || !businessId) return null;

    const supabase = await createClient();
    const { data: rawBusiness, error: bizError } = await supabase
      .from("businesses")
      .select("id,name,type,phone,opening_hours,settings,address,city,state,onboarded,subscription_status,mp_subscription_id,whatsapp_number,whatsapp_phone_id,whatsapp_connected_at")
      .eq("id", businessId)
      .single();
    const business = rawBusiness as Business | null;

    if (bizError) {
      console.error("getMyBusiness businesses fetch error:", bizError);
      return null;
    }

    if (!business) return null;
    return business;
  } catch (err) {
    console.error("getMyBusiness unexpected error:", err);
    return null;
  }
}

/**
 * Returns the full AI context for a business: business, services, staff, and FAQs.
 * Uses the server Supabase client with RLS.
 */
export async function getBusinessContext(businessId: string): Promise<{
  business: Business;
  services: Service[];
  staff: Staff[];
  faqs: BusinessFaq[];
} | null> {
  try {
    const supabase = await createClient();

    const [businessResult, servicesResult, staffResult, faqsResult] =
      await Promise.all([
        supabase.from("businesses").select("id,name,type,phone,opening_hours,settings,address,city,state,onboarded,subscription_status").eq("id", businessId).single(),
        supabase
          .from("services")
          .select("id,name,description,duration_minutes,price,price_max,category,active,business_id,created_at")
          .eq("business_id", businessId)
          .eq("active", true),
        supabase
          .from("staff")
          .select("id,name,role,phone,working_hours,services,color,active,business_id,created_at")
          .eq("business_id", businessId)
          .eq("active", true),
        supabase
          .from("business_faqs")
          .select("id,question,answer,category,order_index,active,business_id")
          .eq("business_id", businessId)
          .eq("active", true),
      ]);

    // Hoist data before control-flow narrows businessResult to never
    const businessData = businessResult.data as unknown as Business | null;

    if (businessResult.error) {
      console.error(
        "getBusinessContext businesses fetch error:",
        businessResult.error
      );
      return null;
    }

    if (!businessData) return null;

    if (servicesResult.error) {
      console.error(
        "getBusinessContext services fetch error:",
        servicesResult.error
      );
    }

    if (staffResult.error) {
      console.error(
        "getBusinessContext staff fetch error:",
        staffResult.error
      );
    }

    if (faqsResult.error) {
      console.error(
        "getBusinessContext faqs fetch error:",
        faqsResult.error
      );
    }

    return {
      business: businessData,
      services: (servicesResult.data as Service[] | null) ?? [],
      staff: (staffResult.data as Staff[] | null) ?? [],
      faqs: (faqsResult.data as BusinessFaq[] | null) ?? [],
    };
  } catch (err) {
    console.error("getBusinessContext unexpected error:", err);
    return null;
  }
}

/**
 * Update business settings using the admin client (bypasses RLS).
 * Throws if the update fails.
 */
export async function updateBusinessSettings(
  businessId: string,
  data: BusinessUpdate
): Promise<Business> {
  const admin = createAdminClient();

  const { data: rawBusiness2, error } = await admin
    .from("businesses")
    .update(data as never)
    .eq("id", businessId)
    .select()
    .single();
  const business2 = rawBusiness2 as Business | null;

  if (error) {
    console.error("updateBusinessSettings error:", error);
    throw new Error(`Failed to update business settings: ${error.message}`);
  }

  if (!business2) {
    throw new Error(`Business not found: ${businessId}`);
  }

  return business2;
}
