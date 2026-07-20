import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";


const HVAC_BIZ_ID      = "b3000000-0000-0000-0000-000000000003";
const COMERCIAL_BIZ_ID = "b1000000-0000-0000-0000-000000000001";
const REFRIG_BIZ_ID    = "b2000000-0000-0000-0000-000000000002";

// Resolved lazily, not at module load: throwing here would crash `next build`
// (page-data collection imports every route) whenever the env var is absent.
// The GET handler enforces it at request time instead.
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? ""

const DEMO_ACCOUNTS = [
  { email: "demo.hvac@retornai.com.br",         password: DEMO_PASSWORD, businessId: HVAC_BIZ_ID },
  { email: "demo.comercial@retornai.com.br",    password: DEMO_PASSWORD, businessId: COMERCIAL_BIZ_ID },
  { email: "demo.refrigeracao@retornai.com.br", password: DEMO_PASSWORD, businessId: REFRIG_BIZ_ID },
];

const HOURS_DEFAULT = {
  mon: { open: true,  start: "08:00", end: "18:00" },
  tue: { open: true,  start: "08:00", end: "18:00" },
  wed: { open: true,  start: "08:00", end: "18:00" },
  thu: { open: true,  start: "08:00", end: "18:00" },
  fri: { open: true,  start: "08:00", end: "17:00" },
  sat: { open: true,  start: "08:00", end: "12:00" },
  sun: { open: false, start: "09:00", end: "12:00" },
};

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not available in production", { status: 403 })
  }
  // Require a dedicated secret (separate from CRON_SECRET so neither leaking
  // compromises the other) so this can't be triggered by accident
  const token = new URL(req.url).searchParams.get("token") ?? ""
  const seedSecret = process.env.SEED_SECRET ?? ""
  if (!seedSecret) {
    return new Response("SEED_SECRET env var is required to run the seed", { status: 500 })
  }
  if (!token || token !== seedSecret) {
    return new Response("Missing or invalid token", { status: 401 })
  }
  if (!DEMO_PASSWORD) {
    return new Response("SEED_DEMO_PASSWORD env var is required to run the seed", { status: 500 })
  }
  const admin = createAdminClient();
  const log: string[] = [];

  // ── 1. TechFrio — HVAC (pro) ──
  const { error: hvacErr } = await admin.from("businesses").upsert(
    {
      id: HVAC_BIZ_ID,
      name: "TechFrio Climatização",
      type: "ac_residential",
      phone: "(11) 99999-0003",
      whatsapp_number: "5511999990003",
      address: "Rua das Acácias, 450",
      city: "São Paulo",
      state: "SP",
      zip_code: "04101-000",
      opening_hours: HOURS_DEFAULT,
      pix_key: "11999990003",
      pix_key_type: "phone",
      subscription_plan: "pro",
      subscription_status: "active",
      onboarded: true,
    } as never,
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (hvacErr) log.push(`hvac biz upsert: ${hvacErr.message}`);
  else log.push("✓ hvac business ready");

  await admin.from("staff").upsert(
    [
      { id: "a3000000-0000-0000-0000-000000000001", business_id: HVAC_BIZ_ID, name: "Carlos Silva",  role: "Técnico Sênior",   color: "#0ea5e9" },
      { id: "a3000000-0000-0000-0000-000000000002", business_id: HVAC_BIZ_ID, name: "Marcos Lima",   role: "Auxiliar Técnico", color: "#3B82F6" },
    ] as never,
    { onConflict: "id", ignoreDuplicates: true }
  );

  await admin.from("services").upsert(
    [
      { id: "d0300000-0000-0000-0000-000000000001", business_id: HVAC_BIZ_ID, name: "Instalação de Split",        duration_minutes: 120, price: 35000 },
      { id: "d0300000-0000-0000-0000-000000000002", business_id: HVAC_BIZ_ID, name: "Manutenção Preventiva",      duration_minutes:  60, price: 18000 },
      { id: "d0300000-0000-0000-0000-000000000003", business_id: HVAC_BIZ_ID, name: "Limpeza de Ar Condicionado", duration_minutes:  90, price: 12000 },
    ] as never,
    { onConflict: "id", ignoreDuplicates: true }
  );

  await admin.from("customers").upsert(
    [
      { id: "c3000000-0000-0000-0000-000000000001", business_id: HVAC_BIZ_ID, full_name: "Ana Paula Ferreira", phone_number: "5511966660001", lead_status: "completed", total_spent: 35000, visit_count: 1 },
      { id: "c3000000-0000-0000-0000-000000000002", business_id: HVAC_BIZ_ID, full_name: "João Mendes",        phone_number: "5511966660002", lead_status: "scheduled", total_spent: 18000, visit_count: 1 },
      { id: "c3000000-0000-0000-0000-000000000003", business_id: HVAC_BIZ_ID, full_name: "Sandra Oliveira",    phone_number: "5511966660003", lead_status: "completed", total_spent: 47000, visit_count: 2 },
    ] as never,
    { onConflict: "id", ignoreDuplicates: true }
  );

  log.push("✓ hvac seed data ready");

  // ── 2. Elétrica Silva — Eletricista (pro) ──
  const { error: eletricaErr } = await admin.from("businesses").upsert(
    {
      id: COMERCIAL_BIZ_ID,
      name: "Elétrica Silva",
      type: "electrician",
      phone: "(11) 98888-0001",
      whatsapp_number: "5511988880001",
      address: "Rua das Paineiras, 320",
      city: "São Paulo",
      state: "SP",
      zip_code: "02510-000",
      opening_hours: HOURS_DEFAULT,
      pix_key: "11988880001",
      pix_key_type: "phone",
      subscription_plan: "pro",
      subscription_status: "active",
      onboarded: true,
    } as never,
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (eletricaErr) log.push(`eletrica biz upsert: ${eletricaErr.message}`);
  else log.push("✓ eletrica business ready");

  await admin.from("staff").upsert(
    [
      { id: "a1000000-0000-0000-0000-000000000001", business_id: COMERCIAL_BIZ_ID, name: "Marcos Silva",    role: "Eletricista Sênior",  color: "#f59e0b" },
      { id: "a1000000-0000-0000-0000-000000000002", business_id: COMERCIAL_BIZ_ID, name: "João Pereira",    role: "Eletricista",         color: "#fbbf24" },
    ] as never,
    { onConflict: "id", ignoreDuplicates: true }
  );

  await admin.from("services").upsert(
    [
      { id: "d0100000-0000-0000-0000-000000000001", business_id: COMERCIAL_BIZ_ID, name: "Instalação Elétrica",       duration_minutes: 120, price: 28000 },
      { id: "d0100000-0000-0000-0000-000000000002", business_id: COMERCIAL_BIZ_ID, name: "Inspeção e Manutenção",     duration_minutes:  60, price: 15000 },
      { id: "d0100000-0000-0000-0000-000000000003", business_id: COMERCIAL_BIZ_ID, name: "Instalação de Câmeras",     duration_minutes:  90, price: 20000 },
    ] as never,
    { onConflict: "id", ignoreDuplicates: true }
  );

  await admin.from("customers").upsert(
    [
      { id: "c1000000-0000-0000-0000-000000000001", business_id: COMERCIAL_BIZ_ID, full_name: "Roberto Fonseca",    phone_number: "5511977770001", lead_status: "completed", total_spent: 28000, visit_count: 1 },
      { id: "c1000000-0000-0000-0000-000000000002", business_id: COMERCIAL_BIZ_ID, full_name: "Maria das Graças",   phone_number: "5511977770002", lead_status: "scheduled", total_spent: 15000, visit_count: 1 },
      { id: "c1000000-0000-0000-0000-000000000003", business_id: COMERCIAL_BIZ_ID, full_name: "Condomínio Bela Vista", phone_number: "5511977770003", lead_status: "completed", total_spent: 83000, visit_count: 4 },
    ] as never,
    { onConflict: "id", ignoreDuplicates: true }
  );

  log.push("✓ eletrica seed data ready");

  // ── 3. LimpezaFácil — Limpeza (starter) ──
  const { error: limpezaErr } = await admin.from("businesses").upsert(
    {
      id: REFRIG_BIZ_ID,
      name: "LimpezaFácil",
      type: "cleaning",
      phone: "(11) 97777-0002",
      whatsapp_number: "5511977770002",
      address: "Rua Boa Vista, 55",
      city: "São Paulo",
      state: "SP",
      zip_code: "01014-000",
      opening_hours: { ...HOURS_DEFAULT, sat: { open: true, start: "07:00", end: "14:00" }, sun: { open: false, start: "08:00", end: "12:00" } },
      pix_key: "11977770002",
      pix_key_type: "phone",
      subscription_plan: "starter",
      subscription_status: "active",
      onboarded: true,
    } as never,
    { onConflict: "id", ignoreDuplicates: false }
  );
  if (limpezaErr) log.push(`limpeza biz upsert: ${limpezaErr.message}`);
  else log.push("✓ limpeza business ready");

  await admin.from("staff").upsert(
    [
      { id: "a2000000-0000-0000-0000-000000000001", business_id: REFRIG_BIZ_ID, name: "Fernanda Costa",   role: "Líder de Equipe",         color: "#10b981" },
      { id: "a2000000-0000-0000-0000-000000000002", business_id: REFRIG_BIZ_ID, name: "Roberto Dias",     role: "Auxiliar de Limpeza",     color: "#34d399" },
    ] as never,
    { onConflict: "id", ignoreDuplicates: true }
  );

  await admin.from("services").upsert(
    [
      { id: "d0200000-0000-0000-0000-000000000001", business_id: REFRIG_BIZ_ID, name: "Limpeza Residencial",  duration_minutes: 180, price: 20000 },
      { id: "d0200000-0000-0000-0000-000000000002", business_id: REFRIG_BIZ_ID, name: "Limpeza Comercial",    duration_minutes: 240, price: 35000 },
      { id: "d0200000-0000-0000-0000-000000000003", business_id: REFRIG_BIZ_ID, name: "Limpeza Pós-Obra",     duration_minutes: 360, price: 60000 },
    ] as never,
    { onConflict: "id", ignoreDuplicates: true }
  );

  await admin.from("customers").upsert(
    [
      { id: "c2000000-0000-0000-0000-000000000001", business_id: REFRIG_BIZ_ID, full_name: "Ana Beatriz Santos",  phone_number: "5511966550001", lead_status: "completed", total_spent: 40000, visit_count: 3 },
      { id: "c2000000-0000-0000-0000-000000000002", business_id: REFRIG_BIZ_ID, full_name: "Escritório Bravo",    phone_number: "5511966550002", lead_status: "scheduled", total_spent: 35000, visit_count: 1 },
      { id: "c2000000-0000-0000-0000-000000000003", business_id: REFRIG_BIZ_ID, full_name: "Clínica São Lucas",  phone_number: "5511966550003", lead_status: "completed", total_spent: 105000, visit_count: 5 },
    ] as never,
    { onConflict: "id", ignoreDuplicates: true }
  );

  log.push("✓ limpeza seed data ready");

  // ── 4. Auth users — create/link all demo accounts ──
  for (const demo of DEMO_ACCOUNTS) {
    const { data: listData } = await admin.auth.admin.listUsers();
    const existing = listData?.users?.find((u) => u.email === demo.email);

    let userId: string;

    if (existing) {
      userId = existing.id;
      log.push(`✓ user exists: ${demo.email}`);
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: demo.email,
        password: demo.password,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        log.push(`✗ failed to create ${demo.email}: ${createErr?.message ?? "no user returned"}`);
        continue;
      }
      userId = created.user.id;
      log.push(`✓ created user: ${demo.email}`);
    }

    await admin.from("business_users").upsert(
      { user_id: userId, business_id: demo.businessId, role: "owner" } as never,
      { onConflict: "user_id,business_id", ignoreDuplicates: true }
    );
    log.push(`✓ linked ${demo.email} → ${demo.businessId}`);
  }

  // ── 5. Admin user — create admin@retornai.com.br, delete legacy ──
  const { data: listAll } = await admin.auth.admin.listUsers();

  const oldAdmin = listAll?.users?.find((u) => u.email === "admin@admin.com");
  if (oldAdmin) {
    await admin.auth.admin.deleteUser(oldAdmin.id);
    log.push("✓ deleted legacy admin@admin.com");
  }

  const existingAdmin = listAll?.users?.find((u) => u.email === "admin@retornai.com.br");
  if (existingAdmin) {
    log.push("✓ admin exists: admin@retornai.com.br");
  } else {
    const { error: adminErr } = await admin.auth.admin.createUser({
      email: "admin@retornai.com.br",
      password: process.env.SEED_ADMIN_PASSWORD ?? DEMO_PASSWORD,
      email_confirm: true,
    });
    if (adminErr) {
      log.push(`✗ failed to create admin: ${adminErr.message}`);
    } else {
      log.push("✓ created admin: admin@retornai.com.br");
    }
  }

  return NextResponse.json({ ok: true, log });
}
