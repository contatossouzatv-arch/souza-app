# Mapa Funcional do App

Data: 2026-03-29

Este documento lista as funcoes de negocio que existem hoje no app, separadas por:

- funcoes do usuario comum;
- funcoes do admin;
- logica principal de cada modulo.

Observacao: este mapa cobre as funcoes de produto e operacao. Nao lista utilitarios internos pequenos de UI.

## 1. Navegacao principal do app

Pelo frontend, as areas principais sao:

- `Dashboard`: sorteios e dinamicas ativas.
- `Home`: feed de avisos, posts e ganhadores.
- `Deposits`: depositos, bilhetes, ciclos e historico.
- `Profile`: perfil, social, gamificacao, premios e check-in.
- `Settings`: conta, avatar/foto, seguranca e preferencias.
- `AdminPanel`: painel administrativo completo.
- `DailyChestHub`: baú diario 3D.
- `MainGameComingSoon`: placeholder do jogo principal.

## 2. O que o usuario faz hoje

## 2.1 Conta e acesso

### Funcoes

- criar conta com email, senha, nome e telefone;
- fazer login por senha;
- fazer login Google;
- fazer login com 2FA quando ativado;
- renovar sessao;
- sair da conta;
- sair de todas as sessoes;
- recuperar senha por email;
- redefinir senha;
- consultar disponibilidade de `@nick` e telefone;
- concluir onboarding;
- aceitar termos e privacidade;
- desativar conta;
- excluir conta.

### Logica

- o cadastro exige email, senha, nome e telefone;
- email, nick e telefone passam por validacao de unicidade;
- login tem rate limit e bloqueio por excesso de falhas;
- se 2FA estiver ativo, o login exige codigo TOTP;
- a sessao usa access token + refresh token;
- cookies de sessao tambem sao usados no backend;
- usuario desativado pode ser bloqueado em algumas rotas ate reativacao.

## 2.2 Perfil do usuario

### Funcoes

- editar nome, nick, telefone e ID principal de plataforma;
- definir nome publico e handle local;
- escolher avatar;
- alternar entre modo `avatar` e `foto`;
- enviar foto de perfil;
- visualizar foto privada pendente;
- apagar foto pendente;
- listar fotos aprovadas anteriores;
- trocar a foto ativa;
- gerenciar IDs extras de plataforma no historico;
- ver notificacoes do perfil;
- marcar notificacoes como lidas;
- visualizar perfil proprio ou perfil publico de outro usuario.

### Logica

- o perfil usa dados da tabela `users` e preferencias locais;
- foto enviada passa por moderacao:
  - aprovada;
  - rejeitada;
  - manual_review;
- admin pode aprovar ou rejeitar fotos pendentes;
- o app suporta multiplas fotos aprovadas e versoes de imagem;
- handles e alias ajudam na identidade publica no app;
- o perfil publico muda o que aparece para terceiros.

## 2.3 Social e comunidade

### Funcoes

- seguir outro perfil;
- deixar de seguir;
- curtir outro perfil;
- remover curtida;
- ver seguidores;
- ver quem o usuario segue;
- descobrir perfis;
- seguir automaticamente o criador/admin;
- curtir automaticamente o criador/admin;
- receber notificacao quando alguem segue ou curte.

### Logica

- o backend usa relacoes persistidas para `follows` e `likes`;
- nao pode seguir ou curtir a si mesmo;
- a acao e idempotente via `requestId`;
- ao seguir ou curtir, o app:
  - atualiza estado social;
  - cria notificacao para o perfil alvo;
  - invalida caches relacionados;
  - agenda refresh da gamificacao.

## 2.4 Feed e Home

### Funcoes

- ver posts e avisos publicados pelo admin;
- ver posts automaticos de ganhadores;
- curtir posts do feed;
- ver criador/admin em destaque;
- ver usuarios recentes;
- abrir perfil publico de usuarios recentes;
- abrir galeria de perfis.

### Logica

- o feed mistura:
  - avisos/posts administrativos;
  - posts automaticos de ganhadores;
- curtidas do feed sao separadas das curtidas de perfil;
- os itens sao ordenados por data;
- o feed carrega por lotes e aumenta a quantidade visivel progressivamente.

## 2.5 Dashboard, sorteios e dinamicas

### Funcoes

- ver sorteio rapido ativo;
- ver sorteio ao vivo ativo;
- ver call do jogo ativa;
- entrar em sorteio ao vivo;
- entrar em sorteio rapido;
- dispensar sorteio rapido;
- entrar em call do jogo;
- enviar call do jogo;
- ver caixa de promocoes ativas;
- ver notificacao de premio;
- ver historico de ganhadores;
- ver galeria de premios ganhos.

### Logica

- o dashboard busca um resumo unificado das dinamicas ativas;
- cada dinamica pode ter participacao propria;
- participacoes usam controle de idempotencia;
- premios e participacoes podem ser validados depois pelo admin;
- o usuario consegue depois:
  - resgatar premio;
  - dispensar premio;
  - acompanhar seu historico.

## 2.6 Depositos, bilhetes e sorteio dos depositantes

### Funcoes

- registrar deposito;
- enviar um ou varios comprovantes;
- informar nome da plataforma e ID da plataforma;
- reutilizar IDs salvos de plataforma;
- consultar historico de depositos;
- ver depositos aprovados, pendentes, rejeitados ou invalidados;
- ver total depositado no ciclo atual;
- ver total de bilhetes do ciclo;
- ver progresso para metas e cashback;
- ver ranking do ciclo atual;
- ver top 3 do ciclo;
- ver contagem do fim do ciclo;
- ver historico de ciclos encerrados;
- ver bilhetes gerados por ciclo;
- ver historico de depositos por ciclo.

### Logica

- o usuario envia deposito com comprovantes;
- o deposito nasce pendente;
- quando admin aprova:
  - o deposito muda para aprovado;
  - bilhetes basicos e bonus podem ser gerados;
  - gamificacao e cache sao atualizados;
- existe leaderboard do ciclo;
- existe sorteio geral de depositantes e historico de vencedores;
- tambem existe cashback por metas de deposito.

## 2.7 Gamificacao e progresso

### Funcoes

- acumular XP total;
- acumular pontos semanais;
- acumular pontos de engajamento;
- acumular bilhetes ativos;
- acumular bilhetes bonus;
- acumular saldo/banca;
- subir de nivel;
- ganhar badges/conquistas;
- acompanhar quadro semanal;
- acompanhar progresso de metas;
- ver historico de eventos de perfil;
- ver ranking semanal;
- ver configuracao visual de conquistas no perfil.

### Logica

- a gamificacao usa regras configuraveis;
- alguns eventos que alimentam pontos:
  - participacao em dinamicas;
  - deposito aprovado;
  - volume depositado;
  - premio validado;
  - check-in diario;
  - abertura do baú diario;
- existe leaderboard semanal com ciclo;
- os pontos do ranking semanal sao separados por `cycle_key`;
- badges sao avaliadas por regras e metricas do usuario.

## 2.8 Check-in diario

### Funcoes

- ver estado do check-in do dia;
- fazer check-in diario;
- ver streak;
- ver recompensas por dia do ciclo de 7 dias.

### Logica

- o check-in gera um `dayKey` diario;
- o usuario so pode fazer uma vez por dia;
- existe calculo de streak;
- o check-in tambem dispara atualizacao de gamificacao.

## 2.9 Baú Diario 3D

### Funcoes

- ver se o baú diario esta ativo;
- liberar acesso por codigo diario;
- abrir baú base;
- abrir baús bonus;
- receber XP por abertura;
- receber recompensa;
- resgatar recompensa;
- ver historico recente de itens;
- ver status dos slots do dia;
- participar de premio manual ou automatico, dependendo do tipo.

### Logica

- o baú depende de configuracao administrativa;
- pode exigir codigo diario;
- pode ter janela diaria com reset;
- pode liberar baús base e bonus;
- ao abrir:
  - escolhe recompensa de um pool com peso;
  - reserva o premio;
  - registra abertura;
  - concede XP;
- ao resgatar:
  - aplica saldo/pontos/XP/bilhetes/item;
  - pode criar item na galeria de premios;
  - pode criar auditoria se for premio monetario/saldo.

## 2.10 Premios e resgates

### Funcoes

- ver resumo de premios;
- resgatar premio;
- dispensar premio;
- ver colecao/galeria de premios;
- ver historico de ganhadores do app.

### Logica

- premios podem vir de:
  - sorteio live;
  - sorteio rapido;
  - call do jogo;
  - sorteio de depositantes;
  - baú diario;
- algumas premiacoes exigem validacao;
- ao resgatar ou dispensar, o backend marca o estado do registro.

## 2.11 Configuracoes e seguranca

### Funcoes

- alterar senha;
- ativar 2FA;
- desativar 2FA;
- diagnosticar 2FA;
- ativar/desativar som de interacao;
- ativar/desativar som do menu.

### Logica

- 2FA usa segredo TOTP;
- o app gera QR code/segredo;
- o usuario confirma com codigo de 6 digitos;
- existe rota de diagnostico para ajudar quando o codigo nao bate.

## 3. O que o admin faz hoje

## 3.1 Painel administrativo

O admin tem abas para:

- Depositos;
- Ciclos de sorteio;
- Sorteio Live;
- Call do Jogo;
- Sorteio Rapido;
- Sorteio Geral de depositantes;
- Posts;
- Auditoria;
- Estatisticas;
- Usuarios;
- Promocoes;
- Plataformas;
- Redes Sociais;
- Plataforma Atual;
- Fotos de Perfil;
- Configuracoes;
- Gamificacao;
- Baú Diario.

## 3.2 Depositos

### Funcoes

- listar depositos;
- filtrar por status e ciclo;
- ver historico administrativo de um deposito;
- aprovar deposito;
- rejeitar deposito;
- invalidar deposito;
- editar deposito;
- ajustar bilhetes manualmente;
- excluir deposito.

### Logica

- aprovacao pode gerar bilhetes e refletir na gamificacao;
- ajuste de bilhetes altera total do usuario;
- invalidacao e exclusao forcam refresh de read models e ranking.

## 3.3 Ciclos de depositantes

### Funcoes

- criar ciclo;
- editar ciclo;
- encerrar ciclo;
- reativar ciclo;
- excluir ciclo;
- ver resumo dos ciclos;
- ver totais de um ciclo;
- resetar bilhetes de um ciclo;
- sortear vencedores do ciclo;
- validar vencedor;
- excluir vencedor;
- concluir ciclo com vencedores.

### Logica

- o ciclo controla periodo do sorteio geral;
- os bilhetes e ranking do ciclo dependem dos depositos aprovados;
- o sorteio de vencedores e o top do ciclo sao administrados a partir daqui.

## 3.4 Sorteio Live

### Funcoes

- criar sorteio live;
- editar sorteio live;
- ver sorteio atual;
- listar participantes;
- sortear ganhadores;
- encerrar sorteio;
- validar participante;
- invalidar participante;
- reativar participante;
- limpar participantes;
- remover participante.

### Logica

- o sorteio live tem configuracao de premio e quantidade de ganhadores;
- participantes entram pelo app;
- admin faz validacao e sorteio final.

## 3.5 Call do Jogo

### Funcoes

- criar call do jogo;
- editar;
- ver call atual;
- listar participantes;
- sortear vencedores;
- encerrar;
- validar/invalidar/reativar participante;
- limpar participantes;
- remover participante.

### Logica

- usuario entra e envia call;
- admin administra os vencedores e o estado da call.

## 3.6 Sorteio Rapido

### Funcoes

- criar sorteio rapido;
- editar;
- sortear;
- encerrar;
- clonar sorteio com participantes;
- reativar participantes;
- listar participantes;
- validar vencedor;
- remover participante;
- excluir sorteio.

### Logica

- o sorteio rapido e uma dinamica instantanea;
- pode reaproveitar participantes dependendo da operacao de clone/reativacao.

## 3.7 Posts, avisos e feed

### Funcoes

- criar e gerenciar posts/avisos;
- publicar mensagens para o feed inicial;
- acionar exibicao no Home.

### Logica

- posts administrativos viram feed de notices;
- feed de ganhadores tambem aparece misturado com esses avisos.

## 3.8 Auditoria

### Funcoes

- listar auditorias de ganhadores;
- resgatar auditoria;
- excluir auditoria.

### Logica

- auditoria registra premios validados e resgatados;
- baú diario tambem pode gerar auditoria quando o premio for de saldo/monetario.

## 3.9 Usuarios

### Funcoes

- listar usuarios;
- ver detalhe do usuario;
- ver historico do usuario;
- ajustar metricas manualmente;
- resetar metricas;
- restaurar ultimo reset;
- ver ajustes recentes.

### Logica

- admin pode mexer diretamente em XP, pontos, tickets e saldo;
- isso impacta o perfil, ranking e gamificacao.

## 3.10 Gamificacao

### Funcoes

- ver overview de gamificacao;
- listar regras;
- salvar regras;
- configurar check-in diario;
- configurar ranking semanal;
- abrir ciclo semanal;
- fechar ciclo semanal;
- ver leaderboard semanal administrativo.

### Logica

- a gamificacao e orientada por regras;
- o ranking semanal possui ciclo proprio;
- ao fechar ciclo, o backend salva snapshot dos vencedores.

## 3.11 Baú Diario

### Funcoes

- ver configuracao completa;
- salvar configuracoes do baú;
- gerar codigo diario;
- criar recompensa;
- editar recompensa;
- excluir recompensa;
- ver resumo administrativo do baú;
- ver inventario recente;
- ver grants recentes de XP e bonus.

### Logica

- admin define:
  - se o baú esta ativo;
  - horarios;
  - mensagem do dia;
  - tema;
  - quantidade de baús;
  - necessidade de codigo;
  - bonus por deposito;
  - pool de recompensas;
- o codigo do dia libera o baú base para os usuarios.

## 3.12 Fotos de perfil

### Funcoes

- listar fotos pendentes/aprovadas/rejeitadas;
- visualizar preview da foto;
- aprovar foto;
- rejeitar foto.

### Logica

- fotos em `manual_review` ficam aguardando decisao;
- ao aprovar, a foto passa a ser a imagem publica do usuario;
- ao rejeitar, o app limpa a pendencia e registra motivo.

## 3.13 Plataformas e plataforma atual

### Funcoes

- gerenciar plataformas ativas;
- definir plataforma atual;
- exibir plataformas no app.

### Logica

- essas plataformas alimentam deposito, onboarding e dados publicos.

## 3.14 Redes sociais, banners e configuracoes gerais

### Funcoes

- gerenciar redes sociais exibidas no app;
- gerenciar banners/carrossel;
- alterar `AppSettings`;
- controlar features publicas e mensagens.

### Logica

- boa parte da UI publica do app depende dessas configuracoes.

## 4. Regras centrais de negocio

## 4.1 Idempotencia

- varias operacoes usam `requestId`;
- isso evita duplicidade em:
  - participacao;
  - check-in;
  - follow/like;
  - sorteios;
  - aprovacao/acoes de admin;
  - resgates.

## 4.2 Realtime

- o backend emite eventos de alteracao;
- o frontend invalida queries e sincroniza telas;
- isso atualiza ranking, feed, dinamicas e premios quase em tempo real.

## 4.3 Read models e cache

- home, perfil, leaderboard, social e dinamicas usam cache/read model em varios pontos;
- quando o admin altera algo importante, o app invalida esses caches.

## 4.4 Seguranca e auditoria

- login tem rate limit;
- existe logging de eventos de seguranca;
- acoes sensiveis de admin e usuario geram trilha.

## 5. Resumo executivo

Hoje o app, em termos de produto, e basicamente:

- uma comunidade com perfil, feed e social;
- um sistema de dinamicas e sorteios;
- um sistema de deposito com bilhetes e sorteio por ciclo;
- um sistema de gamificacao com XP, pontos, badges e ranking semanal;
- um baú diario gamificado;
- um painel admin forte para operacao ao vivo.

Se voce quiser, o proximo passo natural e eu transformar este mapa em uma planilha ou checklist operacional, separando:

- funcionalidade;
- quem usa;
- rota/backend;
- impacto no banco;
- impacto no realtime;
- prioridade de manutencao.
