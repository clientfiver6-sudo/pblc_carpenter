-- Demo seed data for RetornAI
-- Covers two business types: beauty_salon and auto_repair

-- ============================================================
-- BEAUTY SALON: Studio Bella
-- ============================================================

insert into businesses (id, name, type, phone, whatsapp_number, address, city, state, zip_code, opening_hours, pix_key, pix_key_type, onboarded)
values (
  'b1000000-0000-0000-0000-000000000001',
  'Studio Bella',
  'beauty_salon',
  '(11) 99999-0001',
  '5511999990001',
  'Rua das Flores, 123',
  'São Paulo',
  'SP',
  '01310-100',
  '{"mon":{"open":true,"start":"09:00","end":"19:00"},"tue":{"open":true,"start":"09:00","end":"19:00"},"wed":{"open":true,"start":"09:00","end":"19:00"},"thu":{"open":true,"start":"09:00","end":"19:00"},"fri":{"open":true,"start":"09:00","end":"19:00"},"sat":{"open":true,"start":"09:00","end":"16:00"},"sun":{"open":false}}',
  '11999990001',
  'phone',
  true
);

insert into staff (id, business_id, name, role, phone, working_hours, color)
values
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Ana Lima', 'Cabeleireira', '(11) 99999-1001', '{"mon":{"start":"09:00","end":"18:00"},"tue":{"start":"09:00","end":"18:00"},"wed":{"start":"09:00","end":"18:00"},"thu":{"start":"09:00","end":"18:00"},"fri":{"start":"09:00","end":"18:00"}}', '#a855f7'),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Julia Santos', 'Manicure', '(11) 99999-1002', '{"mon":{"start":"09:00","end":"18:00"},"tue":{"start":"09:00","end":"18:00"},"wed":{"start":"09:00","end":"18:00"},"thu":{"start":"09:00","end":"18:00"},"fri":{"start":"09:00","end":"18:00"},"sat":{"start":"09:00","end":"16:00"}}', '#ec4899');

insert into services (id, business_id, name, duration_minutes, price, category)
values
  ('d0100000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Corte Feminino', 60, 80.00, 'Cabelo'),
  ('d0100000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Coloração', 120, 200.00, 'Cabelo'),
  ('d0100000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'Escova Progressiva', 180, 350.00, 'Cabelo'),
  ('d0100000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 'Manicure e Pedicure', 90, 70.00, 'Unhas');

insert into customers (id, business_id, full_name, phone_number, email, tags, lead_status, total_spent, visit_count, last_visit_at)
values
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Maria Oliveira', '5511988880001', 'maria@example.com', '{"VIP","Regular"}', 'completed', 1250.00, 8, now() - interval '15 days'),
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Carla Ferreira', '5511988880002', 'carla@example.com', '{"Nova"}', 'scheduled', 80.00, 1, now() - interval '3 days'),
  ('c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'Patricia Costa', '5511988880003', null, '{"Regular"}', 'completed', 560.00, 4, now() - interval '30 days');

insert into work_items (id, business_id, customer_id, service_id, assigned_staff_id, type, title, scheduled_start, scheduled_end, status, final_price, payment_status)
values
  ('e0100000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'd0100000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'appointment', 'Coloração - Maria Oliveira', now() + interval '2 hours', now() + interval '4 hours', 'confirmed', 200.00, 'unpaid'),
  ('e0100000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'd0100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'appointment', 'Corte Feminino - Carla Ferreira', now() + interval '5 hours', now() + interval '6 hours', 'pending_confirmation', 80.00, 'unpaid'),
  ('e0100000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'd0100000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 'appointment', 'Manicure - Patricia Costa', now() - interval '2 days', now() - interval '2 days' + interval '90 minutes', 'completed', 70.00, 'paid');

insert into business_faqs (business_id, question, answer)
values
  ('b1000000-0000-0000-0000-000000000001', 'Preciso agendar com antecedência?', 'Recomendamos agendar com pelo menos 24h de antecedência para garantir seu horário preferido.'),
  ('b1000000-0000-0000-0000-000000000001', 'Vocês aceitam cartão?', 'Sim! Aceitamos cartão de débito, crédito, Pix e dinheiro.'),
  ('b1000000-0000-0000-0000-000000000001', 'Tem estacionamento?', 'Há vagas na rua. Sem estacionamento próprio.');

-- ============================================================
-- AUTO REPAIR: Oficina do Zé
-- ============================================================

insert into businesses (id, name, type, phone, whatsapp_number, address, city, state, zip_code, opening_hours, pix_key, pix_key_type, onboarded)
values (
  'b2000000-0000-0000-0000-000000000002',
  'Oficina do Zé',
  'auto_repair',
  '(11) 99999-0002',
  '5511999990002',
  'Av. Industrial, 456',
  'São Paulo',
  'SP',
  '02110-000',
  '{"mon":{"open":true,"start":"07:30","end":"18:00"},"tue":{"open":true,"start":"07:30","end":"18:00"},"wed":{"open":true,"start":"07:30","end":"18:00"},"thu":{"open":true,"start":"07:30","end":"18:00"},"fri":{"open":true,"start":"07:30","end":"18:00"},"sat":{"open":true,"start":"07:30","end":"13:00"},"sun":{"open":false}}',
  '11999990002',
  'phone',
  true
);

insert into staff (id, business_id, name, role, color)
values
  ('a2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'José da Silva', 'Mecânico Sênior', '#6b7280'),
  ('a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'Carlos Mendes', 'Eletricista', '#3b82f6');

insert into services (id, business_id, name, duration_minutes, price, price_max, category)
values
  ('d0200000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'Troca de Óleo', 60, 120.00, null, 'Manutenção'),
  ('d0200000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'Revisão Completa', 240, 350.00, null, 'Revisão'),
  ('d0200000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000002', 'Alinhamento e Balanceamento', 60, 100.00, null, 'Pneus'),
  ('d0200000-0000-0000-0000-000000000004', 'b2000000-0000-0000-0000-000000000002', 'Diagnóstico Eletrônico', 60, 150.00, null, 'Diagnóstico');

insert into customers (id, business_id, full_name, phone_number, tags, lead_status, total_spent, visit_count, last_visit_at)
values
  ('c2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'Roberto Alves', '5511977770001', '{"VIP","Fidelizado"}', 'completed', 3200.00, 12, now() - interval '7 days'),
  ('c2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'Fernando Lima', '5511977770002', '{}', 'quoted', 0.00, 0, null),
  ('c2000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000002', 'Marcos Sousa', '5511977770003', '{"Regular"}', 'completed', 1100.00, 5, now() - interval '45 days');

insert into work_items (id, business_id, customer_id, service_id, assigned_staff_id, type, title, status, price_estimate, final_price, payment_status, description)
values
  ('e0200000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'd0200000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'repair', 'Troca de Óleo - Toyota Corolla', 'in_progress', 120.00, null, 'unpaid', 'Óleo 5W30 sintético'),
  ('e0200000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'd0200000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002', 'repair', 'Diagnóstico - VW Gol', 'pending_confirmation', 150.00, null, 'unpaid', 'Luz do motor acesa'),
  ('e0200000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000003', 'd0200000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'repair', 'Revisão 40.000km - Honda Civic', 'completed', 350.00, 380.00, 'paid', null);

insert into automations (business_id, name, trigger_type, message_template, delay_minutes, active)
values
  ('b2000000-0000-0000-0000-000000000002', 'Confirmação de OS', 'booking_created', 'Olá {{customer_name}}! 👋 Sua OS na Oficina do Zé foi registrada. Em breve entraremos em contato para confirmar o prazo. Qualquer dúvida, é só falar!', 0, true),
  ('b2000000-0000-0000-0000-000000000002', 'Serviço Concluído', 'booking_completed', 'Oi {{customer_name}}! Seu veículo está pronto! 🚗✅ O valor ficou em {{price}}. Pode gerar o Pix ou combinar o pagamento conosco.', 0, true);
