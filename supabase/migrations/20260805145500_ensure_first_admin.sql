-- Garante que o primeiro usuário do sistema tenha role admin.
-- Caso o trigger grant_first_user_admin não tenha disparado corretamente,
-- esta migration insere a role admin para o primeiro usuário cadastrado.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;
