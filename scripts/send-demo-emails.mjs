import nodemailer from "nodemailer"

const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD
const TO = process.env.DEMO_EMAIL_TO
const APP_URL = process.env.APP_URL ?? "http://localhost:3000"

if (!EMAIL_USER || !EMAIL_PASSWORD || !TO) {
  console.error("Missing env vars: EMAIL_USER, EMAIL_PASSWORD and DEMO_EMAIL_TO are required.")
  process.exit(1)
}
const BRAND = "#E85D1F"
const BRAND_GRAD = "linear-gradient(135deg,#F97316 0%,#E85D1F 50%,#D63E68 100%)"

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
})

const FROM = `RetornAI <${EMAIL_USER}>`

function fmtBRL(cents) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

const LOGO = `
<table cellpadding="0" cellspacing="0">
  <tr>
    <td style="vertical-align:middle">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:11px;background:rgba(255,255,255,0.20);box-shadow:inset 0 1px 0 rgba(255,255,255,.30);vertical-align:middle">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" width="19" height="19" style="display:block">
          <path d="M5 12c0-4 3-7 7-7s7 3 7 7" />
          <path d="M19 12c0 4-3 7-7 7M14.5 16.5L12 19L14.5 21.5" />
          <circle cx="12" cy="12" r="2.5" fill="white" stroke="none" />
        </svg>
      </span>
    </td>
    <td style="padding-left:10px;vertical-align:middle">
      <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.5px;line-height:1">
        retorn<span style="color:rgba(255,255,255,0.72)">.ai</span>
      </span>
    </td>
  </tr>
</table>`

function emailBase(body) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FBF8F3;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F3;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:540px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 6px 24px -8px rgba(60,40,20,.10),0 1px 2px rgba(30,20,10,.04)">
        <tr>
          <td style="background:${BRAND_GRAD};padding:24px 32px">
            ${LOGO}
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 28px;color:#181613">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px 32px;border-top:1px solid #ECE5D8">
            <p style="margin:0 0 6px;font-size:12px;color:#8C857A">Acesse o painel a qualquer momento:</p>
            <a href="${APP_URL}" style="font-size:13px;color:${BRAND};font-weight:600;text-decoration:none">${APP_URL} →</a>
            <p style="margin:16px 0 0;font-size:11px;color:#B5AE9F;line-height:1.6">
              RetornAI — Sistema de gestão para prestadores de serviço no Brasil.<br>
              Este é um e-mail automático, não é necessário responder.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(text, href = APP_URL) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;background:${BRAND_GRAD};color:#fff;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:14px;letter-spacing:.2px;font-family:'Plus Jakarta Sans',-apple-system,sans-serif">${text}</a>`
}

function infoBox(lines) {
  const rows = lines.map(l => `
    <tr>
      <td style="padding:7px 0;font-size:12px;color:#8C857A;width:130px;vertical-align:top;font-weight:500">${l.label}</td>
      <td style="padding:7px 0;font-size:13px;color:#181613;font-weight:600">${l.value}</td>
    </tr>`).join("")
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;border-radius:12px;padding:16px 20px;margin:20px 0;border:1px solid #ECE5D8">${rows}</table>`
}

async function send(subject, html) {
  await transporter.sendMail({ from: FROM, to: TO, subject, html })
  console.log(`✓ sent: ${subject}`)
}

const demos = [
  {
    subject: "[DEMO] Bem-vindo ao RetornAI, Maria!",
    html: emailBase(`
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">Bem-vindo, Maria! 👋</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
        Sua conta no RetornAI foi criada com sucesso. Agora você tem tudo para gerenciar
        seu negócio com inteligência — agenda, clientes, pagamentos e muito mais.
      </p>
      <p style="margin:0 0 4px;font-size:14px;color:#4F4A42;line-height:1.6">
        Complete a configuração em menos de 5 minutos e já comece a usar.
      </p>
      ${btn("Configurar minha conta agora")}
    `),
  },
  {
    subject: "[DEMO] Barbearia da Maria está no ar — RetornAI",
    html: emailBase(`
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">Tudo pronto! ✦</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
        <strong>Barbearia da Maria</strong> foi configurado com sucesso no RetornAI.
        Seu plano <strong>Pro</strong> já está ativo.
      </p>
      ${infoBox([
        { label: "Negócio", value: "Barbearia da Maria" },
        { label: "Plano", value: "Pro" },
        { label: "Acesso", value: APP_URL },
      ])}
      <p style="margin:0;font-size:14px;color:#4F4A42;line-height:1.6">
        Conecte seu WhatsApp, adicione seus primeiros clientes e configure automações.
      </p>
      ${btn("Acessar meu painel")}
    `),
  },
  {
    subject: "[DEMO] Assinatura confirmada — RetornAI Pro",
    html: emailBase(`
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">Assinatura ativa ✓</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
        O pagamento foi confirmado. Seu plano <strong>Pro</strong> para
        <strong>Barbearia da Maria</strong> está ativo.
      </p>
      ${infoBox([
        { label: "Negócio", value: "Barbearia da Maria" },
        { label: "Plano", value: "Pro" },
        { label: "Próxima cobrança", value: "22/06/2026" },
      ])}
      ${btn("Acessar meu painel")}
    `),
  },
  {
    subject: "[DEMO] Assinatura cancelada — RetornAI",
    html: emailBase(`
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">Assinatura cancelada</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
        Sua assinatura do plano <strong>Pro</strong> para <strong>Barbearia da Maria</strong>
        foi cancelada. Você perderá o acesso ao painel em breve.
      </p>
      <p style="margin:0 0 4px;font-size:14px;color:#4F4A42;line-height:1.6">
        Se foi um engano ou quiser reativar, acesse o painel e renove sua assinatura.
      </p>
      ${btn("Reativar assinatura")}
    `),
  },
  {
    subject: "[DEMO] Problema com pagamento — RetornAI",
    html: emailBase(`
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">Pagamento pendente ⚠️</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
        Não conseguimos processar o pagamento do plano <strong>Pro</strong> para
        <strong>Barbearia da Maria</strong>. Seu acesso pode ser suspenso em breve.
      </p>
      <p style="margin:0 0 4px;font-size:14px;color:#4F4A42;line-height:1.6">
        Acesse o painel para atualizar seu método de pagamento.
      </p>
      ${btn("Atualizar pagamento")}
    `),
  },
  {
    subject: "[DEMO] WhatsApp conectado ao RetornAI",
    html: emailBase(`
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">WhatsApp conectado! 💬</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
        O número <strong>+55 11 99999-0000</strong> foi conectado com sucesso à
        <strong>Barbearia da Maria</strong> no RetornAI.
      </p>
      ${infoBox([
        { label: "Negócio", value: "Barbearia da Maria" },
        { label: "Número", value: "+55 11 99999-0000" },
      ])}
      <p style="margin:0 0 4px;font-size:14px;color:#4F4A42;line-height:1.6">
        Seus clientes já podem enviar mensagens e o RetornAI responde automaticamente.
      </p>
      ${btn("Ver conversas")}
    `),
  },
  {
    subject: "[DEMO] Pagamento confirmado — R$ 150,00",
    html: emailBase(`
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">Pagamento confirmado ✓</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
        Olá, <strong>João Silva</strong>! Seu pagamento foi recebido com sucesso por
        <strong>Barbearia da Maria</strong>.
      </p>
      ${infoBox([
        { label: "Valor", value: fmtBRL(15000) },
        { label: "Descrição", value: "Corte + Barba" },
        { label: "Ref.", value: "pix_abc123def456…" },
      ])}
      ${btn("Ver comprovante")}
    `),
  },
  {
    subject: "[DEMO] Nova mensagem de João Silva — Barbearia da Maria",
    html: emailBase(`
      <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">Nova mensagem 💬</h1>
      <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
        <strong>João Silva</strong> enviou uma mensagem para <strong>Barbearia da Maria</strong>:
      </p>
      <blockquote style="margin:0 0 20px;padding:14px 18px;background:#FFF1E8;border-left:3px solid ${BRAND};border-radius:0 10px 10px 0;font-size:14px;color:#181613;line-height:1.6">
        Oi! Queria saber se tem horário disponível amanhã às 10h para corte e barba?
      </blockquote>
      ${btn("Responder agora")}
    `),
  },
]

console.log(`Sending ${demos.length} demo emails to ${TO}…\n`)
for (const d of demos) {
  await send(d.subject, d.html)
}
console.log("\nAll done!")
