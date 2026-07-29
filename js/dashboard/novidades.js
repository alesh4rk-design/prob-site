// ══════════════════════════════════════════════════════════
// NOVIDADES — avisa quando o sistema ganha alguma atualização nova.
// Non-module, mesmo padrão dos outros arquivos: usa window.$ e o resto do
// espaço global montado pelo módulo principal do barbeiro.html.
//
// Como adicionar uma novidade nova: acrescente um item no topo do array
// NOVIDADES abaixo (mais recente primeiro). O "id" precisa ser único e
// sempre crescente (data serve bem) — é o que o sistema usa pra saber se o
// dono já viu ou não. Não precisa mexer em mais nada.
//
// Itens somem sozinhos da lista depois de NOVIDADES_DIAS_VISIVEL dias, e
// no máximo NOVIDADES_MAX_VISIVEIS de uma vez (as mais recentes) — mesmo
// que várias ainda estejam dentro do prazo de dias, só as N mais novas
// aparecem. Em ambos os casos, continuam guardadas aqui (histórico), só
// não aparecem mais no painel.
// ══════════════════════════════════════════════════════════
const NOVIDADES_DIAS_VISIVEL = 21;
const NOVIDADES_MAX_VISIVEIS = 6;

const NOVIDADES = [
    {
        id: '2026-07-29-09',
        data: '29/07/2026',
        titulo: 'Logo da barbearia e comprovante de comissão',
        itens: [
            'Configurações → Logo da Barbearia: suba a imagem da sua marca (redimensionada e comprimida sozinha) — aparece no menu do sistema e no cabeçalho dos comprovantes em PDF.',
            'Ao marcar a comissão de alguém como paga, o sistema gera um comprovante em PDF (com forma de pagamento) e já abre pra enviar direto no WhatsApp da pessoa.',
            'O combinado de pagamento de comissão agora é individual: cada barbeiro pode ter a própria frequência (semanal, quinzenal ou mensal) e dia.'
        ]
    },
    {
        id: '2026-07-29-08',
        data: '29/07/2026',
        titulo: 'Pagamento de Comissão da Equipe',
        itens: [
            'Nova seção em Equipe: combine um dia fixo do mês pra acertar a comissão de cada barbeiro.',
            'Cada barbeiro mostra o valor devido no mês e um botão "Marcar como pago" (com dupla confirmação, pra evitar clique sem querer).',
            'A partir do dia combinado, quem ainda não foi pago aparece com aviso na Central de Avisos.'
        ]
    },
    {
        id: '2026-07-29-07',
        data: '29/07/2026',
        titulo: 'Estoque e segurança',
        itens: [
            'Cadastrar Produto agora tem campo opcional de data de entrada — se deixar em branco, usa hoje.',
            'Corrigido alarme falso de "acesso expira hoje" causado por instabilidade de rede.',
            'Corrigida brecha que permitia listar os dias restantes de todos os clientes cadastrados.'
        ]
    },
    {
        id: '2026-07-29-01',
        data: '29/07/2026',
        titulo: 'Cliente ganhou mais autonomia',
        itens: [
            'Botão "Fale comigo" flutuante na tela de agendar: WhatsApp e PIX do barbeiro sempre à mão.',
            'Cliente agora vê "Meus Agendamentos" (com botão de cancelar, até 30min antes) e o histórico dos últimos cortes.',
            'Cliente pode atualizar o próprio WhatsApp cadastrado se trocar de número.',
            'Corrigido bug raro em que a tela de escolher corte podia aparecer vazia numa conexão lenta.'
        ]
    },
    {
        id: '2026-07-29-02',
        data: '29/07/2026',
        titulo: 'Aviso quando o cliente cancela',
        itens: [
            'Quando o cliente cancela pelo próprio celular, cai um aviso no sininho flutuante do rodapé, avisando quem foi e qual horário.'
        ]
    },
    {
        id: '2026-07-29-03',
        data: '29/07/2026',
        titulo: 'Ações do Cliente: mais informação',
        itens: [
            'O menu que abre ao clicar num cliente agora mostra o corte agendado e um histórico (colapsável) de tudo que ele já cortou com você.',
            'Nova mensagem pronta "Enviar link de agendamento" — manda o link já pro WhatsApp salvo do cliente, sem digitar nada.',
            'Aba Clientes ganhou um botão de enviar o link de agendamento direto por WhatsApp.'
        ]
    },
    {
        id: '2026-07-29-04',
        data: '29/07/2026',
        titulo: 'Cobrança e Equipe',
        itens: [
            'Aba Cobrança: agora dá pra criar uma cobrança manual (produto danificado, sinal combinado etc.), não só as que vêm de "ainda não pagou".',
            'Recepcionista pode ser marcada como "também corta cabelo" — só assim ela aparece nas telas de escolher barbeiro.',
            'Convites pendentes da equipe agora têm botão de remover, e o link de convite parou de dar "link inválido" pra quem nunca tinha feito login.'
        ]
    },
    {
        id: '2026-07-29-05',
        data: '29/07/2026',
        titulo: 'Estoque, Insumos e Promoções mais organizados',
        itens: [
            'Cadastrar Produto, Insumo e Promoção agora ficam escondidos atrás de um botão "+ Adicionar", em vez do formulário sempre aberto.',
            'Novo botão de baixa manual de estoque (perda, quebra, uso interno).',
            'Serviços agrupados por categoria no Agendamento Presencial e na Fila de Espera — sem mais corte infantil misturado com adulto.'
        ]
    },
    {
        id: '2026-07-29-06',
        data: '29/07/2026',
        titulo: 'Correções no Financeiro e no PIX',
        itens: [
            'Ranking "Cortes Mais Vendidos" estava travado por um bug antigo e nunca mostrava nada — corrigido.',
            'QR Code do PIX corrigido: chave cadastrada com máscara (CPF com pontos, telefone com parênteses) podia gerar um QR que o banco recusava.',
            'Cards clicáveis (Agenda, cabines) não ficam mais selecionando o texto sem querer ao tocar no celular.'
        ]
    },
    {
        id: '2026-07-27-01',
        data: '27/07/2026',
        titulo: 'Aba Cobrança',
        itens: [
            'Nova aba que soma tudo que os clientes ainda devem, com atalho pra cobrar no WhatsApp.'
        ]
    },
    {
        id: '2026-07-27-02',
        data: '27/07/2026',
        titulo: 'Excluir cliente da base',
        itens: [
            'Agora dá pra remover um cliente da Base de Clientes direto pelo menu de ações dele.'
        ]
    },
    {
        id: '2026-07-27-03',
        data: '27/07/2026',
        titulo: 'Backup manual e automático',
        itens: [
            'Em Configurações → Backup: baixe uma cópia de tudo no seu celular, restaure quando precisar, e ative o backup automático antes de qualquer exclusão na Zona de Perigo.'
        ]
    },
    {
        id: '2026-07-27-04',
        data: '27/07/2026',
        titulo: 'Promoções reformuladas',
        itens: [
            'Promoção Individual saiu de cena — no lugar entrou o Cupom (código aberto pra qualquer cliente).',
            'Todas as outras promoções (Simples, Pacote, Desconto por Qtd, Fidelidade) agora ficam vinculadas a um cliente da sua base.'
        ]
    },
    {
        id: '2026-07-27-05',
        data: '27/07/2026',
        titulo: 'Correções importantes',
        itens: [
            'Dar desconto e marcar forma de pagamento agora funcionam pra qualquer cliente, não só quem já estava com pagamento pendente.',
            'A aba Agendamentos some sozinha quando você trabalha só com Fila de espera (e vice-versa).',
            'O botão de entrar na fila fica com destaque de botão principal quando é a única forma de atendimento.'
        ]
    }
];

function initNovidades(){
    if(window.__novidadesBound) return;
    window.__novidadesBound = true;

    const btn = $('btn-novidades');
    const badge = $('novidades-badge');
    const painel = $('novidades-painel');
    const lista = $('novidades-lista');
    if(!btn || !painel || !lista) return;

    // Converte "dd/mm/aaaa" pra Date e só mantém quem ainda está dentro do
    // prazo de exibição — o array inteiro fica guardado no código, isso só
    // filtra o que aparece na tela.
    function dataDaNovidade(str){
        const [d,m,a] = (str||'').split('/');
        return new Date(Number(a), Number(m)-1, Number(d));
    }
    const limite = new Date();
    limite.setDate(limite.getDate() - NOVIDADES_DIAS_VISIVEL);
    const novidadesVisiveis = NOVIDADES
        .filter(n => dataDaNovidade(n.data) >= limite)
        .slice(0, NOVIDADES_MAX_VISIVEIS);

    if(!novidadesVisiveis.length){
        lista.innerHTML = '<p style="font-size:.8rem;color:var(--muted);margin:0">Nenhuma novidade recente.</p>';
    } else {
    lista.innerHTML = novidadesVisiveis.map(n => `
        <div style="border-left:2.5px solid var(--yellow);padding-left:.65rem">
            <div style="font-size:.68rem;color:var(--muted);margin-bottom:.15rem">${n.data}</div>
            <div style="font-size:.85rem;font-weight:700;margin-bottom:.3rem">${escapeHtml(n.titulo)}</div>
            <ul style="margin:0;padding-left:1.1rem;font-size:.78rem;color:var(--muted);line-height:1.5">
                ${n.itens.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}
            </ul>
        </div>
    `).join('');
    }

    function ultimaVista(){
        try{ return localStorage.getItem('prob_novidades_vista') || ''; }catch(e){ return ''; }
    }
    function marcarComoVista(){
        try{ localStorage.setItem('prob_novidades_vista', NOVIDADES[0]?.id || ''); }catch(e){}
        badge.style.display = 'none';
    }

    // O botão flutuante some depois de clicado/visto, e só volta a aparecer
    // na próxima sessão (aba/navegador fechado e reaberto) — sessionStorage
    // dura só a sessão atual, diferente do localStorage usado acima só pra
    // saber se já tem novidade nova.
    function jaEscondidaNestaSessao(){
        try{ return sessionStorage.getItem('prob_novidades_escondida')==='1'; }catch(e){ return false; }
    }
    function esconderNestaSessao(){
        try{ sessionStorage.setItem('prob_novidades_escondida','1'); }catch(e){}
        btn.style.display = 'none';
    }

    if(jaEscondidaNestaSessao()) btn.style.display = 'none';

    if(NOVIDADES.length && NOVIDADES[0].id > ultimaVista()){
        badge.style.display = 'block';
    }

    btn.addEventListener('click', () => {
        const aberto = painel.style.display === 'block';
        painel.style.display = aberto ? 'none' : 'block';
        if(!aberto) marcarComoVista();
    });
    $('btn-fechar-novidades').addEventListener('click', () => {
        painel.style.display = 'none';
        esconderNestaSessao();
    });

    document.addEventListener('click', (e) => {
        if(painel.style.display === 'block' && !painel.contains(e.target) && e.target !== btn){
            painel.style.display = 'none';
            esconderNestaSessao();
        }
    });
}
