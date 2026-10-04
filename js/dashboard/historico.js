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
    cortes.forEach(a=>{ const n=barbeiroDoCorte(a); if(n) nomes.add(n); });
    const lista=[...nomes].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    sel.innerHTML='<option value="">Todos os barbeiros</option>'+
        lista.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')+
        '<option value="__sem__">Sem barbeiro definido</option>';
    if([...sel.options].some(o=>o.value===atual)) sel.value=atual;
}

function fmtDataBR(ymd){ const [y,m,d]=(ymd||'').split('-'); return d?`${d}/${m}/${y}`:''; }

// Cortes antigos lançados sem barbeiro (antes de ele existir na equipe):
// oferece passar todos de uma vez pro nome de um barbeiro (normalmente o dono).
function histRenderSemBarbeiro(todos){
    const box=document.getElementById('hist-sem-barbeiro');
    if(!box) return;
    const semBarbeiro=todos.filter(a=>!a.barbeiro);
    const candidatos=(barbeiroData.equipe||[]).filter(b=>b.tipo!=='recepcionista' && !b.independente);
    if(!semBarbeiro.length || !candidatos.length){ box.style.display='none'; box.innerHTML=''; return; }
    const dono=candidatos.find(b=>b.dono);
    const antes=document.getElementById('hist-sem-barbeiro-sel');
    const escolhido=(antes&&antes.value)||(dono?dono.nome:candidatos[0].nome);
    const total=semBarbeiro.reduce((s,a)=>s+Number(a.preco||0),0);
    box.innerHTML=`<div style="font-size:.85rem;font-weight:700;margin-bottom:.3rem">⚠️ ${semBarbeiro.length} corte${semBarbeiro.length>1?'s':''} sem barbeiro (R$${total.toFixed(2).replace('.',',')})</div>
        <div style="font-size:.76rem;color:var(--muted);margin-bottom:.6rem">Foram lançados antes de o barbeiro estar na equipe. Passe todos para o nome dele (os valores e datas não mudam), ou apague um a um na lista abaixo.</div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
            <select id="hist-sem-barbeiro-sel" style="flex:1;min-width:140px;background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:.55rem .7rem;color:var(--text);font-size:.85rem;outline:none">
                ${candidatos.map(b=>`<option value="${escapeHtml(b.nome)}" ${b.nome===escolhido?'selected':''}>${escapeHtml(b.nome)}${b.dono?' (dono)':''}</option>`).join('')}
            </select>
            <button type="button" id="hist-sem-barbeiro-btn" class="btn-save" style="padding:.55rem .9rem;font-size:.8rem">Passar todos para ele</button>
        </div>`;
    box.style.display='block';
    document.getElementById('hist-sem-barbeiro-btn').addEventListener('click',()=>passarSemBarbeiro(document.getElementById('hist-sem-barbeiro-sel').value));
}

async function passarSemBarbeiro(nome){
    const alvo=histCortes().filter(a=>!a.barbeiro);
    if(!nome || !alvo.length) return;
    if(!(await perguntarSimNao(`Passar ${alvo.length} corte(s) sem barbeiro para ${nome}?\n\nSó o campo "barbeiro" muda. Valores, datas e pagamentos continuam iguais.`))) return;
    try{
        for(let i=0;i<alvo.length;i+=400){
            const lote=writeBatch(db);
            alvo.slice(i,i+400).forEach(a=>lote.update(doc(db,'agendamentos',a.id),{barbeiro:nome}));
            await lote.commit();
        }
        alvo.forEach(a=>{ a.barbeiro=nome; }); // atualiza na hora (o snapshot confirma depois)
        toast(`✓ ${alvo.length} corte(s) passados para ${nome}`);
        renderHistoricoCortes();
        if(typeof carregarGanhos==='function') carregarGanhos();
        if(typeof carregarResumoGestao==='function') carregarResumoGestao();
    }catch(e){
        toast('Erro ao atualizar: '+e.message,'var(--red)');
    }
}

function renderHistoricoCortes(){
    const cont=document.getElementById('hist-lista');
    if(!cont) return;
    const todos=histCortes();
    histPreencherBarbeiros(todos);
    histRenderSemBarbeiro(todos);

    const {ini,fim}=histIntervalo();
    const barb=(document.getElementById('hist-barbeiro')||{}).value||'';
    const busca=((document.getElementById('hist-busca')||{}).value||'').trim().toLowerCase();

    const lista=todos.filter(a=>{
        if(!a.data || a.data<ini || a.data>fim) return false;
        if(barb==='__sem__' ? !!barbeiroDoCorte(a) : (barb && barbeiroDoCorte(a)!==barb)) return false;
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
            const n=barbeiroDoCorte(a)||'Sem barbeiro definido';
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
    // Lançamentos repetidos (mesmo cliente, serviço, dia, hora, valor e
    // barbeiro): o primeiro fica normal, os outros ganham o aviso
    const vistos=new Set(), duplicados=new Set();
    [...lista].reverse().forEach(a=>{
        const k=[String(a.clienteNome||'').trim().toLowerCase(),a.corte,a.data,a.hora,Number(a.preco||0),barbeiroDoCorte(a)].join('|');
        if(vistos.has(k)) duplicados.add(a.id); else vistos.add(k);
    });
    const avisoDup = duplicados.size
        ? `<div class="card" style="margin-bottom:.8rem;border-color:rgba(255,75,43,.4);background:rgba(255,75,43,.05);font-size:.8rem">⚠️ <b>${duplicados.size} lançamento${duplicados.size>1?'s':''} repetido${duplicados.size>1?'s':''}</b> nesse período (mesmo cliente, serviço, dia, hora e valor). Confira os marcados com "Repetido?" e apague os que sobraram. Depois, em <b>Clientes</b>, toque em "🔄 Recalcular cortes" pra acertar a contagem.</div>` : '';
    const mostrados=lista.slice(0,histLimite);
    let diaAnterior='';
    cont.innerHTML=avisoDup+mostrados.map(a=>{
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
                ${barbeiroDoCorte(a)?`<span class="appt-barber-tag">✂️ ${escapeHtml(barbeiroDoCorte(a))}</span>`:''}
                <span class="badge ${pago?'badge-ok':'badge-pend'}">${forma}</span>
                ${duplicados.has(a.id)?'<span class="badge badge-cancel">⚠️ Repetido?</span>':''}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.35rem">
                <span class="appt-price">${desc}R$${Number(a.preco||0).toFixed(0)}</span>
                <button type="button" class="btn-del" data-hist-apagar="${a.id}" title="Apagar este corte do histórico" style="padding:.25rem .5rem;font-size:.68rem">🗑 Apagar</button>
            </div>
        </div>`;
    }).join('')+(lista.length>mostrados.length
        ? `<button id="hist-ver-mais" style="width:100%;margin-top:.8rem;padding:.65rem;background:transparent;border:1.5px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer">Ver mais (${lista.length-mostrados.length} restantes)</button>` : '');
    cont.querySelectorAll('[data-hist-apagar]').forEach(btn=>{
        btn.addEventListener('click',(e)=>{ e.stopPropagation(); apagarCorteHistorico(btn.dataset.histApagar); });
    });
    const mais=document.getElementById('hist-ver-mais');
    if(mais) mais.addEventListener('click',()=>{ histLimite+=100; renderHistoricoCortes(); });
}

// Apaga de vez um corte do histórico (ex: lançado por engano, teste). Some do
// faturamento, dos gráficos e das comissões. O contador de cortes do cliente e
// da fidelidade NÃO volta atrás (esses são ajustados pela aba Clientes).
async function apagarCorteHistorico(id){
    const a=(typeof ultimaListaAppts!=='undefined'?ultimaListaAppts:[]).find(x=>x.id===id);
    if(!a) return;
    const resumo=`${a.clienteNome||'Cliente'} · ${a.corte||'serviço'} · R$${Number(a.preco||0).toFixed(2)} · ${fmtDataBR(a.data)} ${a.hora||''}`;
    if(!(await perguntarSimNao(`Apagar este corte do histórico?\n\n${resumo}\n\nEle sai do faturamento, dos relatórios e da comissão. Não dá pra desfazer.`))) return;
    if(!(await perguntarSimNao(`Confirma mesmo? Apagar de vez: ${resumo}`))) return;
    try{
        await deleteDoc(doc(db,'agendamentos',id));
        // Cópia pública do horário (só existe pra agendamentos de hoje em diante)
        if(a.publicoId){ try{ await deleteDoc(doc(db,'horariosOcupados',a.publicoId)); }catch(e){} }
        ultimaListaAppts=ultimaListaAppts.filter(x=>x.id!==id); // atualiza na hora (o snapshot confirma depois)
        toast('🗑 Corte apagado do histórico');
        renderHistoricoCortes();
        if(typeof carregarResumoGestao==='function') carregarResumoGestao();
        if(typeof carregarGanhos==='function') carregarGanhos();
    }catch(e){
        toast('Erro ao apagar: '+e.message,'var(--red)');
    }
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
