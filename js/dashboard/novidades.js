// ══════════════════════════════════════════════════════════
// NOVIDADES — avisa quando o sistema ganha alguma atualização nova.
// Non-module, mesmo padrão dos outros arquivos: usa window.$ e o resto do
// espaço global montado pelo módulo principal do barbeiro.html.
//
// Como adicionar uma novidade nova: acrescente um item no topo do array
// NOVIDADES abaixo (mais recente primeiro). O "id" precisa ser único e
// sempre crescente (data serve bem) — é o que o sistema usa pra saber se o
// dono já viu ou não. Não precisa mexer em mais nada.
// ══════════════════════════════════════════════════════════
const NOVIDADES = [
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

    lista.innerHTML = NOVIDADES.map(n => `
        <div style="border-left:2.5px solid var(--yellow);padding-left:.65rem">
            <div style="font-size:.68rem;color:var(--muted);margin-bottom:.15rem">${n.data}</div>
            <div style="font-size:.85rem;font-weight:700;margin-bottom:.3rem">${escapeHtml(n.titulo)}</div>
            <ul style="margin:0;padding-left:1.1rem;font-size:.78rem;color:var(--muted);line-height:1.5">
                ${n.itens.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    function ultimaVista(){
        try{ return localStorage.getItem('prob_novidades_vista') || ''; }catch(e){ return ''; }
    }
    function marcarComoVista(){
        try{ localStorage.setItem('prob_novidades_vista', NOVIDADES[0]?.id || ''); }catch(e){}
        badge.style.display = 'none';
    }

    if(NOVIDADES.length && NOVIDADES[0].id > ultimaVista()){
        badge.style.display = 'block';
    }

    btn.addEventListener('click', () => {
        const aberto = painel.style.display === 'block';
        painel.style.display = aberto ? 'none' : 'block';
        if(!aberto) marcarComoVista();
    });
    $('btn-fechar-novidades').addEventListener('click', () => { painel.style.display = 'none'; });

    document.addEventListener('click', (e) => {
        if(painel.style.display === 'block' && !painel.contains(e.target) && e.target !== btn){
            painel.style.display = 'none';
        }
    });
}
