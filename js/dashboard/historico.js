// ══════════════════════════════════════════════════════════
// HISTÓRICO DE CORTES — aba só do dono: todos os cortes concluídos da
// barbearia, por barbeiro, com filtro de período, barbeiro e cliente.
// Fica de fora o barbeiro independente (que só aluga a cadeira e usa o
// próprio sistema): os cortes dele não pertencem a esta barbearia.
// Script comum (não módulo): usa ultimaListaAppts (agendamentos.js),
// barbeiroData, foiPago, dataLocal, abrirAcoesCliente, escapeHtml.
// ══════════════════════════════════════════════════════════

let histPeriodo = '30';      // 'hoje' | '7' | '30' | 'mes' | 'tudo' | 'custom'
let histLimite = 100;        // linhas mostradas (botão "ver mais" aumenta)

const HIST_PAGTO = {dinheiro:'💵 Dinheiro', pix:'📱 Pix', debito:'💳 Débito', credito:'💳 Crédito', pendente:'⏳ Não pago'};

function histIntervalo(){
    const hoje=new Date(); hoje.setHours(0,0,0,0);
    const fim=dataLocal(hoje);
    const ini=(dias)=>{const d=new Date(hoje); d.setDate(d.getDate()-dias); return dataLocal(d);};
    if(histPeriodo==='hoje') return {ini:fim, fim};
    if(histPeriodo==='7') return {ini:ini(6), fim};
    if(histPeriodo==='30') return {ini:ini(29), fim};
    if(histPeriodo==='mes') return {ini:fim.slice(0,7)+'-01', fim};
    if(histPeriodo==='custom'){
        return {ini:(document.getElementById('hist-data-ini')||{}).value||'0000-00-00', fim:(document.getElementById('hist-data-fim')||{}).value||'9999-99-99'};
    }
    return {ini:'0000-00-00', fim:'9999-99-99'};
}

// Cortes que pertencem a esta barbearia: concluídos, que não são cobrança
// avulsa e que não foram de um barbeiro independente (aluguel de cadeira)
function histCortes(){
    const independentes=new Set((barbeiroData.equipe||[]).filter(b=>b.independente).map(b=>b.nome));
    return (typeof ultimaListaAppts!=='undefined'?ultimaListaAppts:[]).filter(a=>
        a.status==='concluido' && a.origem!=='cobranca-manual' && !independentes.has(a.barbeiro||'')
    );
}

function histPreencherBarbeiros(cortes){
    const sel=document.getElementById('hist-barbeiro');
    if(!sel) return;
    const atual=sel.value;
    const nomes=new Set();
    (barbeiroData.equipe||[]).filter(b=>b.tipo!=='recepcionista' && !b.independente).forEach(b=>nomes.add(b.nome));
    cortes.forEach(a=>{ if(a.barbeiro) nomes.add(a.barbeiro); });
    const lista=[...nomes].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    sel.innerHTML='<option value="">Todos os barbeiros</option>'+
        lista.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')+
        '<option value="__sem__">Sem barbeiro definido</option>';
    if([...sel.options].some(o=>o.value===atual)) sel.value=atual;
}

function fmtDataBR(ymd){ const [y,m,d]=(ymd||'').split('-'); return d?`${d}/${m}/${y}`:''; }

function renderHistoricoCortes(){
    const cont=document.getElementById('hist-lista');
    if(!cont) return;
    const todos=histCortes();
    histPreencherBarbeiros(todos);

    const {ini,fim}=histIntervalo();
    const barb=(document.getElementById('hist-barbeiro')||{}).value||'';
    const busca=((document.getElementById('hist-busca')||{}).value||'').trim().toLowerCase();

    const lista=todos.filter(a=>{
        if(!a.data || a.data<ini || a.data>fim) return false;
        if(barb==='__sem__' ? !!a.barbeiro : (barb && a.barbeiro!==barb)) return false;
        if(busca && !String(a.clienteNome||'').toLowerCase().includes(busca) && !String(a.corte||'').toLowerCase().includes(busca)) return false;
        return true;
    }).sort((a,b)=>(b.data+(b.hora||'')).localeCompare(a.data+(a.hora||'')));

    // Resumo
    const pagos=lista.filter(foiPago);
    const total=pagos.reduce((s,a)=>s+Number(a.preco||0),0);
    const aReceber=lista.filter(a=>!foiPago(a)).reduce((s,a)=>s+Number(a.preco||0),0);
    const set=(id,v)=>{const e=document.getElementById(id); if(e) e.textContent=v;};
    set('hist-kpi-qtd', String(lista.length));
    set('hist-kpi-total', 'R$'+total.toFixed(2).replace('.',','));
    set('hist-kpi-ticket', 'R$'+(pagos.length?total/pagos.length:0).toFixed(2).replace('.',','));
    set('hist-kpi-areceber', 'R$'+aReceber.toFixed(2).replace('.',','));

    // Resumo por barbeiro (quando não há um barbeiro filtrado)
    const resumoEl=document.getElementById('hist-por-barbeiro');
    if(resumoEl){
        const por={};
        lista.forEach(a=>{
            const n=a.barbeiro||'Sem barbeiro definido';
            if(!por[n]) por[n]={qtd:0,total:0};
            por[n].qtd++;
            if(foiPago(a)) por[n].total+=Number(a.preco||0);
        });
        const linhas=Object.entries(por).sort((a,b)=>b[1].qtd-a[1].qtd);
        resumoEl.innerHTML = (linhas.length>1 && !barb)
            ? linhas.map(([n,d])=>`<div style="display:flex;justify-content:space-between;gap:.6rem;padding:.4rem 0;border-top:1px solid var(--border);font-size:.82rem">
                <span>✂️ ${escapeHtml(n)} <span style="color:var(--muted);font-size:.72rem">· ${d.qtd} corte${d.qtd>1?'s':''}</span></span>
                <span style="font-family:'Courier New',monospace;font-weight:700;color:var(--green)">R$${d.total.toFixed(2).replace('.',',')}</span></div>`).join('')
            : '';
        resumoEl.style.display = resumoEl.innerHTML ? 'block' : 'none';
    }

    if(!lista.length){
        cont.innerHTML='<div class="empty-state"><div class="icon">✂️</div>Nenhum corte concluído nesse período.</div>';
        return;
    }
    const mostrados=lista.slice(0,histLimite);
    let diaAnterior='';
    cont.innerHTML=mostrados.map(a=>{
        const cab = a.data!==diaAnterior
            ? `<div style="font-size:.72rem;font-weight:800;color:var(--blue);text-transform:uppercase;letter-spacing:.5px;margin:${diaAnterior?'1rem':'0'} 0 .4rem">${fmtDataBR(a.data)}${typeof fmtDataExtenso==='function'?'':''}</div>` : '';
        diaAnterior=a.data;
        const pago=foiPago(a);
        const forma=HIST_PAGTO[a.formaPagamento]||'⏳ Não pago';
        const desc=a.precoOriginal!=null && Number(a.precoOriginal)>Number(a.preco)
            ? `<span style="font-size:.65rem;color:var(--muted);text-decoration:line-through;margin-right:.3rem">R$${Number(a.precoOriginal).toFixed(0)}</span>` : '';
        return cab+`<div class="appt-card appt-done" style="cursor:pointer;align-items:flex-start" title="Abrir (editar, pagamento, WhatsApp)" onclick="abrirAcoesCliente('${escAttr(a.clienteNome||'')}','${escAttr(a.clienteWhatsapp||'')}','${a.id}','${escAttr(a.data||'')}','${escAttr(a.hora||'')}','${a.status||'concluido'}')">
            <div class="appt-time">${escapeHtml(a.hora||'—')}</div>
            <div class="appt-info" style="flex-wrap:wrap">
                <span class="appt-name">${escapeHtml(a.clienteNome||'—')}</span>
                <span class="appt-sep">·</span>
                <span class="appt-corte">${escapeHtml(a.corte||'')}</span>
                ${a.barbeiro?`<span class="appt-barber-tag">✂️ ${escapeHtml(a.barbeiro)}</span>`:''}
                <span class="badge ${pago?'badge-ok':'badge-pend'}">${forma}</span>
            </div>
            <span class="appt-price">${desc}R$${Number(a.preco||0).toFixed(0)}</span>
        </div>`;
    }).join('')+(lista.length>mostrados.length
        ? `<button id="hist-ver-mais" style="width:100%;margin-top:.8rem;padding:.65rem;background:transparent;border:1.5px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer">Ver mais (${lista.length-mostrados.length} restantes)</button>` : '');
    const mais=document.getElementById('hist-ver-mais');
    if(mais) mais.addEventListener('click',()=>{ histLimite+=100; renderHistoricoCortes(); });
}

function initHistorico(){
    if(window.__historicoBound) return;
    const raiz=document.getElementById('tab-historico');
    if(!raiz) return;
    window.__historicoBound=true;
    raiz.querySelectorAll('[data-hist-periodo]').forEach(btn=>{
        btn.addEventListener('click',()=>{
            histPeriodo=btn.dataset.histPeriodo; histLimite=100;
            raiz.querySelectorAll('[data-hist-periodo]').forEach(b=>{
                const ativo=b===btn;
                b.style.borderColor=ativo?'var(--blue)':'var(--border)';
                b.style.color=ativo?'var(--blue)':'var(--muted)';
            });
            document.getElementById('hist-custom-wrap').style.display=histPeriodo==='custom'?'flex':'none';
            renderHistoricoCortes();
        });
    });
    ['hist-barbeiro','hist-data-ini','hist-data-fim'].forEach(id=>{
        const e=document.getElementById(id); if(e) e.addEventListener('change',()=>{histLimite=100;renderHistoricoCortes();});
    });
    const busca=document.getElementById('hist-busca');
    if(busca) busca.addEventListener('input',()=>{histLimite=100;renderHistoricoCortes();});
    renderHistoricoCortes();
}

window.initHistorico=initHistorico;
window.renderHistoricoCortes=renderHistoricoCortes;
