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
const NOVIDADES_MAX_VISIVEIS = 8;

const NOVIDADES = [
    {
        id: '2026-10-03-08',
        data: '03/10/2026',
        titulo: 'Nova aba: Histórico de Cortes',
        itens: [
            'Menu Pessoas → Histórico de Cortes: todos os cortes concluídos de cada barbeiro e seus, do mais recente pro mais antigo.',
            'Filtre por período (hoje, 7 dias, 30 dias, mês, tudo ou datas), por barbeiro e busque por cliente ou serviço.',
            'Veja quantidade de cortes, faturado, ticket médio, quanto está a receber e o total de cada barbeiro.',
            'Toque num corte pra editar, registrar pagamento ou chamar no WhatsApp. Os cortes de quem só aluga a cadeira não entram.'
        ]
    },
    {
        id: '2026-10-03-07',
        data: '03/10/2026',
        titulo: 'Equipe: dono na lista e barbeiro que aluga a cadeira',
        itens: [
            'Novo tipo "Eu (dono)": você aparece pro cliente escolher, sem comissão e sem precisar de link de acesso.',
            'Novo tipo "Barbeiro que aluga a cadeira": informe o valor do aluguel, se é semanal, quinzenal ou mensal e o dia. Ele não aparece nos agendamentos e os cortes dele não entram no seu faturamento.',
            'No dia combinado, em Pagamento de Comissões, aparece o aluguel que ele deve e o botão "Recebi dele". O aluguel entra no seu lucro (card Aluguel de cadeiras na Gestão) e o sino avisa quando está pendente.',
            'Cada barbeiro agora tem "Forma de pagamento": comissionado (% do corte) ou aluga a cadeira (aluguel + %, só % ou só aluguel). Só o dono altera.'
        ]
    },
    {
        id: '2026-10-03-06',
        data: '03/10/2026',
        titulo: 'Despesas com data de pagamento',
        itens: [
            'Gastos agora podem ser semanais (ex: diarista toda sexta), além de fixos, parcelados e só do mês.',
            'Informe o dia do vencimento de cada gasto. O card "Próximos pagamentos" mostra o que vence nos próximos 14 dias e o que está atrasado, com o botão "Paguei".',
            'O sino de avisos lembra de pagamento atrasado ou que vence hoje ou amanhã. Use "Editar" pra colocar data nos gastos que você já tinha.',
            'Insumos e produtos: o campo agora é "Data da compra" e o gasto vai pro mês certo. Em "+ Repor" o sistema pergunta quando você comprou.'
        ]
    },
    {
        id: '2026-10-03-05',
        data: '03/10/2026',
        titulo: 'Cortes: editar, esquecido na fila e concluídos recentes',
        itens: [
            'Dá pra editar um atendimento já concluído (serviço, valor, data, hora, barbeiro, cliente e forma de pagamento): abra o corte e toque em "Editar este atendimento".',
            'Aba Agendamentos ganhou "Concluídos recentes (7 dias)" pra achar cortes de dias passados e corrigi-los.',
            'O botão "Lançar Corte Esquecido" agora também aparece na Fila de Espera.'
        ]
    },
    {
        id: '2026-10-03-04',
        data: '03/10/2026',
        titulo: 'Quem não pagou não conta como faturado',
        itens: [
            'Corte marcado como "Ainda não pagou" não entra mais no faturamento, no lucro, nos gráficos, nos relatórios nem na comissão do barbeiro até o pagamento ser registrado.',
            'O que falta receber aparece como "A receber" na Gestão, na Equipe e no painel do barbeiro.',
            'Ao registrar a forma de pagamento, o valor entra sozinho no faturamento e na comissão. O faturamento do mês pode ficar menor do que antes: agora ele mostra só o que foi pago.'
        ]
    },
    {
        id: '2026-10-03-03',
        data: '03/10/2026',
        titulo: 'Agenda respeita a duração dos serviços',
        itens: [
            'Um atendimento ocupa o tempo todo do serviço (campo Duração em Cortes): um Corte + Barba de 1h às 10h bloqueia também as 10h30.',
            'Horários que encostariam em outro atendimento, em um bloqueio ou passariam do fechamento não aparecem pro cliente nem no agendamento presencial.',
            'Horário bloqueado pra barbearia toda (almoço, feriado) agora vale mesmo quando o cliente escolhe um barbeiro específico. Confira se cada serviço está com a duração certa.'
        ]
    },
    {
        id: '2026-10-03-02',
        data: '03/10/2026',
        titulo: 'Privacidade dos clientes',
        itens: [
            'Nome completo e WhatsApp dos clientes (agendamentos, fila e lista de clientes) ficam visíveis só pra você, sua equipe logada e o próprio cliente.',
            'A tela do cliente e a TV mostram só o primeiro nome e a inicial, sem telefone.',
            'Quem agenda sem login vê "Meus Agendamentos" só no mesmo celular em que agendou; com conta, vê pela conta.'
        ]
    },
    {
        id: '2026-10-03-01',
        data: '03/10/2026',
        titulo: 'Correções',
        itens: [
            'Depois das 21h o sistema achava que já era o dia seguinte (agenda de hoje, receita do dia e data dos cortes). Agora usa a data do seu aparelho.',
            'Segundo desconto pra cliente da fila era calculado sobre o valor já descontado. Corrigido.',
            'Funcionário que atende alguém da fila agora leva o WhatsApp, a forma de pagamento e o desconto do cliente.',
            'Salvar a % de comissão de um barbeiro não apaga mais o combinado de pagamento dele.'
        ]
    },
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

    // Só mostra o botão flutuante depois do login/dashboard carregado (essa
    // função só roda daqui) — e não mostra se já foi visto/fechado nesta
    // mesma sessão.
    btn.style.display = jaEscondidaNestaSessao() ? 'none' : 'flex';

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
