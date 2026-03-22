# Deploy de Producao

Este projeto deve ser publicado com artefatos regeneraveis, nao por upload manual de arquivos soltos.

## Estrutura recomendada

- Frontend: publicar o conteudo de `deploy/release/frontend`
- Backend: publicar o conteudo de `deploy/release/backend`
- Banco: Postgres separado e persistente
- Cache/realtime: Redis separado e persistente

## Como gerar uma release local

Na raiz do projeto:

```powershell
npm run release:prepare
```

Isso gera:

```text
deploy/
  release/
    frontend/
    backend/
    templates/
    README.txt
```

## O que sobe em cada deploy

- `deploy/release/frontend`: build completo do frontend
- `deploy/release/backend/src`: codigo do backend
- `deploy/release/backend/package.json`
- `deploy/release/backend/package-lock.json`

## O que NAO deve ser sobrescrito no servidor

- `.env` do frontend e do backend
- banco Postgres
- Redis
- `backend/uploads`
- `backend/private_uploads`
- logs persistentes

## Persistencia entre deploys

Persistem:

- dados do Postgres
- dados do Redis, se voce quiser manter estado em memoria/filas entre restarts
- uploads publicos em `backend/uploads`
- uploads privados em `backend/private_uploads`
- secrets e configuracoes em `.env`

Nao persistem:

- `dist`
- pasta de release local
- `node_modules` do build local

## Requisitos minimos de producao

- `NODE_ENV=production`
- backend com `.env` valido
- frontend com `.env` valido antes do build
- reverse proxy com HTTPS
- processo do backend gerenciado por `pm2`, `systemd` ou plataforma equivalente
- Postgres com backup
- Redis disponivel para Socket.IO adapter e rate limit distribuido

## Provisionamento do primeiro admin

O backend nao cria admin automaticamente em producao. O primeiro admin deve ser provisionado de forma explicita.

No servidor do backend, com o `.env` de producao ja configurado:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL="admin@seudominio.com"
$env:BOOTSTRAP_ADMIN_PASSWORD="SenhaForteCom12+Chars"
$env:BOOTSTRAP_ADMIN_FULL_NAME="Administrador Producao"
$env:BOOTSTRAP_ADMIN_NICK="admin"
npm run bootstrap:admin
```

Voce tambem pode passar tudo por argumento:

```powershell
npm run bootstrap:admin -- --email admin@seudominio.com --password "SenhaForteCom12+Chars" --full-name "Administrador Producao" --nick admin
```

Esse comando:

- cria o usuario se ele ainda nao existir
- promove o usuario para `admin` se ele ja existir
- grava senha hash no banco
- nao roda automaticamente no boot

Depois de concluir, remova as variaveis temporarias do shell e siga o deploy normal.

## Fluxo recomendado de atualizacao

1. Fazer mudancas localmente.
2. Validar build.
3. Rodar `npm run release:prepare`.
4. Publicar a pasta `deploy/release/frontend`.
5. Publicar a pasta `deploy/release/backend`.
6. Instalar dependencias do backend no servidor com `npm ci --omit=dev`.
7. Reiniciar backend.

## Observacoes do app atual

- O jogo principal deve continuar oculto em producao com `VITE_GAME_MAIN_ENABLED=false`.
- O Baú Diario 3D pode continuar ativo com `VITE_DAILY_CHEST_3D_ENABLED=true`.
