import https from 'https';

const SUPABASE_URL = process.env.SUPABASE_HOST; // e.g. yourproject.supabase.co
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars: SUPABASE_HOST and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

function restReq(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/' + path,
      method,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(options, res => {
      let b = '';
      res.on('data', d => (b += d));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: b ? JSON.parse(b) : null }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function authReq(path, method, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: SUPABASE_URL,
      path: '/auth/v1/' + path,
      method,
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(options, res => {
      let b = '';
      res.on('data', d => (b += d));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: b ? JSON.parse(b) : null }); }
        catch { resolve({ status: res.statusCode, body: b }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const HOURS = {
  mon: { open: true, start: '08:00', end: '18:00' },
  tue: { open: true, start: '08:00', end: '18:00' },
  wed: { open: true, start: '08:00', end: '18:00' },
  thu: { open: true, start: '08:00', end: '18:00' },
  fri: { open: true, start: '08:00', end: '17:00' },
  sat: { open: true, start: '08:00', end: '12:00' },
  sun: { open: false, start: '09:00', end: '12:00' },
};

const businesses = [
  { id: 'b3000000-0000-0000-0000-000000000003', name: 'TechFrio Climatização', type: 'ac_residential', phone: '(11) 99999-0003', whatsapp_number: '5511999990003', address: 'Rua das Acácias, 450', city: 'São Paulo', state: 'SP', zip_code: '04101-000', opening_hours: HOURS, pix_key: '11999990003', pix_key_type: 'phone', onboarded: true },
  { id: 'b1000000-0000-0000-0000-000000000001', name: 'ClimaCom Comercial', type: 'ac_commercial', phone: '(11) 99999-0001', whatsapp_number: '5511999990001', address: 'Av. Paulista, 1000', city: 'São Paulo', state: 'SP', zip_code: '01310-100', opening_hours: HOURS, pix_key: '11999990001', pix_key_type: 'phone', onboarded: true },
  { id: 'b2000000-0000-0000-0000-000000000002', name: 'FrioCerto Refrigeração', type: 'refrigeration', phone: '(11) 99999-0002', whatsapp_number: '5511999990002', address: 'Rua do Frio, 200', city: 'São Paulo', state: 'SP', zip_code: '04501-000', opening_hours: HOURS, pix_key: '11999990002', pix_key_type: 'phone', onboarded: true },
];

const staff = [
  { id: 's3000000-0000-0000-0000-000000000001', business_id: 'b3000000-0000-0000-0000-000000000003', name: 'Carlos Silva', role: 'Técnico Sênior', color: '#0ea5e9' },
  { id: 's3000000-0000-0000-0000-000000000002', business_id: 'b3000000-0000-0000-0000-000000000003', name: 'Marcos Lima', role: 'Auxiliar Técnico', color: '#3B82F6' },
  { id: 's1000000-0000-0000-0000-000000000001', business_id: 'b1000000-0000-0000-0000-000000000001', name: 'Fernanda Costa', role: 'Técnica Comercial', color: '#f97316' },
  { id: 's2000000-0000-0000-0000-000000000001', business_id: 'b2000000-0000-0000-0000-000000000002', name: 'Roberto Gomes', role: 'Técnico Refrigeração', color: '#8b5cf6' },
];

const services = [
  { id: 'sv300000-0000-0000-0000-000000000001', business_id: 'b3000000-0000-0000-0000-000000000003', name: 'Instalação de Split', duration_minutes: 120, price: 35000 },
  { id: 'sv300000-0000-0000-0000-000000000002', business_id: 'b3000000-0000-0000-0000-000000000003', name: 'Manutenção Preventiva', duration_minutes: 60, price: 18000 },
  { id: 'sv300000-0000-0000-0000-000000000003', business_id: 'b3000000-0000-0000-0000-000000000003', name: 'Limpeza de Ar Condicionado', duration_minutes: 90, price: 12000 },
  { id: 'sv100000-0000-0000-0000-000000000001', business_id: 'b1000000-0000-0000-0000-000000000001', name: 'Instalação Comercial', duration_minutes: 180, price: 80000 },
  { id: 'sv100000-0000-0000-0000-000000000002', business_id: 'b1000000-0000-0000-0000-000000000001', name: 'Manutenção Preventiva', duration_minutes: 90, price: 25000 },
  { id: 'sv200000-0000-0000-0000-000000000001', business_id: 'b2000000-0000-0000-0000-000000000002', name: 'Manutenção Câmara Fria', duration_minutes: 120, price: 45000 },
  { id: 'sv200000-0000-0000-0000-000000000002', business_id: 'b2000000-0000-0000-0000-000000000002', name: 'Recarga de Gás', duration_minutes: 60, price: 15000 },
];

const customers = [
  { id: 'c3000000-0000-0000-0000-000000000001', business_id: 'b3000000-0000-0000-0000-000000000003', full_name: 'Ana Paula Ferreira', phone_number: '5511966660001', lead_status: 'completed', total_spent: 35000, visit_count: 1 },
  { id: 'c3000000-0000-0000-0000-000000000002', business_id: 'b3000000-0000-0000-0000-000000000003', full_name: 'João Mendes', phone_number: '5511966660002', lead_status: 'scheduled', total_spent: 18000, visit_count: 1 },
  { id: 'c3000000-0000-0000-0000-000000000003', business_id: 'b3000000-0000-0000-0000-000000000003', full_name: 'Sandra Oliveira', phone_number: '5511966660003', lead_status: 'completed', total_spent: 47000, visit_count: 2 },
  { id: 'c1000000-0000-0000-0000-000000000001', business_id: 'b1000000-0000-0000-0000-000000000001', full_name: 'Empresa XYZ', phone_number: '5511977770001', lead_status: 'completed', total_spent: 80000, visit_count: 1 },
  { id: 'c1000000-0000-0000-0000-000000000002', business_id: 'b1000000-0000-0000-0000-000000000001', full_name: 'Loja Central', phone_number: '5511977770002', lead_status: 'scheduled', total_spent: 25000, visit_count: 1 },
  { id: 'c2000000-0000-0000-0000-000000000001', business_id: 'b2000000-0000-0000-0000-000000000002', full_name: 'Supermercado Bom Preço', phone_number: '5511988880001', lead_status: 'completed', total_spent: 60000, visit_count: 2 },
];

const demoLinks = [
  { email: 'demo.hvac@retornai.com.br', businessId: 'b3000000-0000-0000-0000-000000000003' },
  { email: 'demo.comercial@retornai.com.br', businessId: 'b1000000-0000-0000-0000-000000000001' },
  { email: 'demo.refrigeracao@retornai.com.br', businessId: 'b2000000-0000-0000-0000-000000000002' },
];

async function main() {
  let r;

  r = await restReq('businesses', 'POST', businesses);
  console.log('businesses:', r.status, Array.isArray(r.body) ? r.body.length + ' rows' : JSON.stringify(r.body).slice(0, 120));

  r = await restReq('staff', 'POST', staff);
  console.log('staff:', r.status);

  r = await restReq('services', 'POST', services);
  console.log('services:', r.status);

  r = await restReq('customers', 'POST', customers);
  console.log('customers:', r.status);

  const listR = await authReq('admin/users?per_page=200', 'GET');
  const users = listR.body?.users ?? [];

  for (const d of demoLinks) {
    const user = users.find(u => u.email === d.email);
    if (!user) { console.log('user not found:', d.email); continue; }
    r = await restReq('business_users', 'POST', [{ user_id: user.id, business_id: d.businessId, role: 'owner' }]);
    console.log('linked', d.email, '->', d.businessId, ':', r.status);
  }

  console.log('Done.');
}

main().catch(console.error);
