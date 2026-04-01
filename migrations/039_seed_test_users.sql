-- Migration 039: Seed test users for demo household
-- Upgrades plan to serenite and adds 5 fictitious users

-- Upgrade household plan to serenite (removes member limits)
UPDATE subscriptions
SET plan = 'serenite', updated_at = NOW()
WHERE household_id = 'ed458428-4511-4e43-a2a1-869beba862db';

-- Senior 2 - Marcel Dupont (Jeanne was already created via API)
INSERT INTO household_members (
  id, household_id, user_id, email, first_name, last_name, role, status,
  joined_at, created_at, auth_provider, phone_number,
  perm_manage_journal, perm_manage_appointments, perm_manage_tasks, perm_manage_caregiver_todos,
  perm_manage_members, perm_view_sensitive_info, perm_view_documents, perm_manage_documents
) VALUES (
  gen_random_uuid(),
  'ed458428-4511-4e43-a2a1-869beba862db',
  'proxy_' || gen_random_uuid(),
  NULL,
  'Marcel', 'Dupont',
  'senior', 'active',
  NOW(), NOW(), 'device', '+33698765432',
  false, false, false, false, false, true, true, false
) ON CONFLICT DO NOTHING;

-- Family member - Lucas Dupont
INSERT INTO household_members (
  id, household_id, user_id, email, first_name, last_name, role, status,
  joined_at, created_at, auth_provider, phone_number,
  perm_manage_journal, perm_manage_appointments, perm_manage_tasks, perm_manage_caregiver_todos,
  perm_manage_members, perm_view_sensitive_info, perm_view_documents, perm_manage_documents
) VALUES (
  gen_random_uuid(),
  'ed458428-4511-4e43-a2a1-869beba862db',
  'proxy_' || gen_random_uuid(),
  'lucas.dupont@example.com',
  'Lucas', 'Dupont',
  'family', 'active',
  NOW(), NOW(), 'google', '+33645678901',
  false, true, true, true, false, false, true, false
) ON CONFLICT DO NOTHING;
