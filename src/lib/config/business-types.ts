export type BusinessType =
  | "ac_residential"
  | "ac_commercial"
  | "refrigeration"
  | "electrician"
  | "plumber"
  | "locksmith"
  | "cleaning"
  | "pest_control"
  | "other_service_business";

export type WorkItemType =
  | "appointment"
  | "job"
  | "repair"
  | "quote"
  | "order"
  | "consultation"
  | "service_call";

interface DefaultService {
  name: string;
  duration_minutes: number;
  price: number;
  price_max?: number;
}

interface DefaultFaq {
  question: string;
  answer: string;
}

interface BusinessTypeConfig {
  displayName: string;
  icon: string;
  workItemLabel: string;
  workItemSingular: string;
  customerLabel: string;
  customerSingular: string;
  workItemTypes: WorkItemType[];
  defaultWorkItemType: WorkItemType;
  color: string;
  defaultServices: DefaultService[];
  defaultFaqs: DefaultFaq[];
  defaultAutomationTriggers: string[];
  suggestedStaffRoles: string[];
  aiPersonality: string;
}

export const BUSINESS_TYPE_CONFIG: Record<BusinessType, BusinessTypeConfig> = {
  ac_residential: {
    displayName: "Instalação de Ar Condicionado",
    icon: "❄️",
    workItemLabel: "Chamados",
    workItemSingular: "Chamado",
    customerLabel: "Clientes",
    customerSingular: "Cliente",
    workItemTypes: ["service_call", "job", "quote"],
    defaultWorkItemType: "service_call",
    color: "#0ea5e9",
    defaultServices: [
      { name: "Instalação de Split",        duration_minutes: 120, price: 35000 },
      { name: "Manutenção Preventiva",      duration_minutes:  60, price: 18000 },
      { name: "Limpeza de Ar Condicionado", duration_minutes:  90, price: 12000 },
      { name: "Recarga de Gás",             duration_minutes:  60, price: 25000 },
      { name: "Instalação de Multi-Split",  duration_minutes: 180, price: 55000 },
      { name: "Diagnóstico e Orçamento",    duration_minutes:  30, price:  8000 },
    ],
    defaultFaqs: [
      { question: "Qual o prazo para instalação?",               answer: "Geralmente agendamos em até 2 dias úteis." },
      { question: "Trabalham com qual marca?",                   answer: "Trabalhamos com todas as marcas: Midea, Electrolux, LG, Samsung, Daikin e outras." },
      { question: "A limpeza é necessária com que frequência?",  answer: "Recomendamos limpeza a cada 6 meses para melhor desempenho e durabilidade." },
      { question: "Tem garantia no serviço?",                    answer: "Sim, todos os nossos serviços têm garantia de 90 dias." },
      { question: "Fazem orçamento gratuito?",                   answer: "Sim, orçamento gratuito e sem compromisso." },
    ],
    defaultAutomationTriggers: ["booking_created", "booking_confirmed", "booking_completed", "payment_pending"],
    suggestedStaffRoles: ["Técnico em Climatização", "Auxiliar Técnico", "Instalador", "Vendedor/Atendente"],
    aiPersonality: "Seja direto e técnico. Clientes de ar condicionado querem saber prazo e preço rapidamente. Pergunte o modelo do aparelho e se é instalação nova ou manutenção. Mencione sempre a garantia do serviço.",
  },

  ac_commercial: {
    displayName: "Climatização Comercial",
    icon: "🏢",
    workItemLabel: "Ordens de Serviço",
    workItemSingular: "Ordem de Serviço",
    customerLabel: "Clientes",
    customerSingular: "Cliente",
    workItemTypes: ["job", "service_call", "quote"],
    defaultWorkItemType: "job",
    color: "#3b82f6",
    defaultServices: [
      { name: "Instalação de VRF/VRV",           duration_minutes: 480, price: 250000 },
      { name: "Instalação de Cassete",            duration_minutes: 240, price:  80000 },
      { name: "Manutenção de Sistema Central",    duration_minutes: 180, price:  60000 },
      { name: "Limpeza de Duto",                  duration_minutes: 240, price:  40000 },
      { name: "Projeto de Climatização",          duration_minutes: 480, price: 150000 },
      { name: "Contrato de Manutenção Mensal",    duration_minutes:  60, price:  30000 },
    ],
    defaultFaqs: [
      { question: "Fazem projetos para galpão/loja/escritório?", answer: "Sim, fazemos projetos completos com dimensionamento e laudo técnico." },
      { question: "Emitem ART?",                                  answer: "Sim, todos os projetos incluem ART (Anotação de Responsabilidade Técnica)." },
      { question: "Trabalham com qual BTU?",                      answer: "Trabalhamos com qualquer capacidade, de splits a sistemas VRF de grande porte." },
    ],
    defaultAutomationTriggers: ["booking_created", "booking_confirmed", "booking_completed", "payment_pending"],
    suggestedStaffRoles: ["Engenheiro de Climatização", "Técnico Sênior", "Técnico", "Projetista", "Supervisor"],
    aiPersonality: "Seja técnico e profissional. Clientes comerciais valorizam precisão, prazo e documentação. Pergunte sobre metragem do espaço e se precisam de laudo/ART. Mencione contratos de manutenção.",
  },

  refrigeration: {
    displayName: "Refrigeração Comercial",
    icon: "🧊",
    workItemLabel: "Chamados",
    workItemSingular: "Chamado",
    customerLabel: "Clientes",
    customerSingular: "Cliente",
    workItemTypes: ["service_call", "repair", "job", "quote"],
    defaultWorkItemType: "service_call",
    color: "#06b6d4",
    defaultServices: [
      { name: "Manutenção de Câmara Fria",    duration_minutes: 120, price:  35000 },
      { name: "Recarga de Gás",               duration_minutes:  90, price:  30000 },
      { name: "Reparo de Balcão Refrigerado", duration_minutes: 120, price:  28000 },
      { name: "Instalação de Câmara Fria",    duration_minutes: 720, price: 350000 },
      { name: "Diagnóstico de Emergência",    duration_minutes:  60, price:  15000 },
      { name: "Contrato de Manutenção",       duration_minutes:  60, price:  40000 },
    ],
    defaultFaqs: [
      { question: "Fazem emergência?",          answer: "Sim, atendemos emergências 24h para câmaras frias e equipamentos críticos." },
      { question: "Qual o prazo para reparo?",  answer: "Diagnóstico em até 4 horas. Reparo depende da disponibilidade de peças." },
      { question: "Trabalham com qual gás?",    answer: "Trabalhamos com R-22, R-410A, R-404A e outros gases refrigerantes." },
    ],
    defaultAutomationTriggers: ["booking_created", "booking_confirmed", "booking_completed", "payment_pending"],
    suggestedStaffRoles: ["Técnico em Refrigeração", "Auxiliar Técnico", "Soldador de Cobre", "Atendente"],
    aiPersonality: "Priorize urgência — problemas de refrigeração causam perdas imediatas. Seja ágil e direto. Pergunte sobre o equipamento e se há produtos em risco. Mencione o atendimento de emergência 24h.",
  },

  electrician: {
    displayName: "Eletricista",
    icon: "⚡",
    workItemLabel: "Chamados",
    workItemSingular: "Chamado",
    customerLabel: "Clientes",
    customerSingular: "Cliente",
    workItemTypes: ["service_call", "job", "quote"],
    defaultWorkItemType: "service_call",
    color: "#eab308",
    defaultServices: [
      { name: "Instalação Elétrica Residencial", duration_minutes: 120, price:  25000 },
      { name: "Troca de Disjuntor/Quadro",       duration_minutes:  60, price:  18000 },
      { name: "Tomadas e Interruptores",          duration_minutes:  45, price:   9000 },
      { name: "Instalação de Chuveiro Elétrico",  duration_minutes:  60, price:  12000 },
      { name: "Iluminação e Lustres",             duration_minutes:  60, price:  15000 },
      { name: "Diagnóstico e Orçamento",          duration_minutes:  30, price:   8000 },
    ],
    defaultFaqs: [
      { question: "Fazem instalação em residências e comércios?", answer: "Sim, atendemos residencial e comercial." },
      { question: "Emitem laudo elétrico?",                       answer: "Sim, emitimos laudo e ART quando necessário." },
      { question: "Qual o prazo de atendimento?",                 answer: "Atendemos em até 24h para urgências." },
      { question: "Tem garantia nos serviços?",                   answer: "Sim, garantia de 90 dias em mão de obra." },
    ],
    defaultAutomationTriggers: ["booking_created", "booking_confirmed", "booking_completed", "payment_pending"],
    suggestedStaffRoles: ["Eletricista Sênior", "Eletricista", "Auxiliar Elétrico", "Atendente"],
    aiPersonality: "Seja direto. Pergunte se é residencial ou comercial e descreva o problema. Para emergências (sem luz, curto), sinalize urgência e priorize o atendimento.",
  },

  plumber: {
    displayName: "Encanador",
    icon: "🔩",
    workItemLabel: "Chamados",
    workItemSingular: "Chamado",
    customerLabel: "Clientes",
    customerSingular: "Cliente",
    workItemTypes: ["service_call", "repair", "job", "quote"],
    defaultWorkItemType: "service_call",
    color: "#3b82f6",
    defaultServices: [
      { name: "Desentupimento",                  duration_minutes:  60, price:  15000 },
      { name: "Reparo de Vazamento",             duration_minutes:  90, price:  20000 },
      { name: "Instalação de Torneira/Chuveiro", duration_minutes:  60, price:  12000 },
      { name: "Limpeza de Caixa d'Água",         duration_minutes: 120, price:  25000 },
      { name: "Instalação de Vaso Sanitário",    duration_minutes:  90, price:  18000 },
      { name: "Diagnóstico e Orçamento",         duration_minutes:  30, price:   8000 },
    ],
    defaultFaqs: [
      { question: "Fazem emergência de vazamento?",    answer: "Sim, atendemos emergências em até 2 horas." },
      { question: "Desentupem esgoto e pia?",          answer: "Sim, desentupimos pias, ralos, vasos e esgoto." },
      { question: "Fazem orçamento gratuito?",         answer: "Sim, orçamento sem compromisso no local." },
      { question: "Tem garantia no serviço?",          answer: "Sim, garantia de 90 dias em todos os reparos." },
    ],
    defaultAutomationTriggers: ["booking_created", "booking_confirmed", "booking_completed", "payment_pending"],
    suggestedStaffRoles: ["Encanador Sênior", "Encanador", "Auxiliar", "Atendente"],
    aiPersonality: "Vazamentos são urgência — priorize o atendimento. Pergunte onde está o problema (cozinha, banheiro, esgoto) e se há risco de dano imediato. Mencione o prazo rápido de resposta.",
  },

  locksmith: {
    displayName: "Serralheiro",
    icon: "🔑",
    workItemLabel: "Chamados",
    workItemSingular: "Chamado",
    customerLabel: "Clientes",
    customerSingular: "Cliente",
    workItemTypes: ["service_call", "job", "quote"],
    defaultWorkItemType: "service_call",
    color: "#6b7280",
    defaultServices: [
      { name: "Abertura de Porta",            duration_minutes:  30, price:  15000 },
      { name: "Troca de Fechadura",           duration_minutes:  45, price:  20000 },
      { name: "Cópia de Chave",               duration_minutes:  15, price:   2500 },
      { name: "Instalação de Fechadura",      duration_minutes:  60, price:  25000 },
      { name: "Grade e Portão sob Medida",    duration_minutes: 480, price: 120000 },
      { name: "Cofre — Abertura ou Instalação", duration_minutes: 60, price:  35000 },
    ],
    defaultFaqs: [
      { question: "Atendem 24 horas?",                  answer: "Sim, atendemos 24h para emergências de fechadura." },
      { question: "Fazem abertura de porta sem chave?",  answer: "Sim, sem danificar a fechadura quando possível." },
      { question: "Fazem grade e portão?",               answer: "Sim, fabricamos e instalamos grades e portões sob medida." },
    ],
    defaultAutomationTriggers: ["booking_created", "booking_confirmed", "booking_completed", "payment_pending"],
    suggestedStaffRoles: ["Chaveiro/Serralheiro", "Auxiliar", "Atendente"],
    aiPersonality: "Seja ágil — clientes trancados precisam de resposta rápida. Pergunte se é emergência de trancamento ou serviço programado (troca de fechadura, grade). Para emergências, informe o tempo de chegada.",
  },

  cleaning: {
    displayName: "Limpeza e Higienização",
    icon: "🧹",
    workItemLabel: "Agendamentos",
    workItemSingular: "Agendamento",
    customerLabel: "Clientes",
    customerSingular: "Cliente",
    workItemTypes: ["appointment", "job", "quote"],
    defaultWorkItemType: "appointment",
    color: "#10b981",
    defaultServices: [
      { name: "Limpeza Residencial",          duration_minutes: 180, price:  18000 },
      { name: "Limpeza Comercial",            duration_minutes: 240, price:  30000 },
      { name: "Limpeza Pós-Obra",             duration_minutes: 480, price:  60000 },
      { name: "Higienização de Sofá",         duration_minutes: 120, price:  15000 },
      { name: "Higienização de Colchão",      duration_minutes:  90, price:  12000 },
      { name: "Limpeza de Vidros/Fachada",    duration_minutes: 120, price:  20000 },
    ],
    defaultFaqs: [
      { question: "Trazem os produtos de limpeza?",   answer: "Sim, utilizamos produtos profissionais incluídos no serviço." },
      { question: "Fazem limpeza recorrente?",        answer: "Sim, oferecemos planos semanais, quinzenais e mensais com desconto." },
      { question: "Qual o prazo para agendar?",       answer: "Geralmente agendamos em até 2 dias úteis." },
      { question: "Tem seguro para danos?",           answer: "Sim, nossa equipe é treinada e segurada." },
    ],
    defaultAutomationTriggers: ["booking_created", "booking_confirmed", "booking_completed", "payment_pending"],
    suggestedStaffRoles: ["Faxineiro(a)", "Auxiliar de Limpeza", "Supervisor(a)", "Atendente"],
    aiPersonality: "Seja amigável e organizada. Pergunte o tipo de imóvel (casa, apartamento, comércio), a metragem aproximada e a frequência desejada. Destaque os planos de limpeza recorrente.",
  },

  pest_control: {
    displayName: "Dedetização",
    icon: "🐛",
    workItemLabel: "Chamados",
    workItemSingular: "Chamado",
    customerLabel: "Clientes",
    customerSingular: "Cliente",
    workItemTypes: ["service_call", "job", "quote"],
    defaultWorkItemType: "service_call",
    color: "#84cc16",
    defaultServices: [
      { name: "Dedetização Residencial",    duration_minutes:  90, price:  20000 },
      { name: "Dedetização Comercial",      duration_minutes: 120, price:  35000 },
      { name: "Descupinização",             duration_minutes: 120, price:  30000 },
      { name: "Controle de Ratos",          duration_minutes:  60, price:  25000 },
      { name: "Controle de Baratas",        duration_minutes:  60, price:  18000 },
      { name: "Contrato de Manutenção",     duration_minutes:  60, price:  15000 },
    ],
    defaultFaqs: [
      { question: "Os produtos são seguros para crianças e pets?", answer: "Sim, usamos produtos certificados e orientamos sobre o período de ventilação." },
      { question: "Emitem laudo ou certificado?",                  answer: "Sim, emitimos certificado de dedetização após o serviço." },
      { question: "Quantas aplicações são necessárias?",           answer: "Depende da infestação. Geralmente 1 a 2 aplicações com retorno garantido." },
      { question: "Fazem contrato de manutenção?",                 answer: "Sim, oferecemos contratos trimestrais com visitas preventivas." },
    ],
    defaultAutomationTriggers: ["booking_created", "booking_confirmed", "booking_completed", "payment_pending"],
    suggestedStaffRoles: ["Dedetizador", "Técnico Aplicador", "Supervisor", "Atendente"],
    aiPersonality: "Seja tranquilizador e profissional. Pergunte qual praga e o tamanho do imóvel. Reforce a segurança dos produtos e ofereça o contrato de manutenção preventiva.",
  },

  other_service_business: {
    displayName: "Outro Serviço Local",
    icon: "🔧",
    workItemLabel: "Chamados",
    workItemSingular: "Chamado",
    customerLabel: "Clientes",
    customerSingular: "Cliente",
    workItemTypes: ["service_call", "job", "quote"],
    defaultWorkItemType: "service_call",
    color: "#8B5CF6",
    defaultServices: [],
    defaultFaqs: [],
    defaultAutomationTriggers: ["booking_created", "booking_completed"],
    suggestedStaffRoles: ["Técnico", "Auxiliar", "Atendente"],
    aiPersonality: "Seja profissional e atencioso(a). Pergunte sobre o serviço necessário e o melhor horário para atendimento.",
  },
};

export function getBusinessConfig(type: BusinessType): BusinessTypeConfig {
  return BUSINESS_TYPE_CONFIG[type] ?? BUSINESS_TYPE_CONFIG.other_service_business;
}

export const BUSINESS_TYPE_OPTIONS = [
  { value: "ac_residential" as BusinessType,       label: "Ar Condicionado",        icon: "❄️" },
  { value: "ac_commercial" as BusinessType,        label: "Climatização Comercial",  icon: "🏢" },
  { value: "refrigeration" as BusinessType,        label: "Refrigeração Comercial",  icon: "🧊" },
  { value: "electrician" as BusinessType,          label: "Eletricista",             icon: "⚡" },
  { value: "plumber" as BusinessType,              label: "Encanador",               icon: "🔩" },
  { value: "locksmith" as BusinessType,            label: "Serralheiro",             icon: "🔑" },
  { value: "cleaning" as BusinessType,             label: "Limpeza",                 icon: "🧹" },
  { value: "pest_control" as BusinessType,         label: "Dedetização",             icon: "🐛" },
  { value: "other_service_business" as BusinessType, label: "Outro serviço",         icon: "🔧" },
];

export interface BusinessTerminology {
  clientSingular: string;
  clientPlural: string;
  workItemSingular: string;
  workItemPlural: string;
  appointmentVerb: string;
  aiPersonality: string;
}

export function getTerminology(business: { type: string; settings?: unknown }): BusinessTerminology {
  // 1. Check settings.terminology
  const settings = business.settings as Record<string, unknown> | null;
  const saved = settings?.terminology as BusinessTerminology | undefined;
  if (saved?.clientPlural) return saved;

  // 2. Fall back to BUSINESS_TYPE_CONFIG
  const config = BUSINESS_TYPE_CONFIG[business.type as BusinessType];
  if (config) {
    return {
      clientSingular: config.customerSingular,
      clientPlural: config.customerLabel,
      workItemSingular: config.workItemSingular,
      workItemPlural: config.workItemLabel,
      appointmentVerb: business.type === "ac_commercial" ? "solicitar" : business.type === "cleaning" ? "agendar" : "abrir chamado",
      aiPersonality: config.aiPersonality,
    };
  }

  // 3. Generic fallback
  return {
    clientSingular: "cliente",
    clientPlural: "clientes",
    workItemSingular: "chamado",
    workItemPlural: "chamados",
    appointmentVerb: "abrir chamado",
    aiPersonality: "Seja profissional e prestativo.",
  };
}
