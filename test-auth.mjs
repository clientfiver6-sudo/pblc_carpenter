const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY || !DEMO_PASSWORD || !ADMIN_PASSWORD) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SEED_DEMO_PASSWORD and TEST_ADMIN_PASSWORD are required.");
  process.exit(1);
}

const ACCOUNTS = [
  { label: "TechFrio  (HVAC)",        email: "demo.hvac@retornai.com.br",         password: DEMO_PASSWORD, expectBiz: "b3000000-0000-0000-0000-000000000003" },
  { label: "ClimaCom  (Comercial)",   email: "demo.comercial@retornai.com.br",    password: DEMO_PASSWORD, expectBiz: "b1000000-0000-0000-0000-000000000001" },
  { label: "FrioCerto (Refrigeração)",email: "demo.refrigeracao@retornai.com.br", password: DEMO_PASSWORD, expectBiz: "b2000000-0000-0000-0000-000000000002" },
  { label: "Admin",                   email: "admin@retornai.com.br",             password: ADMIN_PASSWORD, expectBiz: null },
];

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

async function getBusinessForUser(userId, accessToken) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/business_users?user_id=eq.${userId}&select=business_id,role,businesses(id,name,type,onboarded,subscription_plan,subscription_status)`,
    { headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${accessToken}` } }
  );
  return res.json();
}

console.log("\n=== AUTH + BUSINESS VERIFICATION ===\n");

for (const acct of ACCOUNTS) {
  const auth = await signIn(acct.email, acct.password);

  if (auth.error || !auth.access_token) {
    console.log(`✗  ${acct.label}`);
    console.log(`   email: ${acct.email}`);
    console.log(`   ERROR: ${auth.error_description ?? auth.error ?? JSON.stringify(auth).slice(0,100)}`);
    console.log();
    continue;
  }

  const userId = auth.user?.id;
  const bizRows = await getBusinessForUser(userId, auth.access_token);

  const biz = bizRows?.[0]?.businesses;

  let bizStatus = "";
  if (acct.expectBiz === null) {
    bizStatus = bizRows?.length === 0 ? "✓ no business row (correct for admin)" : `⚠ has ${bizRows.length} business(es)`;
  } else if (!biz) {
    bizStatus = `✗ business row NOT found (expected ${acct.expectBiz})`;
  } else {
    const planOk = biz.subscription_plan ? `plan=${biz.subscription_plan} status=${biz.subscription_status}` : "⚠ no plan columns";
    bizStatus = `✓ ${biz.name} (${biz.type}) onboarded=${biz.onboarded} ${planOk}`;
  }

  console.log(`✓  ${acct.label}`);
  console.log(`   email : ${acct.email}`);
  console.log(`   userId: ${userId}`);
  console.log(`   biz   : ${bizStatus}`);
  console.log();
}
