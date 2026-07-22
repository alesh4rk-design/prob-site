# Pro'B — Painel do Barbeiro (barbeiro.html)

Documentação da organização de arquivos do painel do dono/barbeiro/recepcionista.

## ⚠️ Regra mais importante

**`barbeiro.html` precisa continuar na raiz do repositório, sempre.** Todo link que já existe — convites de equipe, botões do Admin, favoritos salvos por clientes — aponta pra `.../barbeiro.html`. Se esse arquivo for movido pra dentro de uma pasta ou renomeado (ex: `index.html`), todos esses links quebram.

## Sobre essa estrutura

O modelo abaixo foi inspirado numa sugestão do ChatGPT, **adaptada** pra funcionar sem ferramenta de build (Webpack, Vite, etc.) — esse projeto é hospedado direto no GitHub Pages, como arquivos estáticos. Duas partes da sugestão original **não foram usadas** de propósito:

- ❌ **Renomear pra `index.html`** — quebraria todos os links existentes (explicado acima)
- ❌ **Pasta `templates/` com HTML carregado via `fetch()`** — funcionaria hospedado, mas quebraria o teste local (abrir o arquivo direto no navegador, sem servidor) porque navegadores bloqueiam `fetch()` no protocolo `file://` por segurança. Também adiciona uma tela em branco enquanto carrega os pedaços.
- 🟡 **~20 arquivos de JavaScript** — reduzido pra uns 8-10. Sem build tool, cada arquivo novo separado exige montar manualmente a "ponte" com o módulo principal (ver seção abaixo) — mais arquivos = mais pontes = mais chance de erro sutil.

## Estrutura de pastas (alvo final)

```
(raiz do repositório)
├── barbeiro.html              ← arquivo principal, não mover nem renomear
├── admin.html
├── cliente.html
├── ...
│
├── css/
│   └── barbeiro.css
│
├── js/
│   ├── barbeiro-particles.js  ← animação de fundo (tela de login)
│   │
│   └── dashboard/
│       ├── estoque.js         ✅ Estoque, Insumos, Zona de Perigo
│       ├── tour.js            ✅ Tour Guiado, Central de Ajuda
│       ├── equipe.js          ✅ Cortes, Equipe, Ganhos
│       ├── agendamentos.js    ⏳ Agendamentos + Fila de Espera
│       ├── promocoes.js       ⏳ Promoções
│       ├── clientes.js        ⏳ Base de Clientes
│       ├── horarios.js        ⏳ Horário de Funcionamento
│       ├── financeiro.js      ⏳ Gestão da Barbearia + relatórios PDF/Excel
│       └── auth.js            ⏳ Login, cadastro, convite, modo funcionário/recepcionista
│
└── docs/
    ├── README.md               ← este arquivo
    └── REQUIREMENTS.md         ← bibliotecas externas usadas
```

✅ = já extraído e testado · ⏳ = ainda dentro do `barbeiro.html`

## Como o `barbeiro.html` carrega tudo isso

No `<head>`:
```html
<link rel="stylesheet" href="css/barbeiro.css">
```

No final do `<body>`, nessa ordem:
```html
<script src="js/barbeiro-particles.js"></script>
...
<script type="module"> ... (toda a lógica principal do sistema) ... </script>
<script defer src="js/dashboard/estoque.js"></script>
<script defer src="js/dashboard/tour.js"></script>
<script defer src="js/dashboard/equipe.js"></script>
```

## Por que os módulos usam `defer` e não `import`/`export`

O `<script type="module">` principal é o único trecho que consegue importar o Firebase. Os arquivos em `js/dashboard/` são scripts comuns — de propósito — e usam `defer` para garantir que rodam **depois** do módulo principal, na ordem em que aparecem no HTML.

**Atenção, isso resolve só parte do problema**: o módulo principal tem um `import` do Firebase, que é assíncrono. `defer` garante a ordem de execução, mas não garante sozinho que o módulo já terminou de configurar tudo. Por isso, todo código que precisa de `window.$`, `window.toast`, etc. **precisa estar dentro de uma função**, chamada explicitamente pelo módulo principal — nunca executando direto ao carregar o arquivo. (Isso já causou um bug real durante a extração do módulo de Equipe.)

### Checklist antes de extrair um novo módulo

1. Mapear tudo que o bloco usa de fora dele (Firebase, `barbeiroData`, funções utilitárias)
2. Conferir se essas dependências já estão na "ponte" (procurar por `window.` perto do topo do módulo principal) — se não estiverem, adicionar
3. Conferir se **todo** o código do bloco está dentro de funções — nada executando direto ao carregar
4. Extrair, testar a sintaxe isolada, testar o carregamento da página inteira (zero erros no console)
5. Testar as funções de verdade, com dados simulados
6. Testar as 14 abas do sistema, checando que nenhuma estoura a tela

### Sobre `barbeiroData` e `todosClientes`

Essas duas variáveis mudam de valor inteiro em vários lugares do código. Usam uma técnica de "getter/setter" (`Object.defineProperty`) que mantém `window.barbeiroData` sempre sincronizado com o valor real, nos dois sentidos — sem precisar mudar nenhuma linha do código já existente.

## Progresso

| Módulo | Status | Linhas |
|---|---|---|
| `css/barbeiro.css` | ✅ Extraído | 488 |
| `js/barbeiro-particles.js` | ✅ Extraído | 59 |
| `js/dashboard/estoque.js` | ✅ Extraído | 649 |
| `js/dashboard/tour.js` | ✅ Extraído | 199 |
| `js/dashboard/equipe.js` | ✅ Extraído | 540 |
| `js/dashboard/promocoes.js` | ✅ Extraído | 375 |
| `js/dashboard/clientes.js` | ✅ Extraído | 253 |
| `js/dashboard/agendamentos.js` | ✅ Extraído | 554 |
| `js/dashboard/horarios.js` | ✅ Extraído | 179 |
| `js/dashboard/financeiro.js` | ✅ Extraído | 1.241 |
| `js/dashboard/auth.js` | ✅ Extraído (parcial, ver nota abaixo) | 488 |
| `js/dashboard/visual.js` | ✅ Extraído | 363 |

`barbeiro.html` (código restante): ~2.757 linhas — só o núcleo (bootstrap, login, `initDash`)

## 🎉 Marco: todo o JavaScript de feature já foi extraído

O que sobra no `barbeiro.html` agora é **só** o núcleo essencial: Firebase, autenticação (`onAuthStateChanged`, `tratarLoginStaff`, `carregarConvite`), e o `initDash()` que orquestra todo o resto. Todo o código específico de cada aba do sistema já está em `js/dashboard/`.

## Sobre o pedaço de Categorias de Corte, resolvido

Aquele trecho documentado como "perdido" (funções `removerCategoria`/`initSessaoBtns`) foi finalmente movido pro lugar certo — anexado ao final de `js/dashboard/equipe.js`, de onde nunca devia ter saído.

## Sobre auth.js — decisão consciente de escopo reduzido

Diferente dos outros módulos, **não extraí o login inteiro**. O `barbeiro.html` continua com:
- `onAuthStateChanged` (o listener principal que reage a login/logout)
- `verificarAcesso`, `mostrarBanner`, `mostrarModalAviso`, `mostrarBloqueio` (checagem de acesso)
- `tratarLoginStaff`, `carregarConvite` (fluxo de convite de funcionário)
- `carregarBarbeiro`, `initDash` (o "maestro" que liga todos os outros módulos)

Só os **dois modos de visão restrita** (funcionário barbeiro e recepcionista) foram extraídos pra `auth.js`. Foi uma escolha deliberada: esse é o único caminho do sistema onde, se algo quebrar, **ninguém consegue mais entrar** — nem o dono, nem a equipe. Manter o núcleo do login junto com o `import` do Firebase (que só pode existir dentro do módulo principal) reduz esse risco ao mínimo possível, mesmo custando um pouco de organização.

## 🔴 Bug de corrida encontrado e corrigido (depois da divisão completa)

Depois de dividir tudo, o login parou de funcionar de forma **intermitente** — funcionava às vezes, falhava outras. Causa: `initDash()` (chamada logo após o login) chamava várias funções dos módulos externos (`initEstoque()`, `initAjudaETour()`, etc.) **sem esperar** elas terminarem de carregar. Na maioria das vezes funcionava (os arquivos carregam rápido), mas em conexões mais lentas, ou quando o Firebase já tinha uma sessão salva respondendo muito rápido, o login processava **antes** dos módulos externos estarem prontos, e tudo quebrava com "função não definida".

**Correção**: criei um helper (`aguardarFuncaoGlobal`) que espera de verdade uma função existir antes de usá-la, e `initDash()` agora espera **todos** os módulos externos ficarem prontos antes de montar o painel — em vez de simplesmente confiar na ordem dos `<script defer>`.

Testei isso simulando o pior cenário possível: módulos externos demorando 300ms a mais que o normal pra carregar. Com a correção, tudo espera certinho e funciona. Sem ela, quebrava.

## Resultado final da divisão

De **7.877 linhas** num arquivo só, pra:
- `barbeiro.html`: ~3.122 linhas (só a estrutura HTML + login + orquestração)
- 8 módulos em `js/dashboard/` (estoque, tour, equipe, promoções, clientes, agendamentos, horários, financeiro, auth)
- CSS e animação de fundo separados

Uma redução de **60% no arquivo principal**, com cada parte testada individualmente antes de ser entregue.

## Nota sobre um pedaço de Cortes ainda perdido

Durante a extração de Clientes, encontrei um trecho de "categorias de corte" (`removerCategoria`, `initSessaoBtns`) fisicamente misturado no meio da seção de Clientes no arquivo original — provavelmente ficou pra trás quando `equipe.js` foi extraído. Deixei ele **onde estava** por enquanto (dentro do `barbeiro.html`), porque mover ele pra dentro de `clientes.js` estaria errado tematicamente, e mover pra `equipe.js` nesse momento aumentaria o risco sem necessidade. Fica registrado aqui pra revisão futura.

