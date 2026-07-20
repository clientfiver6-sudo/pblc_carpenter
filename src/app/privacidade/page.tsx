import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade — RetornAI",
  description: "Política de Privacidade do RetornAI",
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="border-b border-gray-200 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-lg tracking-tight">
          retorn<span className="text-orange-500">.ai</span>
        </Link>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← Voltar
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-10">Última atualização: maio de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-[15px] leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Quem Somos</h2>
            <p>
              O RetornAI é o controlador dos dados pessoais coletados nesta Plataforma, nos termos da
              Lei Geral de Proteção de Dados Pessoais (LGPD — Lei 13.709/2018). Os dados dos clientes
              finais do Usuário (empresas) são tratados pelo RetornAI na qualidade de <strong>operador</strong>,
              sendo o Usuário o <strong>controlador</strong> desses dados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Dados que Coletamos</h2>
            <p><strong>Dados dos Usuários da Plataforma (empresas):</strong></p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Nome, e-mail e telefone fornecidos no cadastro;</li>
              <li>Dados da empresa (nome, tipo, configurações);</li>
              <li>Dados de faturamento e histórico de assinaturas (processados pelo MercadoPago);</li>
              <li>Logs de acesso e uso da Plataforma;</li>
              <li>Conteúdo criado na Plataforma (clientes, agendamentos, orçamentos, etc.).</li>
            </ul>
            <p className="mt-3"><strong>Dados dos clientes finais (coletados em nome do Usuário):</strong></p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Nome, telefone, e-mail e histórico de atendimento;</li>
              <li>Mensagens trocadas via WhatsApp (quando a integração estiver ativa);</li>
              <li>Dados de equipamentos e contratos de manutenção.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Finalidade e Base Legal (LGPD)</h2>
            <p>Tratamos dados pessoais com as seguintes bases legais:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Execução de contrato</strong> (art. 7º, V) — para prestar os serviços contratados;</li>
              <li><strong>Consentimento</strong> (art. 7º, I) — para comunicações de marketing, quando aplicável;</li>
              <li><strong>Obrigação legal</strong> (art. 7º, II) — para cumprimento de obrigações fiscais e regulatórias;</li>
              <li><strong>Legítimo interesse</strong> (art. 7º, IX) — para melhoria e segurança da Plataforma, desde que não prevaleça sobre os direitos dos titulares.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Compartilhamento de Dados</h2>
            <p>Compartilhamos dados apenas com:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Supabase</strong> (banco de dados e autenticação) — operador de infraestrutura;</li>
              <li><strong>Vercel</strong> (hospedagem) — operador de infraestrutura;</li>
              <li><strong>Anthropic</strong> (API de IA) — processa dados de conversas para gerar respostas automáticas;</li>
              <li><strong>MercadoPago</strong> (pagamentos) — processa dados de cobrança;</li>
              <li><strong>Meta / WhatsApp Business API</strong> — para envio e recebimento de mensagens, quando ativado pelo Usuário.</li>
            </ul>
            <p className="mt-3">
              Não vendemos dados pessoais a terceiros. Compartilhamentos são realizados somente com base
              em contratos de processamento de dados adequados à LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Armazenamento e Segurança</h2>
            <p>
              Os dados são armazenados em servidores localizados nos Estados Unidos (Supabase/AWS, Vercel).
              Adotamos medidas técnicas e organizacionais adequadas para proteger os dados, incluindo
              criptografia em trânsito (TLS) e em repouso, controle de acesso baseado em funções e
              registros de auditoria.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Retenção de Dados</h2>
            <p>
              Mantemos dados pessoais pelo período necessário para cumprir as finalidades para as quais
              foram coletados, ou conforme exigido por lei:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Dados de conta ativa: enquanto a conta estiver ativa;</li>
              <li>Após cancelamento: até 90 dias para fins de auditoria;</li>
              <li>Dados fiscais/contábeis: conforme prazo legal aplicável (mínimo 5 anos).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Direitos do Titular (LGPD, art. 18)</h2>
            <p>Os titulares de dados têm direito a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Confirmar a existência de tratamento;</li>
              <li>Acessar seus dados;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Portabilidade dos dados;</li>
              <li>Revogar consentimento a qualquer momento;</li>
              <li>Opor-se ao tratamento realizado com base em legítimo interesse.</li>
            </ul>
            <p className="mt-3">
              Requisições podem ser enviadas para{" "}
              <a href="mailto:privacidade@retornai.com.br" className="text-orange-500 hover:underline">
                privacidade@retornai.com.br
              </a>. Responderemos em até 15 dias úteis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies e Rastreamento</h2>
            <p>
              Utilizamos cookies de sessão estritamente necessários para o funcionamento da autenticação.
              Não utilizamos cookies de rastreamento de terceiros ou publicidade comportamental.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Encarregado de Proteção de Dados (DPO)</h2>
            <p>
              O encarregado de proteção de dados pode ser contatado em{" "}
              <a href="mailto:privacidade@retornai.com.br" className="text-orange-500 hover:underline">
                privacidade@retornai.com.br
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Alterações nesta Política</h2>
            <p>
              Esta Política pode ser atualizada periodicamente. Notificaremos os Usuários por e-mail
              sobre alterações materiais. A versão mais recente estará sempre disponível nesta página.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-6 py-8 mt-12">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <span>© 2026 RetornAI</span>
          <div className="flex gap-6">
            <Link href="/termos" className="hover:text-gray-900">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-gray-900">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
