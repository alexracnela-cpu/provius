# Provius · Gestão de Projetos

Acompanhamento do fluxo de projetos de iluminação pública: Pedido (Engenharia) → Projetos → Execução (Engenharia) → Cadastro (plaquetas) → As built → envio à AGEMAN.

- Site: https://alexracnela-cpu.github.io/provius/
- Banco de dados, login e PDFs: Supabase (projeto próprio do Provius).
- `lote.html`: página pública do link do lote (a AGEMAN baixa os PDFs do envio sem login; o link vai na carta).
- `.github/workflows/manter-acordado.yml`: consulta diária ao banco para o plano gratuito do Supabase não pausar o projeto.
- `supabase/functions/convidar`: função que envia os convites por email (cole no editor de Edge Functions do Supabase).

Os arquivos SQL do banco e o histórico da planilha não ficam neste repositório, porque ele é público.
