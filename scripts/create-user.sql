-- ===========================================
-- Script para criar utilizador no Supabase Auth
-- Executar no SQL Editor do Supabase Dashboard
-- ===========================================

-- IMPORTANTE: Este script cria um utilizador com username/password
-- O utilizador é auto-confirmado (não precisa verificar email)
--
-- CREDENCIAIS DE LOGIN:
--   Utilizador: francisco
--   Password: CHANGE_ME_BEFORE_RUNNING
--
-- (internamente guardado como francisco@faturasai.local)

-- Criar o utilizador
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'francisco@faturasai.local',
  crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf')),
  NOW(), -- email_confirmed_at (auto-confirmado)
  NULL,
  '',
  NULL,
  '',
  NULL,
  '',
  '',
  NULL,
  NULL,
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Francisco"}',
  FALSE,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NULL,
  '',
  0,
  NULL,
  '',
  NULL,
  FALSE,
  NULL
);

-- Criar entrada na tabela de identities (necessário para login)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  id::text,
  NULL,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'francisco@faturasai.local';

-- Verificar se o utilizador foi criado
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'francisco@faturasai.local';
