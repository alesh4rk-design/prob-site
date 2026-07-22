// ══════════════════════════════════════════════════════════
// TOUR GUIADO + CENTRAL DE AJUDA — barbeiro-tour.js
//
// Script comum (não é módulo ES), igual barbeiro-estoque.js — compartilha
// o espaço global com o resto do sistema. Usa window.$, window.toast,
// window.fecharDrawer e window.abrirDrawer, todos disponibilizados pelo
// <script type="module"> principal do barbeiro.html.
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// TOUR GUIADO + CENTRAL DE AJUDA
// ══════════════════════════════════════════════════════════
const TOUR_STEPS = [
    {selector:'#btn-menu-hamburger', drawer:false,
        titulo:"Bem-vindo ao Pro'B! 👋",
        texto:"Esse é o botão de menu — é por ele que você acessa todas as áreas do sistema. Vamos dar uma volta rápida?"},
    {selector:'[data-tab="agendamentos"]', drawer:true,
        titulo:'📋 Agendamentos',
        texto:'Aqui ficam os horários marcados de hoje e dos próximos dias, atualizando sozinho conforme os clientes agendam.'},
    {selector:'[data-tab="fila"]', drawer:true,
        titulo:'🪑 Fila de Espera',
        texto:'Cliente chegou sem hora marcada? Entra na fila por aqui. Dá até para deixar numa TV/monitor da barbearia mostrando quem é o próximo.'},
    {selector:'[data-tab="cortes"]', drawer:true,
        titulo:'✂️ Cortes',
        texto:'Cadastre seus serviços: nome, preço, duração e até foto. É o catálogo que o cliente vê na hora de agendar.'},
    {selector:'[data-tab="promocoes"]', drawer:true,
        titulo:'🎁 Promoções',
        texto:'Crie descontos gerais, um desconto só para um cliente específico, ou até um cupom para divulgar.'},
    {selector:'[data-tab="equipe"]', drawer:true,
        titulo:'👥 Equipe',
        texto:'Cadastre barbeiros e recepcionistas. Cada um recebe um convite para criar login e senha próprios — vendo só o que precisa ver.'},
    {selector:'[data-tab="clientes"]', drawer:true,
        titulo:'🧑 Clientes',
        texto:'Veja sua base de clientes, quem está recorrente, quem sumiu — e mande mensagem de WhatsApp pronta direto daqui.'},
    {selector:'[data-tab="painel-chamada"]', drawer:true,
        titulo:'📺 Painel de Chamada',
        texto:'Deixe essa tela aberta numa TV ou monitor da barbearia — mostra sozinho, em tempo real, quem é o próximo da fila.'},
    {selector:'[data-tab="gestao"]', drawer:true,
        titulo:'💼 Gestão da Barbearia',
        texto:'Faturamento, comissões e despesas calculados automaticamente. Exporta relatório em Excel ou PDF quando quiser.'},
    {selector:'#btn-ajuda', drawer:false,
        titulo:'Precisa rever isso depois? 😉',
        texto:'É só clicar aqui a qualquer momento — o tour guiado e a central de ajuda ficam sempre disponíveis.'},
];

const TOPICOS_AJUDA = [
    {titulo:'📋 Como funciona a Agenda', texto:'Os agendamentos de hoje e dos próximos dias aparecem automaticamente, feitos pelos seus clientes ou por você (agendamento presencial). Marque como concluído ou cancelado direto no card.', tab:'agendamentos', selector:'[data-tab="agendamentos"]'},
    {titulo:'🪑 Como funciona a Fila de Espera', texto:'Para clientes que chegam sem hora marcada. Adicione o nome e o corte escolhido — o corte é obrigatório, para manter o controle financeiro adequado.', tab:'fila', selector:'[data-tab="fila"]'},
    {titulo:'✂️ Cadastrando serviços', texto:'Em Cortes, adicione cada serviço com nome, preço, duração e, se quiser, uma foto. Isso é o que aparece para o cliente escolher ao agendar.', tab:'cortes', selector:'[data-tab="cortes"]'},
    {titulo:'🎁 Criando uma promoção', texto:'Em Promoções, escolha entre desconto geral, pacote, ou promoção individual para um cliente específico (com desconto e quantidade de usos definida por você).', tab:'promocoes', selector:'[data-tab="promocoes"]'},
    {titulo:'👥 Convidando sua equipe', texto:'Em Equipe, cadastre um barbeiro ou recepcionista e copie o link de convite gerado — manda por WhatsApp. A pessoa cria a própria senha ao abrir o link.', tab:'equipe', selector:'[data-tab="equipe"]'},
    {titulo:'⚠️ Clientes sumidos', texto:'Na aba Clientes, use os filtros de "dias sem aparecer" para identificar rapidamente os clientes inativos e enviar uma mensagem de reativação com um clique.', tab:'clientes', selector:'[data-tab="clientes"]'},
    {titulo:'📺 Painel de TV da barbearia', texto:'Em Painel de Chamada, copie o link e abra numa TV ou monitor — atualiza sozinho mostrando a fila e quem é o próximo.', tab:'painel-chamada', selector:'[data-tab="painel-chamada"]'},
    {titulo:'💼 Relatórios financeiros', texto:'Em Gestão da Barbearia, veja faturamento e despesas, e exporte um relatório completo em Excel ou PDF quando precisar.', tab:'gestao', selector:'[data-tab="gestao"]'},
    {titulo:'🔗 Link de agendamento', texto:'Na aba Clientes tem o link público de agendamento — copie e mande pros seus clientes pelo WhatsApp, Instagram, onde quiser.', tab:'clientes', selector:'[data-tab="clientes"]'},
];

let tourPassoAtual = 0;
let tourAtivo = false;
let modoDestaqueUnico = false;

function initAjudaETour(){
    if(window.__ajudaBound) { verificarPrimeiroAcesso(); return; }
    window.__ajudaBound = true;

    $('btn-ajuda').addEventListener('click', (e)=>{
        e.stopPropagation();
        const menu = $('ajuda-menu');
        menu.style.display = menu.style.display==='block' ? 'none' : 'block';
    });
    document.addEventListener('click', (e)=>{
        const menu = $('ajuda-menu');
        if(menu.style.display==='block' && !menu.contains(e.target) && e.target.id!=='btn-ajuda'){
            menu.style.display = 'none';
        }
    });
    $('btn-refazer-tour').addEventListener('click', ()=>{
        $('ajuda-menu').style.display = 'none';
        iniciarTour();
    });
    const btnTutRefazer = $('btn-tutoriais-refazer-tour');
    if(btnTutRefazer) btnTutRefazer.addEventListener('click', iniciarTour);
    $('btn-central-ajuda').addEventListener('click', ()=>{
        $('ajuda-menu').style.display = 'none';
        abrirCentralAjuda();
    });
    $('btn-fechar-ajuda').addEventListener('click', ()=> $('modal-ajuda').style.display='none');
    $('modal-ajuda').addEventListener('click', (e)=>{ if(e.target.id==='modal-ajuda') $('modal-ajuda').style.display='none'; });

    $('tour-fechar').addEventListener('click', pararTour);
    $('tour-proximo').addEventListener('click', ()=>{
        if(modoDestaqueUnico || tourPassoAtual >= TOUR_STEPS.length-1){ pararTour(); return; }
        tourPassoAtual++;
        mostrarPassoTour();
    });
    $('tour-anterior').addEventListener('click', ()=>{
        if(tourPassoAtual<=0) return;
        tourPassoAtual--;
        mostrarPassoTour();
    });
    window.addEventListener('resize', ()=>{ if(tourAtivo) posicionarTour(TOUR_STEPS[tourPassoAtual].selector); });

    verificarPrimeiroAcesso();
}

function verificarPrimeiroAcesso(){
    try{
        if(window.__recepcionista) return; // tour é só para o dono, por enquanto
        if(!localStorage.getItem('probTourFeito')){
            setTimeout(iniciarTour, 900);
        }
    }catch(e){}
}

function iniciarTour(){
    tourPassoAtual = 0;
    tourAtivo = true;
    modoDestaqueUnico = false;
    mostrarPassoTour();
}

function pararTour(){
    tourAtivo = false;
    $('tour-spotlight').style.display = 'none';
    $('tour-tooltip').style.display = 'none';
    fecharDrawer();
    if(!modoDestaqueUnico){
        try{ localStorage.setItem('probTourFeito','1'); }catch(e){}
    }
    modoDestaqueUnico = false;
}

function mostrarPassoTour(){
    const passo = TOUR_STEPS[tourPassoAtual];
    if(passo.drawer){ if(window.abrirDrawer) window.abrirDrawer(); }
    else { fecharDrawer(); }

    $('tour-passo-atual').textContent = `Passo ${tourPassoAtual+1} de ${TOUR_STEPS.length}`;
    $('tour-titulo').textContent = passo.titulo;
    $('tour-texto').textContent = passo.texto;
    $('tour-anterior').style.display = tourPassoAtual>0 ? 'inline-block' : 'none';
    $('tour-proximo').textContent = tourPassoAtual>=TOUR_STEPS.length-1 ? 'Concluir ✓' : 'Próximo →';

    setTimeout(()=>posicionarTour(passo.selector), passo.drawer!==undefined ? 300 : 50);
}

function posicionarTour(selector){
    const alvo = document.querySelector(selector);
    const spot = $('tour-spotlight');
    const tip = $('tour-tooltip');
    if(!alvo){ spot.style.display='none'; tip.style.display='none'; return; }

    const r = alvo.getBoundingClientRect();
    const pad = 6;
    spot.style.display = 'block';
    spot.style.top    = (r.top-pad)+'px';
    spot.style.left   = (r.left-pad)+'px';
    spot.style.width  = (r.width+pad*2)+'px';
    spot.style.height = (r.height+pad*2)+'px';

    tip.style.display = 'block';
    const tipW = 300, margem = 14;
    let top = r.bottom + margem;
    if(top + 180 > window.innerHeight){ top = Math.max(margem, r.top - 190); }
    let left = Math.min(Math.max(margem, r.left), window.innerWidth - tipW - margem);
    tip.style.top = top+'px';
    tip.style.left = left+'px';

    alvo.scrollIntoView({behavior:'smooth', block:'center'});
}

function renderTopicosAjuda(containerId, aoFechar){
    const container = $(containerId);
    container.innerHTML = TOPICOS_AJUDA.map((t,i)=>`
        <div style="border-bottom:1px solid var(--border);padding:.9rem 0">
            <div style="font-weight:700;font-size:.88rem;margin-bottom:.35rem">${t.titulo}</div>
            <div style="font-size:.8rem;color:var(--muted);line-height:1.5;margin-bottom:.5rem">${t.texto}</div>
            <button class="btn-edit" style="font-size:.72rem" data-idx="${i}">👁️ Mostrar na tela</button>
        </div>`).join('');
    container.querySelectorAll('button[data-idx]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            const t = TOPICOS_AJUDA[Number(btn.dataset.idx)];
            if(aoFechar) aoFechar();
            tourPassoAtual = -1; tourAtivo = true; modoDestaqueUnico = true;
            if(window.abrirDrawer) window.abrirDrawer();
            $('tour-passo-atual').textContent = '';
            $('tour-titulo').textContent = t.titulo;
            $('tour-texto').textContent = t.texto;
            $('tour-anterior').style.display = 'none';
            $('tour-proximo').textContent = 'Entendi ✓';
            setTimeout(()=>posicionarTour(t.selector), 300);
        });
    });
}

function abrirCentralAjuda(){
    renderTopicosAjuda('lista-topicos-ajuda', ()=>{ $('modal-ajuda').style.display = 'none'; });
    $('modal-ajuda').style.display = 'flex';
}
