// @ts-nocheck
// PROVIUS · Edge Function "convidar"
// Envia (ou reenvia) o convite por email para uma pessoa criar a própria senha.
// Só o administrador consegue usar. Não precisa configurar nada: usa as variáveis
// que o Supabase já coloca em toda função (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
// Como publicar: Supabase > Edge Functions > Deploy a new function > Via Editor >
// nome "convidar" > apague o exemplo, cole este arquivo inteiro > Deploy.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resp = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SETORES = ['Engenharia', 'Projetos', 'Cadastro', 'Gerência'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // quem está chamando?
    const auth = req.headers.get('Authorization') || '';
    const comoUsuario = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await comoUsuario.auth.getUser();
    if (!u?.user) return resp({ erro: 'Entre no Provius de novo.' }, 401);

    const adm = createClient(url, servico, { auth: { persistSession: false } });
    const { data: eu } = await adm.from('perfis').select('id,admin,ativo').eq('id', u.user.id).maybeSingle();
    if (!eu?.admin || !eu?.ativo) return resp({ erro: 'Só o administrador envia convites.' }, 403);

    const b = await req.json();
    const email = String(b.email || '').trim().toLowerCase();
    const nome = String(b.nome || '').trim();
    const setor = String(b.setor || '');
    const site = String(b.site || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resp({ erro: 'Email inválido.' }, 400);

    const { data: existente } = await adm.from('perfis').select('id,senha_ok,nome,setor').eq('email', email).maybeSingle();

    if (b.acao === 'reenviar') {
      if (!existente) return resp({ erro: 'Pessoa não encontrada.' }, 404);
      if (existente.senha_ok) return resp({ erro: 'Essa pessoa já criou a senha. Use "Esqueci a senha" na tela de entrada.' }, 400);
      // apaga o usuário que não chegou a entrar e convida de novo (gera um link novo)
      await adm.auth.admin.deleteUser(existente.id);
      const { data: c, error } = await adm.auth.admin.inviteUserByEmail(email, {
        redirectTo: site, data: { nome: existente.nome, setor: existente.setor } });
      if (error) return resp({ erro: traduz(error.message) }, 400);
      await adm.from('perfis').insert({ id: c.user.id, nome: existente.nome, email, setor: existente.setor,
        convite_enviado: new Date().toISOString(), convite_expira: new Date(Date.now() + 24 * 3600e3).toISOString() });
      return resp({ ok: true });
    }

    if (!nome) return resp({ erro: 'Informe o nome.' }, 400);
    if (!SETORES.includes(setor)) return resp({ erro: 'Escolha o setor.' }, 400);
    if (existente) return resp({ erro: 'Já existe uma pessoa com esse email.' }, 400);

    const { data: c, error } = await adm.auth.admin.inviteUserByEmail(email, { redirectTo: site, data: { nome, setor } });
    if (error) return resp({ erro: traduz(error.message) }, 400);
    const { error: e2 } = await adm.from('perfis').insert({ id: c.user.id, nome, email, setor,
      convite_enviado: new Date().toISOString(), convite_expira: new Date(Date.now() + 24 * 3600e3).toISOString() });
    if (e2) return resp({ erro: e2.message }, 400);
    return resp({ ok: true });
  } catch (e) {
    return resp({ erro: String(e?.message || e) }, 500);
  }
});

function traduz(m: string) {
  if (/rate limit/i.test(m)) return 'Limite de emails por hora do Supabase atingido. Tente de novo mais tarde.';
  if (/already been registered|already registered/i.test(m)) return 'Esse email já tem conta.';
  return m;
}
