import Link from "next/link";

export const metadata = {
  title: "Termos de Uso — RetornAI",
  description: "Termos de Uso do RetornAI",
};

export default function TermosPage() {
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
        <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-sm text-gray-500 mb-10">Última atualização: maio de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8 text-[15px] leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Objeto</h2>
            <p>
              O RetornAI é uma plataforma de gestão empresarial com inteligência artificial voltada para
              pequenas e médias empresas prestadoras de serviços no Brasil (&ldquo;Plataforma&rdquo;). Estes Termos de
              Uso regem o acesso e uso da Plataforma por pessoas físicas ou jurídicas (&ldquo;Usuário&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Cadastro e Conta</h2>
            <p>
              Para usar o RetornAI, o Usuário deve criar uma conta fornecendo informações verdadeiras,
              completas e atualizadas. O Usuário é responsável por manter a confidencialidade de suas
              credenciais de acesso e por todas as atividades realizadas sob sua conta.
            </p>
            <p className="mt-3">
              O Usuário deve ter ao menos 18 anos de idade ou ser representante legal da empresa cadastrada.
              Contas empresariais (CNPJ) respondem pelas obrigações perante o RetornAI.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Planos e Pagamento</h2>
            <p>
              O RetornAI oferece planos de assinatura mensais (&ldquo;Plano Starter&rdquo; e &ldquo;Plano Pro&rdquo;) com valores,
              funcionalidades e condições descritos na página de preços. O pagamento é processado via
              MercadoPago, conforme os termos do provedor de pagamento.
            </p>
            <p className="mt-3">
              O período de avaliação gratuita, quando oferecido, possui duração definida. Após o término,
              o acesso às funcionalidades pagas será suspenso até a ativação de um plano pago. Cobranças
              são recorrentes e automáticas conforme a periodicidade contratada.
            </p>
            <p className="mt-3">
              Cancelamentos encerram a renovação automática, mas não geram reembolso proporcional pelo
              período em curso, salvo disposição legal em contrário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Responsabilidades do Usuário</h2>
            <p>O Usuário se compromete a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Usar a Plataforma apenas para fins lícitos e em conformidade com a legislação brasileira;</li>
              <li>Não usar a Plataforma para enviar comunicações não solicitadas (spam) ou conteúdo ilegal;</li>
              <li>Obter os consentimentos necessários dos seus clientes para processamento de dados pessoais via WhatsApp e outras integrações;</li>
              <li>Manter atualizados os dados cadastrais;</li>
              <li>Não tentar acessar, copiar ou modificar o código-fonte da Plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Limitação de Responsabilidade</h2>
            <p>
              O RetornAI é fornecido &ldquo;como está&rdquo; e &ldquo;conforme disponível&rdquo;. Não garantimos disponibilidade
              ininterrupta, ausência de erros ou que a Plataforma atenderá a todos os requisitos específicos
              do Usuário.
            </p>
            <p className="mt-3">
              Em nenhuma hipótese o RetornAI será responsável por danos indiretos, lucros cessantes, perda
              de dados ou danos decorrentes do uso ou impossibilidade de uso da Plataforma além dos valores
              pagos pelo Usuário nos últimos 3 meses.
            </p>
            <p className="mt-3">
              O Usuário é o único responsável pelo conteúdo que envia e pelas comunicações realizadas com
              seus clientes via a Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Propriedade Intelectual</h2>
            <p>
              Todos os direitos sobre a Plataforma, incluindo software, marcas, logotipos e conteúdo
              produzido pelo RetornAI, são de propriedade exclusiva do RetornAI. O Usuário recebe
              licença limitada, não exclusiva e intransferível para usar a Plataforma durante a
              vigência da assinatura.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Cancelamento e Encerramento</h2>
            <p>
              O Usuário pode cancelar sua conta a qualquer momento pelo painel de configurações.
              O RetornAI pode suspender ou encerrar contas que violem estes Termos, com ou sem aviso prévio.
            </p>
            <p className="mt-3">
              Após o encerramento, os dados do Usuário serão retidos por até 90 dias para fins de auditoria
              e cumprimento de obrigações legais, após o que serão permanentemente excluídos, salvo
              obrigação legal de retenção superior.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Modificações dos Termos</h2>
            <p>
              Podemos atualizar estes Termos periodicamente. Notificaremos os Usuários por e-mail ou
              aviso na Plataforma com antecedência mínima de 15 dias. O uso continuado da Plataforma
              após a vigência das alterações constitui aceitação dos novos Termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Lei Aplicável</h2>
            <p>
              Estes Termos são regidos pelas leis brasileiras, incluindo o Código de Defesa do Consumidor
              (Lei 8.078/1990), o Marco Civil da Internet (Lei 12.965/2014) e a Lei Geral de Proteção de
              Dados Pessoais — LGPD (Lei 13.709/2018). Fica eleito o foro da Comarca de São Paulo/SP para
              dirimir eventuais controvérsias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contato</h2>
            <p>
              Dúvidas sobre estes Termos podem ser enviadas para{" "}
              <a href="mailto:contato@retornai.com.br" className="text-orange-500 hover:underline">
                contato@retornai.com.br
              </a>.
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
