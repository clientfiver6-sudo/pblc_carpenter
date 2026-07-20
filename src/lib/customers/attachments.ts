"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessId } from "@/lib/auth/actions";
import type { CustomerAttachment } from "@/types/database";

const BUCKET = "customer-attachments";

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data: buckets } = await admin.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    await admin.storage.createBucket(BUCKET, { public: false });
  }
}

export async function uploadCustomerAttachment(
  formData: FormData
): Promise<{ error?: string; attachment?: CustomerAttachment }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const businessId = await getBusinessId();
  if (!businessId) return { error: "Negócio não encontrado" };

  const file = formData.get("file") as File | null;
  const customerId = formData.get("customer_id") as string | null;
  const workItemId = (formData.get("work_item_id") as string | null) || null;

  if (!file || !customerId) return { error: "Arquivo e cliente são obrigatórios" };
  if (file.size > 20 * 1024 * 1024) return { error: "Arquivo muito grande. Máximo 20 MB." };

  const admin = createAdminClient();
  await ensureBucket(admin);

  const ext = file.name.split(".").pop() ?? "bin";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const storagePath = `${businessId}/${customerId}/${uniqueName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: storageError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (storageError) {
    console.error("uploadCustomerAttachment storage error:", storageError);
    return { error: "Erro ao enviar arquivo. Tente novamente." };
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  const fileUrl = urlData.publicUrl;

  const { data: rawRow, error: dbError } = await admin
    .from("customer_attachments")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      work_item_id: workItemId,
      file_name: file.name,
      file_url: fileUrl,
      file_type: file.type || "application/octet-stream",
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (dbError || !rawRow) {
    console.error("uploadCustomerAttachment db error:", dbError);
    // Attempt to clean up the uploaded file
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { error: "Erro ao salvar referência do arquivo." };
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { attachment: rawRow as CustomerAttachment };
}

export async function deleteCustomerAttachment(
  attachmentId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const businessId = await getBusinessId();
  if (!businessId) return { error: "Negócio não encontrado" };

  const admin = createAdminClient();

  // Fetch the row first to get the storage path and customerId
  const { data: rawRow, error: fetchError } = await admin
    .from("customer_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !rawRow) {
    return { error: "Anexo não encontrado." };
  }

  const row = rawRow as CustomerAttachment;

  // Derive storage path from public URL
  // URL format: .../storage/v1/object/public/customer-attachments/{business_id}/{customer_id}/{file}
  const url = row.file_url;
  const marker = `/object/public/${BUCKET}/`;
  const markerIdx = url.indexOf(marker);
  if (markerIdx !== -1) {
    const storagePath = url.slice(markerIdx + marker.length);
    await admin.storage.from(BUCKET).remove([storagePath]);
  }

  const { error: dbError } = await admin
    .from("customer_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("business_id", businessId);

  if (dbError) {
    console.error("deleteCustomerAttachment db error:", dbError);
    return { error: "Erro ao remover anexo." };
  }

  revalidatePath(`/dashboard/customers/${row.customer_id}`);
  return {};
}

export async function getCustomerAttachments(
  customerId: string
): Promise<CustomerAttachment[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const businessId = await getBusinessId();
  if (!businessId) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customer_attachments")
    .select("*")
    .eq("customer_id", customerId)
    .eq("business_id", businessId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("getCustomerAttachments error:", error);
    return [];
  }

  return (data as CustomerAttachment[]) ?? [];
}

export async function updateCustomerMetadata(
  customerId: string,
  metadata: Record<string, unknown>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("customers")
    .update({ metadata } as never)
    .eq("id", customerId);

  if (error) {
    console.error("updateCustomerMetadata error:", error);
    return { error: "Erro ao salvar dados adicionais." };
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  return {};
}
