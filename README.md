# JADE

Um jardim de memórias: homenagens públicas ou não listadas, salas visitáveis em WebGL, flores e objetos para guardar lembranças.

Aplicação e dados rodam na Cloudflare:

- **Workers** para a aplicação e API;
- **D1** para contas, homenagens, flores e objetos;
- **R2** para fotografias;
- **Durable Objects** para presença e conversa em tempo real por sala;
- **Three.js/WebGL** para as salas 3D (empacotado localmente, sem CDN externa).

## Rodar localmente

Requisitos: Node.js 20+ e npm.

```sh
npm install
cp .dev.vars.example .dev.vars
# troque o valor de PASSWORD_PEPPER por um segredo aleatório local
npm run db:local
npm run dev
```

Abra `http://localhost:8790` (ou o endereço mostrado pelo Wrangler). O D1, o R2 e os Durable Objects locais são isolados dos recursos remotos. Nenhuma foto de teste vai para a nuvem.

## Preparar Cloudflare

1. Entre na conta com `npx wrangler login`.
2. Crie os recursos, se ainda não existirem:

   ```sh
   npx wrangler d1 create jade
   npx wrangler r2 bucket create jade-media
   ```

3. Copie o `database_id` retornado para `wrangler.jsonc` (substituindo o UUID de desenvolvimento).
4. Aplique a migration, publique e configure o segredo do Worker:

   ```sh
   npm run db:remote
   npm run deploy
   npx wrangler secret put PASSWORD_PEPPER
   ```

O domínio `jade.fer.tec.br` está declarado como custom domain no Wrangler. Ele só será associado quando a zona `fer.tec.br` estiver disponível na mesma conta Cloudflare e o deploy for executado. Não coloque tokens ou senhas no repositório; use `wrangler login` ou secrets do Worker.

## O que já está coberto

- Visitantes podem explorar homenagens públicas ou abrir homenagens não listadas pelo link; os links criados usam identificadores aleatórios de 128 bits.
- É necessária uma conta para criar e editar. A senha é derivada no navegador com PBKDF2-SHA-256 (600 mil iterações); o Worker armazena um verificador HMAC protegido por `PASSWORD_PEPPER`. A sessão usa cookie `HttpOnly`, `Secure` (em HTTPS) e `SameSite=Lax`.
- Os dados das pessoas usuárias e homenagens ficam no D1; fotos JPEG/PNG/WebP são limitadas por tamanho e dimensões, removidas de metadados comuns e armazenadas no R2.
- Uma homenagem pode ser uma página simples ou uma sala 3D. Na sala, cada pessoa caminha com seu avatar; presença e chat são ao vivo, apelidos são temporários, mensagens não são guardadas e o criador pode remover visitantes. O chat limita tamanho e frequência, e bloqueia links.
- O autor pode posicionar flores, livros, velas, lanternas e bancos; qualquer visitante pode deixar uma flor.
- A página inicial explica por que o jardim foi criado, reúne a homenagem à Jade e permite deixar uma flor sem sair da página. A sala da Jade mantém a carta completa e o jogo 3D.
- O coelhinho original do Jade, inspirado no coelho do Petz que ela amava, aparece na identidade visual e como companheiro animado da sala.

## Limites importantes do primeiro MVP

O cadastro ainda não confirma e-mails nem oferece recuperação de senha; quem esquecer a senha não conseguirá recuperar a conta sem suporte manual. O segredo `PASSWORD_PEPPER` é obrigatório e deve permanecer estável: guarde-o no Cloudflare Secrets, não no Git. O chat é moderado pelo criador durante a visita, mas não possui histórico nem denúncias persistentes. Uma foto real da Jade não foi encontrada no repositório; a sala usa elementos gerados em WebGL, sem inventar uma imagem pessoal.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Cria o build e inicia o Worker com bindings locais |
| `npm run build` | Gera os assets em `dist/` |
| `npm run db:local` | Aplica migrations ao D1 local |
| `npm run db:remote` | Aplica migrations ao D1 remoto |
| `npm run deploy` | Gera o build e publica o Worker |
