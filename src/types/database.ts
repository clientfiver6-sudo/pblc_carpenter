export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TrajectoryState = "idle" | "greeting" | "collecting_info" | "booking_in_progress" | "payment_pending" | "closing" | "escalated"

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          name: string;
          type: BusinessType;
          phone: string | null;
          whatsapp_number: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          opening_hours: Json;
          pix_key: string | null;
          pix_key_type: string | null;
          mercadopago_access_token: string | null;
          mercadopago_refresh_token: string | null;
          subscription_plan: string;
          subscription_status: string;
          subscription_ends_at: string | null;
          mp_subscription_id: string | null;
          mp_subscription_payer_id: string | null;
          whatsapp_token: string | null;
          whatsapp_phone_id: string | null;
          whatsapp_client_token: string | null;
          whatsapp_connected_at: string | null;
          whatsapp_ai_enabled: boolean;
          voice_number: string | null;
          call_return_enabled: boolean;
          call_return_template: string | null;
          settings: Json;
          onboarded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["businesses"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Insert"]>;
        Relationships: [];
      };
      business_users: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["business_users"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_users"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          business_id: string;
          full_name: string;
          phone_number: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          notes: string | null;
          tags: string[];
          status: CustomerStatus;
          lead_status: LeadStatus;
          total_spent: number;
          visit_count: number;
          last_visit_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["customers"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      staff: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          role: string | null;
          phone: string | null;
          email: string | null;
          working_hours: Json;
          services: string[];
          color: string;
          active: boolean;
          created_at: string;
          compensation_type: string;
          monthly_salary_cents: number | null;
          commission_rate: number | null;
          payment_day: number | null;
          payment_method: string | null;
          payment_reminder: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["staff"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff"]["Insert"]>;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          price: number | null;
          price_max: number | null;
          category: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["services"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
        Relationships: [];
      };
      work_items: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string | null;
          service_id: string | null;
          assigned_staff_id: string | null;
          type: WorkItemType;
          title: string;
          description: string | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          address: string | null;
          status: WorkItemStatus;
          price_estimate: number | null;
          final_price: number | null;
          payment_status: PaymentStatus;
          notes: string | null;
          internal_notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["work_items"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["work_items"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string | null;
          channel: ConversationChannel;
          status: ConversationStatus;
          ai_active: boolean;
          last_message_at: string;
          unread_count: number;
          metadata: Json;
          created_at: string;
          trajectory_state: TrajectoryState;
        };
        Insert: Omit<Database["public"]["Tables"]["conversations"]["Row"], "id" | "created_at" | "trajectory_state"> & {
          id?: string;
          created_at?: string;
          trajectory_state?: TrajectoryState;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          business_id: string;
          direction: MessageDirection;
          content: string;
          message_type: MessageType;
          whatsapp_message_id: string | null;
          status: MessageStatus;
          sent_by: string | null;
          metadata: Json;
          sent_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      automations: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          trigger_type: AutomationTrigger;
          conditions: Json;
          message_template: string;
          delay_minutes: number;
          active: boolean;
          last_run_at: string | null;
          run_count: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["automations"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["automations"]["Insert"]>;
        Relationships: [];
      };
      automation_logs: {
        Row: {
          id: string;
          automation_id: string;
          business_id: string;
          customer_id: string | null;
          work_item_id: string | null;
          status: AutomationLogStatus;
          message_sent: string | null;
          error: string | null;
          executed_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["automation_logs"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["automation_logs"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          business_id: string;
          work_item_id: string | null;
          customer_id: string | null;
          amount: number;
          method: PaymentMethod;
          status: PaymentTransactionStatus;
          pix_link: string | null;
          pix_qr_code: string | null;
          pix_copy_paste: string | null;
          mercadopago_payment_id: string | null;
          mercadopago_preference_id: string | null;
          description: string | null;
          paid_at: string | null;
          expires_at: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      business_faqs: {
        Row: {
          id: string;
          business_id: string;
          question: string;
          answer: string;
          active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["business_faqs"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_faqs"]["Insert"]>;
        Relationships: [];
      };
      business_skills: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          content: string;
          active: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["business_skills"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_skills"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          business_id: string;
          user_id: string | null;
          type: string;
          title: string;
          body: string;
          read: boolean;
          metadata: Json;
          created_at: string;
          link: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id?: string | null;
          type: string;
          title: string;
          body?: string;
          read?: boolean;
          metadata?: Json;
          created_at?: string;
          link?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      ai_usage_logs: {
        Row: {
          id: string;
          business_id: string;
          function_name: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          cost_usd_cents: number;
          conversation_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ai_usage_logs"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_usage_logs"]["Insert"]>;
        Relationships: [];
      };
      ai_reports: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          prompt: string;
          html_content: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ai_reports"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_reports"]["Insert"]>;
        Relationships: [];
      };
      customer_memories: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          content: string;
          embedding: number[] | null;
          memory_type: "conversation_summary" | "preference" | "complaint" | "note";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["customer_memories"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_memories"]["Insert"]>;
        Relationships: [];
      };
      business_insights: {
        Row: {
          id: string;
          business_id: string;
          insight_type: "weekly_narrative" | "monthly_summary" | "customer_pattern" | "revenue_trend";
          content: string;
          period_start: string;
          period_end: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["business_insights"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_insights"]["Insert"]>;
        Relationships: [];
      };
      ai_approvals: {
        Row: {
          id: string;
          business_id: string | null;
          conversation_id: string | null;
          tool_name: string;
          tool_input: Json;
          status: AiApprovalStatus;
          resolution_note: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["ai_approvals"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_approvals"]["Insert"]>;
        Relationships: [];
      };
      webhook_endpoints: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          provider: string;
          path_suffix: string;
          secret: string | null;
          event_map: Json;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["webhook_endpoints"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["webhook_endpoints"]["Insert"]>;
        Relationships: [];
      };
      customer_attachments: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          work_item_id: string | null;
          file_name: string;
          file_url: string;
          file_type: string;
          uploaded_by: string | null;
          uploaded_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["customer_attachments"]["Row"], "id" | "uploaded_at"> & {
          id?: string;
          uploaded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_attachments"]["Insert"]>;
        Relationships: [];
      };
      business_documents: {
        Row: {
          id: string;
          business_id: string;
          file_name: string;
          file_url: string;
          file_type: string;
          uploaded_at: string;
          analyzed: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["business_documents"]["Row"], "id" | "uploaded_at"> & {
          id?: string;
          uploaded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_documents"]["Insert"]>;
        Relationships: [];
      };
      briefing_cache: {
        Row: {
          id: string;
          business_id: string;
          cache_key: string;
          content: string;
          cached_date: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["briefing_cache"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["briefing_cache"]["Insert"]>;
        Relationships: [];
      };
      maintenance_contracts: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          service_id: string | null;
          title: string;
          description: string | null;
          frequency: string;
          price: number | null;
          next_due_at: string;
          auto_schedule: boolean;
          auto_invoice: boolean;
          active: boolean;
          notes: string | null;
          last_scheduled_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["maintenance_contracts"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["maintenance_contracts"]["Insert"]>;
        Relationships: [];
      };
      equipment: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          name: string;
          brand: string | null;
          model: string | null;
          serial_number: string | null;
          installation_date: string | null;
          location: string | null;
          condition: string;
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["equipment"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["equipment"]["Insert"]>;
        Relationships: [];
      };
      work_item_equipment: {
        Row: {
          id: string;
          work_item_id: string;
          equipment_id: string;
          notes: string | null;
          condition_after: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["work_item_equipment"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["work_item_equipment"]["Insert"]>;
        Relationships: [];
      };
      quotes: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          title: string;
          items: Json;
          subtotal: number;
          discount: number;
          total: number;
          notes: string | null;
          valid_until: string | null;
          status: string;
          approval_token: string | null;
          approved_at: string | null;
          rejected_at: string | null;
          work_item_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["quotes"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
        Relationships: [];
      };
      missed_calls: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string | null;
          call_sid: string | null;
          from_number: string;
          status: string;
          whatsapp_sent: boolean;
          whatsapp_message_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["missed_calls"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["missed_calls"]["Insert"]>;
        Relationships: [];
      };
      team_messages: {
        Row: {
          id: string;
          business_id: string;
          staff_id: string;
          sender_user_id: string;
          content: string;
          read: boolean;
          read_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["team_messages"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_messages"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

// Enum types
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

export type UserRole = "owner" | "manager" | "staff";

export type CustomerStatus = "active" | "inactive" | "blocked";

export type LeadStatus = "new" | "contacted" | "quoted" | "scheduled" | "completed" | "lost";

export type WorkItemType =
  | "appointment"
  | "job"
  | "repair"
  | "quote"
  | "order"
  | "consultation"
  | "service_call";

export type WorkItemStatus =
  | "new"
  | "scheduled"
  | "pending_confirmation"
  | "confirmed"
  | "in_progress"
  | "waiting_customer"
  | "waiting_parts"
  | "completed"
  | "cancelled"
  | "no_show";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

export type PaymentTransactionStatus = "pending" | "paid" | "failed" | "refunded" | "expired";

export type PaymentMethod = "pix" | "cash" | "card" | "transfer";

export type ConversationChannel = "whatsapp" | "manual" | "phone";

export type ConversationStatus = "open" | "waiting" | "resolved" | "bot";

export type MessageDirection = "inbound" | "outbound";

export type MessageType = "text" | "image" | "audio" | "document" | "template" | "system";

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type AutomationTrigger =
  | "booking_created"
  | "booking_confirmed"
  | "booking_24h_before"
  | "booking_completed"
  | "booking_cancelled"
  | "booking_no_show"
  | "payment_pending"
  | "payment_received"
  | "lead_created"
  | "lead_inactive"
  | "customer_inactive";

export type AutomationLogStatus = "sent" | "failed" | "skipped";

// Convenience row types
export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type BusinessInsert = Database["public"]["Tables"]["businesses"]["Insert"];
export type BusinessUpdate = Database["public"]["Tables"]["businesses"]["Update"];

export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
export type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];

export type Staff = Database["public"]["Tables"]["staff"]["Row"];
export type StaffInsert = Database["public"]["Tables"]["staff"]["Insert"];
export type StaffUpdate = Database["public"]["Tables"]["staff"]["Update"];

export type Service = Database["public"]["Tables"]["services"]["Row"];
export type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"];
export type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"];

export type WorkItem = Database["public"]["Tables"]["work_items"]["Row"];
export type WorkItemInsert = Database["public"]["Tables"]["work_items"]["Insert"];
export type WorkItemUpdate = Database["public"]["Tables"]["work_items"]["Update"];

export type MaintenanceContract = Database["public"]["Tables"]["maintenance_contracts"]["Row"];
export type MaintenanceContractInsert = Database["public"]["Tables"]["maintenance_contracts"]["Insert"];
export type MaintenanceContractUpdate = Database["public"]["Tables"]["maintenance_contracts"]["Update"];

export type Equipment = Database["public"]["Tables"]["equipment"]["Row"];
export type EquipmentInsert = Database["public"]["Tables"]["equipment"]["Insert"];
export type EquipmentUpdate = Database["public"]["Tables"]["equipment"]["Update"];

export type Quote = Database["public"]["Tables"]["quotes"]["Row"];
export type QuoteInsert = Database["public"]["Tables"]["quotes"]["Insert"];
export type QuoteUpdate = Database["public"]["Tables"]["quotes"]["Update"];

export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type ConversationInsert = Database["public"]["Tables"]["conversations"]["Insert"];
export type ConversationUpdate = Database["public"]["Tables"]["conversations"]["Update"];

export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
export type MessageUpdate = Database["public"]["Tables"]["messages"]["Update"];

export type Automation = Database["public"]["Tables"]["automations"]["Row"];
export type AutomationInsert = Database["public"]["Tables"]["automations"]["Insert"];
export type AutomationUpdate = Database["public"]["Tables"]["automations"]["Update"];

export type AutomationLog = Database["public"]["Tables"]["automation_logs"]["Row"];
export type AutomationLogInsert = Database["public"]["Tables"]["automation_logs"]["Insert"];

export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"];
export type PaymentUpdate = Database["public"]["Tables"]["payments"]["Update"];

export type BusinessFaq = Database["public"]["Tables"]["business_faqs"]["Row"];
export type BusinessFaqInsert = Database["public"]["Tables"]["business_faqs"]["Insert"];
export type BusinessFaqUpdate = Database["public"]["Tables"]["business_faqs"]["Update"];

export type BusinessSkill = Database["public"]["Tables"]["business_skills"]["Row"];
export type BusinessSkillInsert = Database["public"]["Tables"]["business_skills"]["Insert"];
export type BusinessSkillUpdate = Database["public"]["Tables"]["business_skills"]["Update"];

export type BusinessUser = Database["public"]["Tables"]["business_users"]["Row"];
export type BusinessUserInsert = Database["public"]["Tables"]["business_users"]["Insert"];

// Joined types
export type WorkItemWithRelations = WorkItem & {
  customer?: Customer | null;
  service?: Service | null;
  assigned_staff?: Staff | null;
};

export type ConversationWithCustomer = Conversation & {
  customer?: Customer | null;
  last_message?: Message | null;
};

export type PaymentWithRelations = Payment & {
  work_item?: WorkItem | null;
  customer?: Customer | null;
};

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
export type NotificationUpdate = Database["public"]["Tables"]["notifications"]["Update"];

export type AiReport = Database["public"]["Tables"]["ai_reports"]["Row"];
export type AiReportInsert = Database["public"]["Tables"]["ai_reports"]["Insert"];

export type NotificationType =
  | "new_message"
  | "new_work_item"
  | "payment_received"
  | "payment_due"
  | "work_item_overdue"
  | "automation_sent"
  | "handoff";

export type AiUsageLog = Database["public"]["Tables"]["ai_usage_logs"]["Row"];
export type AiUsageLogInsert = Database["public"]["Tables"]["ai_usage_logs"]["Insert"];

export type CustomerMemory = Database["public"]["Tables"]["customer_memories"]["Row"];
export type CustomerMemoryInsert = Database["public"]["Tables"]["customer_memories"]["Insert"];
export type CustomerMemoryUpdate = Database["public"]["Tables"]["customer_memories"]["Update"];

export type BusinessInsight = Database["public"]["Tables"]["business_insights"]["Row"];
export type BusinessInsightInsert = Database["public"]["Tables"]["business_insights"]["Insert"];
export type BusinessInsightUpdate = Database["public"]["Tables"]["business_insights"]["Update"];

export type AiApprovalStatus = "pending" | "approved" | "rejected";

export type AiApproval = Database["public"]["Tables"]["ai_approvals"]["Row"];
export type AiApprovalInsert = Database["public"]["Tables"]["ai_approvals"]["Insert"];
export type AiApprovalUpdate = Database["public"]["Tables"]["ai_approvals"]["Update"];

export type WebhookEndpoint = Database["public"]["Tables"]["webhook_endpoints"]["Row"];
export type WebhookEndpointInsert = Database["public"]["Tables"]["webhook_endpoints"]["Insert"];
export type WebhookEndpointUpdate = Database["public"]["Tables"]["webhook_endpoints"]["Update"];

// Customer attachments (outside the Database type — added by migration 014)
export interface CustomerAttachment {
  id: string;
  business_id: string;
  customer_id: string;
  work_item_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

// Customer metadata shape
export interface CustomerCustomFields {
  customFields?: Array<{ key: string; value: string }>;
}

export type TeamMessage = Database["public"]["Tables"]["team_messages"]["Row"];
export type TeamMessageInsert = Database["public"]["Tables"]["team_messages"]["Insert"];
export type TeamMessageUpdate = Database["public"]["Tables"]["team_messages"]["Update"];

export type StaffWithStats = Staff & {
  assigned_items: WorkItemWithRelations[];
  completed_count: number;
  payments_due_cents: number;
  unread_messages: number;
};

// ── Medical tier types ────────────────────────────────────────────────────────

export interface MedicalNote {
  id: string; business_id: string; customer_id: string; work_item_id: string | null;
  created_by: string | null; audio_url: string | null; transcript: string | null;
  subjective: string | null; objective: string | null; assessment: string | null;
  plan_text: string | null; raw_note: string | null; created_at: string; updated_at: string;
}

export interface Anamnese {
  id: string; business_id: string; customer_id: string; work_item_id: string | null;
  created_by: string | null; queixas_principais: string | null; historico_medico: string | null;
  alergias: string | null; medicamentos_em_uso: string | null;
  antecedentes_familiares: string | null; habitos_vicios: string | null;
  created_at: string; updated_at: string;
}

export interface Prescription {
  id: string; business_id: string; customer_id: string; work_item_id: string | null;
  created_by: string | null; crm_number: string | null;
  medications: Record<string, unknown>[]; notes: string | null;
  issued_at: string | null; created_at: string;
}

export interface ExamRequest {
  id: string; business_id: string; customer_id: string; work_item_id: string | null;
  created_by: string | null; exam_type: "laboratorial" | "imagem" | "outro";
  exams_requested: Record<string, unknown>[]; clinical_justification: string | null;
  issued_at: string | null; created_at: string;
}
