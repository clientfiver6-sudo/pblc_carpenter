// Transactional email via Gmail SMTP (nodemailer).
// Requires EMAIL_USER (gmail address) and EMAIL_PASSWORD (App Password).
// All functions are no-ops when EMAIL_USER is not set.
import nodemailer from "nodemailer"

const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD

const transporter = EMAIL_USER && EMAIL_PASSWORD
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
    })
  : null

const FROM = EMAIL_USER ? `RetornAI <${EMAIL_USER}>` : "RetornAI <noreply@retornai.com.br>"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const BRAND = "#E85D1F"

function fmtBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// ── Shared branded wrapper ────────────────────────────────────────────────────

function emailBase(body: string): string {
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

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#F97316 0%,#E85D1F 50%,#D63E68 100%);padding:24px 32px">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle">
                  <!-- Brand tile -->
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
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 28px;color:#181613">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px 32px;border-top:1px solid #ECE5D8">
            <p style="margin:0 0 6px;font-size:12px;color:#8C857A">
              Acesse o painel a qualquer momento:
            </p>
            <a href="${APP_URL}" style="font-size:13px;color:${BRAND};font-weight:600;text-decoration:none">
              ${APP_URL} →
            </a>
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

function primaryButton(text: string, href: string = APP_URL): string {
  return `<a href="${href}"
    style="display:inline-block;margin-top:20px;background:linear-gradient(135deg,#F97316 0%,#E85D1F 50%,#D63E68 100%);
           color:#fff;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px;
           font-size:14px;letter-spacing:.2px;font-family:'Plus Jakarta Sans',-apple-system,sans-serif">
    ${text}
  </a>`
}

function infoBox(lines: Array<{ label: string; value: string }>): string {
  const rows = lines.map(l => `
    <tr>
      <td style="padding:7px 0;font-size:12px;color:#8C857A;width:130px;vertical-align:top;font-weight:500">${l.label}</td>
      <td style="padding:7px 0;font-size:13px;color:#181613;font-weight:600">${l.value}</td>
    </tr>`).join("")
  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="background:#F5F0E8;border-radius:12px;padding:16px 20px;margin:20px 0;border:1px solid #ECE5D8">${rows}</table>`
}

async function send(to: string, subject: string, html: string) {
  if (!transporter) return
  await transporter.sendMail({ from: FROM, to, subject, html })
    .catch((err: unknown) => console.error("[email] send failed:", err))
}

// ── Welcome (after signup) ────────────────────────────────────────────────────

export async function sendWelcomeEmail(opts: { to: string; name: string }) {
  const { to } = opts
  const firstName = esc(opts.name.split(" ")[0])
  await send(to, `Bem-vindo ao RetornAI, ${opts.name.split(" ")[0]}!`, emailBase(`
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">
      Bem-vindo, ${firstName}! 👋
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
      Sua conta no RetornAI foi criada com sucesso. Agora você tem tudo para gerenciar
      seu negócio com inteligência — agenda, clientes, pagamentos e muito mais.
    </p>
    <p style="margin:0 0 4px;font-size:14px;color:#4F4A42;line-height:1.6">
      Complete a configuração em menos de 5 minutos e já comece a usar.
    </p>
    ${primaryButton("Configurar minha conta agora")}
  `))
}

// ── Setup complete (after wizard finalization) ────────────────────────────────

export async function sendSetupCompleteEmail(opts: { to: string; businessName: string; plan: string }) {
  const { to } = opts
  const businessName = esc(opts.businessName)
  const plan = esc(opts.plan)
  const firstName = businessName.split(" ")[0]
  await send(to, `${opts.businessName} está no ar — RetornAI`, emailBase(`
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">
      Tudo pronto! ✦
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
      <strong>${businessName}</strong> foi configurado com sucesso no RetornAI.
      Seu plano <strong>${plan}</strong> já está ativo.
    </p>
    ${infoBox([
      { label: "Negócio", value: businessName },
      { label: "Plano", value: plan },
      { label: "Acesso", value: APP_URL },
    ])}
    <p style="margin:0;font-size:14px;color:#4F4A42;line-height:1.6">
      O que fazer agora? Conecte seu WhatsApp, adicione seus primeiros clientes e
      configure automações para que o RetornAI trabalhe por você.
    </p>
    ${primaryButton(`Acessar ${firstName}`)}
  `))
}

// ── Subscription confirmed ────────────────────────────────────────────────────

export async function sendSubscriptionConfirmationEmail(opts: {
  to: string; businessName: string; plan: string; endsAt?: string
}) {
  const { to, endsAt } = opts
  const businessName = esc(opts.businessName)
  const plan = esc(opts.plan)
  const renewalLine = endsAt
    ? { label: "Próxima cobrança", value: new Date(endsAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) }
    : null
  await send(to, `Assinatura confirmada — RetornAI ${opts.plan}`, emailBase(`
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">
      Assinatura ativa ✓
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
      O pagamento foi confirmado. Seu plano <strong>${plan}</strong> para
      <strong>${businessName}</strong> está ativo e todos os recursos estão liberados.
    </p>
    ${infoBox([
      { label: "Negócio", value: businessName },
      { label: "Plano", value: plan },
      ...(renewalLine ? [renewalLine] : []),
    ])}
    ${primaryButton("Acessar meu painel")}
  `))
}

// ── Subscription cancelled ────────────────────────────────────────────────────

export async function sendSubscriptionCancelledEmail(opts: {
  to: string; businessName: string; plan: string
}) {
  const { to } = opts
  const businessName = esc(opts.businessName)
  const plan = esc(opts.plan)
  await send(to, `Assinatura cancelada — RetornAI`, emailBase(`
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">
      Assinatura cancelada
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
      Sua assinatura do plano <strong>${plan}</strong> para <strong>${businessName}</strong>
      foi cancelada. Você perderá o acesso ao painel em breve.
    </p>
    <p style="margin:0 0 4px;font-size:14px;color:#4F4A42;line-height:1.6">
      Se foi um engano ou quiser reativar, acesse o painel e renove sua assinatura.
    </p>
    ${primaryButton("Reativar assinatura")}
  `))
}

// ── Subscription payment failed ───────────────────────────────────────────────

export async function sendSubscriptionPastDueEmail(opts: {
  to: string; businessName: string; plan: string
}) {
  const { to } = opts
  const businessName = esc(opts.businessName)
  const plan = esc(opts.plan)
  await send(to, `Problema com pagamento — RetornAI`, emailBase(`
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">
      Pagamento pendente ⚠️
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
      Não conseguimos processar o pagamento do plano <strong>${plan}</strong> para
      <strong>${businessName}</strong>. Seu acesso pode ser suspenso em breve.
    </p>
    <p style="margin:0 0 4px;font-size:14px;color:#4F4A42;line-height:1.6">
      Acesse o painel para atualizar seu método de pagamento e regularizar a situação.
    </p>
    ${primaryButton("Atualizar pagamento")}
  `))
}

// ── WhatsApp connected ────────────────────────────────────────────────────────

export async function sendWhatsAppConnectedEmail(opts: {
  to: string; businessName: string; phone: string
}) {
  const { to } = opts
  const businessName = esc(opts.businessName)
  const phone = esc(opts.phone)
  await send(to, `WhatsApp conectado ao RetornAI`, emailBase(`
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">
      WhatsApp conectado! 💬
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
      O número <strong>${phone}</strong> foi conectado com sucesso ao
      <strong>${businessName}</strong> no RetornAI.
    </p>
    ${infoBox([
      { label: "Negócio", value: businessName },
      { label: "Número", value: phone },
    ])}
    <p style="margin:0 0 4px;font-size:14px;color:#4F4A42;line-height:1.6">
      Seus clientes já podem enviar mensagens e o RetornAI responde automaticamente.
      Configure automações e respostas no painel.
    </p>
    ${primaryButton("Ver conversas")}
  `))
}

// ── Payment received (from customer) ─────────────────────────────────────────

export async function sendPaymentReceivedEmail(opts: {
  to: string; customerName: string; businessName: string
  amount: number; description: string; paymentId: string
}) {
  const { to, amount } = opts
  const customerName = esc(opts.customerName)
  const businessName = esc(opts.businessName)
  const description = esc(opts.description)
  const paymentRef = esc(opts.paymentId.slice(0, 16)) + "…"
  await send(to, `Pagamento confirmado — ${fmtBRL(amount)}`, emailBase(`
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">
      Pagamento confirmado ✓
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
      Olá, <strong>${customerName}</strong>! Seu pagamento foi recebido com sucesso por
      <strong>${businessName}</strong>.
    </p>
    ${infoBox([
      { label: "Valor", value: fmtBRL(amount) },
      { label: "Descrição", value: description },
      { label: "Ref.", value: paymentRef },
    ])}
    ${primaryButton("Ver comprovante")}
  `))
}

// ── New WhatsApp message notification ─────────────────────────────────────────

export async function sendNewMessageNotificationEmail(opts: {
  to: string; businessName: string; customerName: string
  messagePreview: string; conversationUrl: string
}) {
  const { to, conversationUrl } = opts
  const businessName = esc(opts.businessName)
  const customerName = esc(opts.customerName)
  const raw = opts.messagePreview.slice(0, 280) + (opts.messagePreview.length > 280 ? "…" : "")
  const preview = esc(raw)
  await send(to, `Nova mensagem de ${opts.customerName} — ${opts.businessName}`, emailBase(`
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#181613">
      Nova mensagem 💬
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#4F4A42;line-height:1.6">
      <strong>${customerName}</strong> enviou uma mensagem para <strong>${businessName}</strong>:
    </p>
    <blockquote style="margin:0 0 20px;padding:14px 18px;background:#f7f5f2;border-left:3px solid ${BRAND};
                       border-radius:0 10px 10px 0;font-size:14px;color:#333;line-height:1.6">
      ${preview}
    </blockquote>
    ${primaryButton("Responder agora", conversationUrl)}
  `))
}
