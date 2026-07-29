// ══════════════════════════════════════════════════════════
// CENTRAL DE AVISOS — botão flutuante no rodapé da tela (igual o Pro'Bronze
// tem), com avisos persistentes: só somem quando o dono clica em
// "Dispensar" (diferente do toast normal, que desaparece sozinho).
//
// Non-module, mesmo padrão dos outros arquivos: usa window.$,
// window.barbeiroData, window.escapeHtml e o resto do espaço global
// montado pelo módulo principal do barbeiro.html.
// ══════════════════════════════════════════════════════════

// Ids de avisos já dispensados nesta sessão — reinicia ao recarregar a
// página, igual o Pro'Bronze.
const avisosDispensados = new Set();

function atualizarCentralAvisos(){
    const btn = document.getElementById('btn-central-avisos');
    const contador = document.getElementById('avisos-flutuante-contador');
    const lista = document.getElementById('avisos-flutuante-lista');
    if(!btn || !contador || !lista) return;

    const avisos = [];

    (typeof ultimosAgendamentos!=='undefined' ? (ultimosAgendamentos.pagtoPendente||[]) : []).forEach(a=>{
        avisos.push({
            id: `pendente-${a.id}`,
            texto: `💳 Pagamento pendente: ${a.clienteNome||'cliente'} (R$${Number(a.preco||0).toFixed(2)})`,
            tab: 'cobranca'
        });
    });

    (window.__avisos1hCache||[]).forEach(ag=>{
        avisos.push({
            id: `1h-${ag.id}`,
            texto: `⏰ ${ag.clienteNome||'Cliente'} chega em ${ag.diff}min`,
            tab: 'agendamentos'
        });
    });

    (typeof ultimosAgendamentos!=='undefined' ? (ultimosAgendamentos.canceladosPeloCliente||[]) : []).forEach(a=>{
        avisos.push({
            id: `cancel-cliente-${a.id}`,
            texto: `❌ ${a.clienteNome||'Cliente'} cancelou o agendamento de ${a.data} às ${a.hora}`,
            tab: 'agendamentos'
        });
    });

    (typeof produtosCache!=='undefined' ? produtosCache : []).filter(p=>p.estoqueMinimo && p.estoque<=p.estoqueMinimo).forEach(p=>{
        avisos.push({
            id: `estoque-${p.id}`,
            texto: `📦 Estoque baixo: ${p.nome} (${p.estoque} un.)`,
            tab: 'estoque'
        });
    });

    // Comissão de equipe pendente — só a partir do dia combinado (dono
    // define em Equipe → Pagamento de Comissões), pra não avisar cedo demais.
    if(typeof barbeiroData!=='undefined' && barbeiroData.diaPagamentoComissao && new Date().getDate()>=barbeiroData.diaPagamentoComissao){
        const mesAtual = (typeof fmtHoje==='function'?fmtHoje():new Date().toISOString().slice(0,10)).slice(0,7);
        (barbeiroData.equipe||[]).filter(b=>b.tipo!=='recepcionista').forEach(b=>{
            const ganho = (typeof ganhosMesCache!=='undefined' && ganhosMesCache[b.nome]) ? ganhosMesCache[b.nome].ganho : 0;
            if(ganho<=0) return;
            const jaPago = (typeof pagamentosComissaoCache!=='undefined' ? pagamentosComissaoCache : []).some(p=>p.equipeId===b.id && p.mes===mesAtual);
            if(jaPago) return;
            avisos.push({
                id: `comissao-${b.id}-${mesAtual}`,
                texto: `💸 Comissão de ${b.nome} ainda não paga (R$${ganho.toFixed(2)})`,
                tab: 'equipe'
            });
        });
    }

    const visiveis = avisos.filter(a=>!avisosDispensados.has(a.id));

    if(!visiveis.length){
        btn.style.display = 'none';
        document.getElementById('painel-central-avisos').style.display = 'none';
        return;
    }

    btn.style.display = 'flex';
    contador.textContent = visiveis.length;
    lista.innerHTML = visiveis.map(a => `
        <div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--border)">
            <span data-ir-tab="${a.tab}" style="cursor:pointer;flex:1;font-size:.8rem">${escapeHtml(a.texto)}</span>
            <button class="btn-sm" data-dispensar="${a.id}" style="flex-shrink:0;padding:.3rem .6rem;font-size:.7rem;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--muted);cursor:pointer">Dispensar</button>
        </div>
    `).join('');

    lista.querySelectorAll('[data-ir-tab]').forEach(el=>{
        el.addEventListener('click', ()=>{
            document.querySelector(`.tab[data-tab="${el.dataset.irTab}"]`)?.click();
            document.getElementById('painel-central-avisos').style.display = 'none';
        });
    });
    lista.querySelectorAll('[data-dispensar]').forEach(btnD=>{
        btnD.addEventListener('click', ()=>{
            avisosDispensados.add(btnD.dataset.dispensar);
            atualizarCentralAvisos();
        });
    });
}

function initCentralAvisos(){
    if(window.__centralAvisosBound) return;
    window.__centralAvisosBound = true;

    const btn = document.getElementById('btn-central-avisos');
    const painel = document.getElementById('painel-central-avisos');
    if(!btn || !painel) return;

    btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        painel.style.display = painel.style.display==='block' ? 'none' : 'block';
    });
    document.addEventListener('click', (ev)=>{
        if(painel.style.display==='block' && !painel.contains(ev.target) && ev.target!==btn){
            painel.style.display = 'none';
        }
    });

    atualizarCentralAvisos();
}

window.atualizarCentralAvisos = atualizarCentralAvisos;
window.initCentralAvisos = initCentralAvisos;
