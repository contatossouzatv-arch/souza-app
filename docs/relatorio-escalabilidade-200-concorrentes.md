# Relatorio de Escalabilidade para 200+ Usuarios Simultaneos

Data da analise: 2026-03-29

## Resumo executivo

O app ja tem base suficiente para crescer, mas hoje ele ainda depende de alguns pontos que podem causar lentidao ou picos de carga quando muitas pessoas usam ao mesmo tempo:

- o backend faz parte importante das leituras em tabelas genericas JSONB (`entity_records`) e em alguns endpoints ainda carrega listas grandes para filtrar em memoria;
- o realtime atual invalida queries por grupos amplos, o que pode gerar tempestade de refetch quando um evento acontece;
- existem caches em memoria local no processo Node, o que nao escala bem quando voce sobe mais de uma instancia;
- o frontend do jogo e do perfil carrega assets e experiencias visuais pesadas, o que pode afetar fluidez principalmente em celular intermediario;
- o pool de conexoes do Postgres esta baixo por padrao para um cenario com muitas requisicoes concorrentes.

Conclusao objetiva: para 200 usuarios simultaneos voce nao precisa reescrever tudo, mas precisa endurecer a arquitetura de leitura, reduzir refetch em massa, padronizar Redis em producao e separar melhor os dados de jogo/ranking/deposito dos registros genericos.

## O que encontrei no codigo

### 1. Banco e acesso a dados

- O pool do Postgres esta com default de `10` conexoes em [backend/src/db/index.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/db/index.js#L4), valor baixo para um backend com multiplas rotas concorrentes, queries pesadas e websocket.
- A aplicacao usa bastante a tabela generica `entity_records` com JSONB para entidades criticas de jogo, sorteio, feed, deposito e historico em [backend/src/db/index.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/db/index.js). Isso acelera desenvolvimento, mas piora previsibilidade de performance quando o volume cresce.
- Em `gamification.js` ainda existem leituras amplas como `listEntity("User")` em [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L1890), [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L2799) e consultas administrativas buscando centenas de registros em [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L3774), [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L3775) e [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L3777).
- Tambem ha trechos que leem listas e filtram em memoria por usuario, por exemplo premios e depositos em [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L4068) e [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L4069).
- Em contrapartida, voce ja tem um bom caminho em `user_metric_balances` e indices de ranking em [backend/src/db/index.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/db/index.js), o que mostra que parte da modelagem correta para escalar ja existe.

### 2. Cache e multiplas instancias

- O backend suporta Redis, mas cai para memoria local quando Redis nao existe em [backend/src/lib/cache.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/lib/cache.js) e [backend/src/server.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/server.js).
- Em `gamification.js` ha caches locais em memoria do processo, como `gamificationStateCache`, `weeklyCycleCache` e `profileMetricsCache` em [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L94), [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L105) e [backend/src/routes/gamification.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/gamification.js#L110).
- Isso funciona com 1 instancia, mas com 2 ou mais instancias pode gerar divergencia de cache, aquecimento duplicado e leituras inconsistentes ate a expiracao.

### 3. Realtime e tempestade de refetch

- O app usa websocket e invalida queries por prefixos quando recebe `entity:changed` em [src/lib/RealtimeSync.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/lib/RealtimeSync.jsx#L31) e abre socket em [src/lib/RealtimeSync.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/lib/RealtimeSync.jsx#L106).
- O backend emite `entity:changed` de forma global em [backend/src/routes/entities.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/entities.js#L93), [backend/src/routes/entities.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/entities.js#L115), [backend/src/routes/entities.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/entities.js#L137) e [backend/src/routes/adminEvents.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/adminEvents.js#L27).
- Em cenario de 200 usuarios, um evento de sorteio, deposito aprovado ou premio pode disparar invalidacao para muitos clientes ao mesmo tempo. O risco aqui nao e so CPU do backend, mas um pico em cascata: socket -> invalida query -> dezenas/centenas de GETs simultaneos.
- Ainda existem queries com polling ativo, como `LiveDrawBox` em [src/components/LiveDrawBox.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/components/LiveDrawBox.jsx#L21) e perfil em [src/pages/Profile.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/pages/Profile.jsx#L1330). Polling + websocket ao mesmo tempo aumenta carga sem necessidade.

### 4. Uploads e payloads pesados

- O frontend aceita comprovantes de ate `40 MB` em [src/components/TicketsProgressBox.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/components/TicketsProgressBox.jsx#L18) e pode enviar varios arquivos em paralelo em [src/components/TicketsProgressBox.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/components/TicketsProgressBox.jsx#L318).
- O backend tambem aceita upload de ate `40 MB` em [backend/src/routes/uploads.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/uploads.js#L10) e usa `multer.memoryStorage()` quando Cloudinary esta habilitado em [backend/src/routes/uploads.js](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/backend/src/routes/uploads.js#L185).
- Isso pode pressionar memoria e largura de banda quando varios usuarios sobem comprovantes ou assets ao mesmo tempo.

### 5. Peso visual do frontend

- O jogo principal usa `three` diretamente em [src/pages/DailyEvent.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/pages/DailyEvent.jsx#L2), e o baú 3D cria renderer, texturas e particulas em [src/components/daily-chest/DailyChestScene.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/components/daily-chest/DailyChestScene.jsx#L247), [src/components/daily-chest/DailyChestScene.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/components/daily-chest/DailyChestScene.jsx#L253), [src/components/daily-chest/DailyChestScene.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/components/daily-chest/DailyChestScene.jsx#L274), [src/components/daily-chest/DailyChestScene.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/components/daily-chest/DailyChestScene.jsx#L389) e [src/components/daily-chest/DailyChestScene.jsx](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/src/components/daily-chest/DailyChestScene.jsx#L596).
- O build atual confirmou chunks grandes e muitos assets pesados. O chunk `three-vendor` ficou com `570.53 kB`, ha audios de varios MB e multiplos videos/imagens acima de `1 MB`.
- Isso nao derruba o servidor, mas afeta navegacao fluida, tempo de abertura e consumo de RAM/GPU no celular. Para app tipo jogo, isso e parte do problema de escala percebida.

## Riscos reais para 200+ simultaneos

### Risco alto

- Refetch em massa apos eventos globais de realtime.
- Endpoints de gamificacao/admin puxando muita coisa e filtrando em memoria.
- Redis nao estar obrigatoriamente habilitado em producao.
- Pool de banco pequeno demais para bursts de concorrencia.

### Risco medio

- Uploads pesados pressionando memoria e banda.
- Assets grandes causando travamento em dispositivos medianos.
- Caches locais por processo gerando inconsistencias quando houver mais de 1 instancia.

### Risco baixo a medio

- Logs e invalidações por prefixo usando `SCAN` no Redis; nao e o maior problema agora, mas vira custo sob muita escrita.

## O que precisa ser alterado

### Prioridade 1: obrigatorio antes de divulgar para 200+ simultaneos

1. Tornar `REDIS_URL` obrigatorio em producao.
2. Rodar backend com pelo menos 2 instancias e adapter Redis do Socket.IO ativo.
3. Aumentar e tunar o pool do Postgres.
4. Parar de depender de `listEntity()` para endpoints quentes de jogo/ranking/feed.
5. Substituir invalidacao ampla por eventos mais direcionados.

Implementacao pratica:

- Suba Redis gerenciado e nao permita fallback para memoria em producao.
- Ajuste `DB_POOL_MAX` para algo inicial entre `20` e `40`, sempre validando com o limite do Postgres e quantidade de instancias.
- Para leaderboard semanal, home summary, winnings, profile summary e dynamics summary, use read models persistidos ou consultas SQL dedicadas.
- Em vez de emitir um `entity:changed` generico para todos, emita eventos segmentados como `leaderboard:updated`, `deposit:user:{id}`, `raffle:{id}:changed`, `profile:{id}:summary-updated`.
- No frontend, invalide somente as chaves afetadas, e so para o usuario/area correspondente.

### Prioridade 2: endurecer a modelagem de dados

Separar do `entity_records` pelo menos estas entidades:

- participacoes de sorteio e sorteios ativos;
- feed/likes/comentarios se forem quentes;
- premios do usuario;
- depositos;
- notificacoes do perfil;
- historico de pontuacao e leaderboard.

Motivo:

- fica mais facil indexar;
- cai o custo de parse e filtro em JSONB;
- o planner do Postgres trabalha melhor;
- reduz leitura ampla e filtros em Node.

### Prioridade 3: aliviar o frontend do jogo

- Transformar assets pesados em carregamento sob demanda por tela.
- Reduzir preload automatico de audio/video para telas fora da rota atual.
- Criar modo grafico "baixo/medio/alto" com fallback automatico por dispositivo.
- Aplicar orcamento de bundle por rota do jogo e do perfil.
- Converter imagens maiores para WebP/AVIF quando possivel.

Meta pratica:

- tela inicial e dashboard devem abrir sem depender do chunk 3D;
- assets de jogo devem carregar apenas quando o usuario entrar no modo jogo;
- badge videos e audios de perfil precisam ser lazy, nao acoplados ao caminho principal.

### Prioridade 4: uploads

- Reduzir limite de comprovante para algo como `8 MB` a `12 MB` por imagem.
- Comprimir imagens no cliente antes do upload.
- Limitar concorrencia de upload no frontend para 1 ou 2 por vez.
- Se Cloudinary estiver ativo, evitar arquivos grandes em memoria quando possivel.

## Arquitetura recomendada para 200+ simultaneos

### Backend

- Node/Express em 2 a 3 instancias.
- Redis para cache e adapter Socket.IO.
- Postgres com pool ajustado e indices revisados.
- Read models cacheados para:
  - home summary;
  - dynamics summary;
  - profile summary;
  - weekly leaderboard;
  - winnings summary;
  - deposit leaderboard.

### Realtime

- Websocket para sinalizacao leve.
- HTTP/React Query para buscar dado final somente quando necessario.
- Eventos por escopo, nao broadcast amplo.
- Debounce/aggregation de invalidacoes do lado servidor em janelas curtas de 100 a 300 ms para picos de eventos.

### Banco

- Postgres como fonte de verdade.
- `user_metric_balances` e tabelas derivadas para ranking e saldo.
- `entity_records` apenas para configuracoes e entidades menos quentes, nao para tudo.

## Metas de desempenho sugeridas

- `p95` de rotas quentes abaixo de `300 ms`.
- `p99` abaixo de `700 ms`.
- erro `5xx` abaixo de `0.5%`.
- reconnect de socket abaixo de `2%`.
- tempo de troca de rota percebido no app abaixo de `1.0 s` em celular mediano.
- leaderboard e home summary sempre vindos de read model/cache, nao de recomputacao completa.

## Plano de execucao recomendado

### Fase 1: 2 a 4 dias

- ligar Redis obrigatorio em producao;
- revisar `DB_POOL_MAX`;
- medir rotas quentes com `/health/metrics`;
- remover polling redundante onde ja existe websocket;
- revisar queries que usam `listEntity()` em endpoints de uso frequente.

### Fase 2: 4 a 7 dias

- criar read models SQL/cacheados para home, perfil e leaderboard;
- reduzir broadcast global de `entity:changed`;
- limitar uploads e comprimir imagens.

### Fase 3: 5 a 10 dias

- separar entidades quentes do `entity_records`;
- otimizar bundle e assets do jogo;
- criar perfil grafico adaptativo.

## Testes que faltam para validar de verdade

Hoje existe apenas um smoke test simples em [scripts/loadtest-smoke.mjs](C:/Users/samue/Desktop/APP%20SOUZA%20CASS/scripts/loadtest-smoke.mjs), mas isso nao prova suporte real a 200+ simultaneos.

Voce precisa rodar:

1. teste com `200` usuarios virtuais em rotas de leitura quentes;
2. teste com burst em eventos de sorteio, pontuacao e abertura de baú;
3. teste com uploads concorrentes;
4. teste com 2 instancias de backend e Redis ativo;
5. analise de `p95`, `p99`, erro, CPU, memoria e conexoes do banco.

## Parecer final

O app nao esta "condenado", mas ainda nao esta endurecido para 200+ simultaneos com comportamento de jogo.

Se eu tivesse que resumir em uma frase:

> o maior risco nao e o React sozinho nem o Node sozinho; o maior risco e a combinacao de leituras amplas no backend + invalidacao global no realtime + assets pesados no frontend.

Se voce atacar primeiro read models, Redis obrigatorio, eventos segmentados e peso de assets, a chance de travas e lentidao cai bastante.
