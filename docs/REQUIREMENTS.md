# Dependências externas — Pro'B (barbeiro.html)

Este projeto **não usa npm, build tool nem gerenciador de pacotes**. Todas as bibliotecas abaixo são carregadas direto via CDN (link de internet), o que significa: **precisa de internet pra funcionar**, e uma mudança de versão da biblioteca (feita pelo provedor do CDN) pode afetar o sistema sem você ter mexido em nada.

## Sempre carregadas (todo carregamento da página)

| Biblioteca | Versão | Pra que serve | Carregada em |
|---|---|---|---|
| Firebase App | 10.12.2 | Base do Firebase | `barbeiro.html` |
| Firebase Auth | 10.12.2 | Login/cadastro (dono, funcionário) | `barbeiro.html` |
| Firebase Firestore | 10.12.2 | Banco de dados | `barbeiro.html` |
| SheetJS (xlsx) | 0.18.5 | Exportar relatório em Excel | `barbeiro.html` |
| jsPDF | 2.5.1 | Exportar relatório em PDF | `barbeiro.html` |
| Google Fonts (Inter) | — | Fonte principal do sistema | `barbeiro.html` |

## Carregadas só quando usadas (sob demanda)

| Biblioteca | Versão | Pra que serve | Carregada em |
|---|---|---|---|
| html5-qrcode | 2.3.8 | Ler código de barras pela câmera do celular | `js/modules/barbeiro-estoque.js` — só carrega quando o dono clica no botão de câmera, não pesa o carregamento normal da página |
| Google Fonts (dinâmica) | — | Fonte personalizada da Tela do Cliente, escolhida pelo dono | `barbeiro.html` — troca conforme a fonte escolhida em Configurações |

## Se algum CDN sair do ar

O sistema **não tem um plano B automático** se algum desses links pararem de responder (raro, mas não impossível). Na prática:
- Se Firebase cair → nada funciona (login, agenda, tudo depende disso)
- Se xlsx/jsPDF caírem → só a exportação de relatório para de funcionar, o resto do sistema continua normal
- Se html5-qrcode cair → só o leitor por câmera para de funcionar; o leitor físico USB/Bluetooth e a digitação manual continuam funcionando normalmente

## Versões fixas de propósito

Todas as versões acima estão **travadas** (não são "sempre a mais recente"). Isso é intencional — evita que uma atualização da biblioteca, feita sem nosso controle, quebre alguma coisa do sistema sem aviso. Atualizar a versão de alguma dessas bibliotecas deve ser uma decisão deliberada, testada antes de subir pro ar.
