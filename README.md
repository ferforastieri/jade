# Jade — um jardim de memórias

**Jade** é um espaço digital para lembrar, homenagear e compartilhar histórias de quem continua presente na vida de quem ama. O projeto nasceu como uma homenagem à Jade e transformou uma carta e uma flor em um jardim que pode ser visitado.

Ela amava o coelho do Petz; por isso, o site tem um coelhinho original como símbolo e companheiro das salas. A homenagem à Jade e a opção de deixar uma flor ficam juntas na mesma página.

**Visite:** [jade.fer.tec.br](https://jade.fer.tec.br)

## O que você encontra

- Homenagens públicas ou não listadas, com texto, datas e fotografias.
- Salas 3D para passear com um avatar, usando teclado ou toque.
- Flores, livros, velas, lanternas e bancos para decorar uma sala.
- Flores que visitantes podem deixar como gesto de carinho.
- Presença e conversa ao vivo nas salas. As mensagens são temporárias e não ficam armazenadas.
- Uma carta completa para Jade, acompanhada de uma flor na mesma página.

## Tecnologias

- **JavaScript, HTML e CSS** para a aplicação web.
- **Three.js e WebGL** para os ambientes tridimensionais, avatares e animações.
- **Vite** para preparar os recursos do cliente.
- **Cloudflare Workers** para a API e a entrega da aplicação.
- **Cloudflare D1** para contas, homenagens, flores e objetos das salas.
- **Cloudflare R2** para armazenar fotografias.
- **Cloudflare Durable Objects** para presença e conversas em tempo real.

## Arquitetura

O cliente é uma aplicação de página única: `src/main.js` compõe as telas, navegação, formulários e chamadas à API. `src/world.js` cria e anima o jardim 3D com Three.js.

O Worker em `src/worker/index.js` atende às rotas da API, gerencia sessões e valida o conteúdo enviado. Os dados estruturados ficam no D1; as fotografias são validadas e armazenadas no R2. Cada sala usa um Durable Object para coordenar presença, movimento e mensagens ao vivo, sem guardar o histórico do chat.

Os recursos do cliente, incluindo o Three.js, são empacotados junto com a aplicação e servidos pela Cloudflare, sem depender de CDN externa para a experiência 3D.

## Privacidade e cuidado

Homenagens públicas aparecem na exploração do jardim. As não listadas são acessíveis por link. As fotografias passam por validação e remoção de metadados comuns antes de serem armazenadas. As conversas das salas são temporárias; apelidos também são temporários.

As contas usam senhas derivadas no navegador com PBKDF2-SHA-256. As sessões usam cookies `HttpOnly` e `SameSite=Lax`, com `Secure` em conexões HTTPS.

## Estrutura do projeto

| Caminho | Responsabilidade |
| --- | --- |
| `src/main.js` | Telas, navegação e interações da aplicação |
| `src/world.js` | Mundo 3D, personagens, flores e animações |
| `src/worker/index.js` | API, autenticação e salas em tempo real |
| `migrations/` | Esquema e dados iniciais do D1 |
| `public/` | Ícone e recursos estáticos |
