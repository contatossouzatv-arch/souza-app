# Runner Dev Notes - 2026-03-14

## Objetivo do dia

Ajustar o editor dev do mapa do runner, estabilizar seleção/posicionamento, melhorar repetição no ciclo, trabalhar a borda procedural da grama e adicionar ferramentas de escultura/reset.

## O que ficou feito

### Painel / editor do jogo

- Removido o experimento de `editor por blocos` em popup.
- Mantido o fluxo antigo pelo painel dentro do jogo.
- Adicionado `Salvar item`.
- Ajustado hold nos botões de mover.
- Ajustado `Girar` para passo fino.
- Corrigidos vários problemas de save/seleção em `DailyEvent.jsx`.
- `lint` e `build` estavam passando quando foi revisado o painel.

### Ciclo do mapa

- Corrigida a lógica principal para o ciclo não “resetar na tela” de forma seca.
- Objetos ancorados e eventos passaram a escolher a cópia do ciclo mais próxima da janela visível.
- Ainda pode haver ajuste fino visual, mas o snap principal do ciclo foi atacado.

### Seleção / posicionamento de elementos

- Vários bugs vieram da conversão entre `preview Z` e `stored Z`.
- Melhorias foram feitas, mas esse fluxo ainda é sensível.
- Clique em item 3D já teve vários fixes para não perder seleção ou afundar imediatamente.
- O sistema continua delicado, especialmente para `model3d` com `relative_ground/relative_curve`.

### Repetição de peças no ciclo

- `Clonar` foi ajustado para respeitar melhor posição e altura.
- `Preencher ciclo` foi implementado para repetir peça ao longo do ciclo.
- Problema de clones empilhados foi corrigido: antes o override inteiro copiava `x/y/z`.
- Adicionado `Passo de repeticao`.
- Adicionado `Aproximar repetidos`.
- Hoje funcionou melhor para o lado esquerdo; lado direito ainda teve comportamento inconsistente.

### Estrada / cenário 3D

- Houve otimizações e correções no pipeline de materiais importados para o 3D não ficar tão escuro.
- Modelos importados agora usam material mais “vivo”, com menos peso PBR.

### Procedural da borda da grama

- Removido o muro marrom procedural.
- Ficou só a grama elevada/barranco procedural.
- O perfil foi ajustado para ficar mais macio/cartoon.
- Depois foi ajustado para a borda subir de baixo para cima, com perfil mais inflado, sem atingir tanto o personagem.

### Escultura da borda procedural

- Criado suporte de escultura na borda procedural da grama.
- Funciona em `road_base`.
- Durante a escultura:
  - câmera fica travada
  - aparece marcador visual do brush
- Adicionado botão para limpar a escultura:
  - `Resetar deformacoes da borda`
- Esse botão limpa:
  - `procedural_grass_vertex_offsets_left`
  - `procedural_grass_vertex_offsets_right`

## Último estado importante

### Ponto atual

O jogo ficou pesado por causa da grama procedural.

Prováveis causas:

- malha procedural com subdivisão demais
- deformação de vértice/offset sendo recalculada demais
- amostragem da escultura ao longo da borda

### Última mudança feita

- Adicionado/ajustado o botão:
  - `Resetar deformacoes da borda`
- Ele está em:
  - `RUA > Visual 3D > Bloco procedural rapido`
- O texto foi deixado mais claro.
- `npm run build` passou depois disso.

## Próximo passo recomendado

Prioridade alta:

1. aliviar o custo da grama procedural
2. reduzir segmentos / qualidade
3. talvez adicionar `Qualidade da grama procedural: baixa / media / alta`
4. se necessário, desativar atualização dinâmica da deformação durante a corrida

## Arquivos principais mexidos hoje

- `src/pages/DailyEvent.jsx`
- `src/components/game/Runner3DScene.jsx`

## Observações

- Houve muitos bugs interligados entre:
  - seleção
  - mover
  - ciclo do mapa
  - `relative_ground`
  - `relative_curve`
- Se amanhã continuar instável, o melhor caminho é isolar uma área por vez e evitar novas features em paralelo.
