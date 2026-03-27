# GCP Migration Checklist

Objetivo: migrar o app para Google Cloud sem perder usuarios, sessoes, depositos, pontuacoes, premios, follows, likes, historicos e fotos.

## Stack alvo

- Frontend: Vercel
- `user-api`: Cloud Run
- `realtime-api`: Cloud Run
- Banco oficial: Cloud SQL PostgreSQL
- Cache / pubsub / locks: Memorystore Redis
- Regiao: `southamerica-east1`

## Dados que precisam ser preservados

Banco PostgreSQL:

- `users`
- `refresh_tokens`
- `security_events`
- `login_attempts`
- `password_reset_tokens`
- `points_ledger`
- `user_profile_images`
- `user_profile_image_versions`
- `entity_records`
- `daily_checkins`
- `user_follows`
- `profile_likes`

Observacao:

- grande parte da regra de negocio esta dentro de `entity_records`
- depositos, premios, auditorias, settings e historicos dependem disso
- nao migrar essa tabela corretamente quebra o app inteiro

Tipos criticos dentro de `entity_records` para validar no restore:

- `Deposit`
- `DepositantDrawCycle`
- `DepositantDrawWinner`
- `DrawWinnerAudit`
- `UserPrizeGalleryItem`
- `InstantRaffle`
- `InstantRaffleParticipant`
- `LiveDrawParticipant`
- `GameCallParticipant`
- `DailyChestXpGrant`
- `CompetitionPointEvent`
- `CashbackClaim`
- `PushNotification`
- `FeedPostLike`
- `ProfileNotification`
- `PlatformHistory`
- `Platform`
- `CurrentPlatform`
- `AppSettings`

Arquivos / midias:

- Cloudinary:
  - uploads genericos
  - provas de deposito
  - possiveis imagens publicas antigas
- Perfil:
  - parte das fotos aprovadas tambem existe no banco:
    - `user_profile_images`
    - `user_profile_image_versions`

## Variaveis obrigatorias para o backend novo

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL_MIN`
- `REFRESH_TOKEN_TTL_DAYS`
- `APP_BASE_URL`
- `ORIGIN`
- `UPLOADS_BASE_URL`
- `CLOUDINARY_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`
- `ADMIN_NICK`
- `DB_POOL_MAX`
- `DB_IDLE_TIMEOUT_MS`
- `DB_CONNECTION_TIMEOUT_MS`

## Ordem segura da migracao

1. Fechar bugs funcionais do app.
2. Congelar mudancas estruturais no banco durante a janela de migracao.
3. Provisionar Cloud SQL, Redis e Cloud Run no GCP.
4. Subir o backend no GCP apontando para um banco de teste restaurado.
5. Restaurar dump recente do Postgres nesse banco de teste.
6. Validar:
   - login
   - `/api/auth/me`
   - home
   - perfil publico e privado
   - depositos
   - fotos aprovadas
   - gamificacao
7. Confirmar conexao com Cloudinary e leitura de uploads antigos.
8. Fazer dump final do Postgres em janela curta.
9. Restaurar dump final no Cloud SQL de producao.
10. Apontar `VITE_API_BASE_URL` / `UPLOADS_BASE_URL` para o backend novo.
11. Fazer smoke test completo.
12. Manter Railway em modo rollback por alguns dias.

## Dump e restore do banco

Export:

```bash
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > souzatv-prod.dump
```

Restore:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$TARGET_DATABASE_URL" souzatv-prod.dump
```

Cuidados:

- testar restore antes no banco de homologacao
- confirmar extensoes do Postgres
- conferir timezone
- validar constraints e indices apos restore

## Validacoes obrigatorias depois do restore

- quantidade de usuarios
- quantidade de deposits em `entity_records`
- quantidade de follows
- quantidade de likes
- quantidade de `daily_checkins`
- quantidade de premios / auditorias
- quantidade de `user_profile_image_versions`

Exemplos de conferencias:

```sql
select count(*) from users;
select count(*) from entity_records where entity_name = 'Deposit';
select count(*) from entity_records where entity_name = 'DepositantDrawCycle';
select count(*) from entity_records where entity_name = 'DepositantDrawWinner';
select count(*) from entity_records where entity_name = 'DrawWinnerAudit';
select count(*) from entity_records where entity_name = 'UserPrizeGalleryItem';
select count(*) from entity_records where entity_name = 'InstantRaffleParticipant';
select count(*) from entity_records where entity_name = 'LiveDrawParticipant';
select count(*) from entity_records where entity_name = 'GameCallParticipant';
select count(*) from entity_records where entity_name = 'DailyChestXpGrant';
select count(*) from entity_records where entity_name = 'CompetitionPointEvent';
select count(*) from entity_records where entity_name = 'CashbackClaim';
select count(*) from entity_records where entity_name = 'FeedPostLike';
select count(*) from user_follows;
select count(*) from profile_likes;
select count(*) from daily_checkins;
select count(*) from user_profile_image_versions;
```

## Fotos e uploads

Fotos de perfil:

- validar leitura de:
  - `/api/auth/profile-image/:userId`
  - `/api/auth/profile-image-version/:imageId`
- garantir que `profile_image_url` antiga continue resolvendo

Cloudinary:

- se o `CLOUDINARY_URL` for o mesmo, os uploads antigos continuam acessiveis
- nao apagar assets da conta atual antes do corte completo
- confirmar que o backend novo consegue ler os mesmos `public_id` e entregar as mesmas URLs antigas
- manter a conta atual do Cloudinary como fonte de verdade durante o corte

## Redis

Redis no GCP deve assumir:

- cache de rotas quentes
- rate limit
- adapter do Socket.IO
- locks de sorteio / eventos criticos

## Cloud Run

Config inicial recomendada para `user-api`:

- `min instances`: 1 ou 2
- `max instances`: controlar para nao estourar Cloud SQL
- pool por instancia: pequeno e fixo
- logs e metricas habilitados

## Smoke test de corte

- login funcionando
- abrir Home sem `401` prematuro
- abrir perfil proprio
- abrir perfil publico com `?user=...`
- abrir perfil publico com `?u=...`
- seguir alguem e ver botao mudar na hora
- curtir alguem e ver botao mudar na hora
- curtir post e ver contador mudar na hora
- abrir Depositos sem "Aguardando novo ciclo" indevido
- conferir top semanal e fotos aprovadas

## Rollback

Manter pronto:

- deploy antigo do Railway
- variaveis antigas do frontend
- ultimo dump consistente do banco

Se der problema no corte:

1. voltar `VITE_API_BASE_URL` para o backend antigo
2. manter o banco antigo como fonte de verdade
3. investigar sem escrever no banco novo em paralelo
4. nao tentar sincronizar manualmente dados divergentes sem definir uma unica fonte de verdade

## Regra de ouro

Nao migrar por partes o dado oficial do usuario. O corte de producao deve considerar como bloco unico:

- banco
- backend
- cache
- urls do frontend

Separar esses elementos sem coordenacao cria inconsistencias de login, pontos, fotos e depositos.
