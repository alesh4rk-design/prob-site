// ══════════════════════════════════════════════════════════
// PROMOÇÕES — promocoes.js
//
// Script comum (não é módulo ES). Usa window.$, window.escapeHtml,
// window.toast, window.barbeiroData, window.carregarCachePromoCliente
// e as funções do Firestore, disponibilizadas pelo módulo principal.
// Os cliques da tela só são ligados depois, por initPromocoesExtras()
// — chamada pelo módulo principal, não aqui dentro. Ver docs/README.md.
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════
// PROMOÇÕES
// ══════════════════════════════════════════════

// Liga os cliques da aba Promoções — chamados por initPromocoesExtras(),
// depois que window.$ e companhia já estão prontos (mesmo motivo do
// initEquipeExtras em equipe.js — ver docs/README.md).
function initPromocoesExtras(){

// Toggle campos por tipo
document.getElementById('promo-tipo').addEventListener('change', function(){
    ['simples','pacote','desconto','fidelidade','individual'].forEach(t=>{
        document.getElementById('promo-campos-'+t).style.display = this.value===t?'block':'none';
    });
});

// Toggle se também vai gerar um código de cupom
document.getElementById('promo-i-tem-codigo').addEventListener('change', function(){
    document.getElementById('promo-i-campos-codigo').style.display = this.checked?'block':'none';
});

// Gera um código de cupom aleatório
document.getElementById('btn-gerar-codigo').addEventListener('click', ()=>{
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo='';
    for(let i=0;i<6;i++) codigo+=chars[Math.floor(Math.random()*chars.length)];
    document.getElementById('promo-i-codigo').value=codigo;
});

// Toggle datas personalizadas
document.getElementById('promo-periodo').addEventListener('change', function(){
    document.getElementById('promo-campos-datas').style.display = this.value==='personalizado'?'block':'none';
});

// Criar promoção
document.getElementById('btn-add-promo').addEventListener('click', async()=>{
    const tipo    = document.getElementById('promo-tipo').value;
    const periodo = document.getElementById('promo-periodo').value;
    const titulo  = document.getElementById('promo-titulo').value.trim();
    const desc    = document.getElementById('promo-desc').value.trim();

    if(!titulo && tipo!=='individual'){ toast('Digite o título da promoção','var(--red)'); return; }

    const promo = {
        tipo, periodo, titulo, desc,
        ativo: true,
        criadoEm: new Date().toISOString(),
        barbeiroId: barbeiroData.uid
    };

    // Campos específicos por tipo
    if(tipo==='simples'){
        promo.servicos = document.getElementById('promo-s-servicos').value.trim();
        promo.valor    = parseFloat(document.getElementById('promo-s-valor').value)||0;
        if(!promo.servicos||!promo.valor){ toast('Preencha serviços e valor','var(--red)'); return; }
    }
    if(tipo==='pacote'){
        promo.qtdCortes = parseInt(document.getElementById('promo-p-qtd').value)||0;
        promo.valor     = parseFloat(document.getElementById('promo-p-valor').value)||0;
        if(!promo.qtdCortes||!promo.valor){ toast('Preencha quantidade e valor','var(--red)'); return; }
    }
    if(tipo==='desconto'){
        promo.minCortes  = parseInt(document.getElementById('promo-d-min').value)||0;
        promo.desconto   = parseInt(document.getElementById('promo-d-pct').value)||0;
        promo.basePeriodo= document.getElementById('promo-d-base').value;
        if(!promo.minCortes||!promo.desconto){ toast('Preencha os campos de desconto','var(--red)'); return; }
    }
    if(tipo==='fidelidade'){
        promo.meta   = parseInt(document.getElementById('promo-f-meta').value)||0;
        promo.brinde = document.getElementById('promo-f-brinde').value.trim();
        if(!promo.meta||!promo.brinde){ toast('Preencha meta e brinde','var(--red)'); return; }
    }
    if(tipo==='individual'){
        const clienteWpp = document.getElementById('promo-i-cliente-select').value;
        if(!clienteWpp){ toast('Selecione um cliente da sua base','var(--red)'); return; }
        const clienteEscolhido = todosClientes.find(c=>c.wpp===clienteWpp);

        promo.descontoTipo  = document.getElementById('promo-i-desconto-tipo').value;
        promo.descontoValor = parseFloat(document.getElementById('promo-i-desconto-valor').value)||0;
        promo.limiteUsos = Math.max(1, parseInt(document.getElementById('promo-i-limite-usos').value) || 1);
        promo.usosFeitos = 0;
        const validoAte = document.getElementById('promo-i-valido-ate').value;
        if(validoAte) promo.validoAte = validoAte;

        if(!promo.descontoValor){ toast('Preencha o valor do desconto','var(--red)'); return; }
        if(promo.descontoTipo==='percentual' && (promo.descontoValor<=0||promo.descontoValor>90)){ toast('Desconto percentual deve ser entre 1 e 90%','var(--red)'); return; }

        promo.alvo = 'cliente';
        promo.clienteNome = clienteEscolhido ? clienteEscolhido.nome : '';
        promo.clienteWpp  = clienteWpp;
        if(!titulo) promo.titulo = 'Desconto especial — '+(promo.clienteNome||'cliente');

        // Checa se esse cliente já tem uma promoção individual ativa —
        // evita empilhar mais de uma sem querer.
        try{
            const snapExistente = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'promocoes'));
            const jaTem = snapExistente.docs.some(d=>{
                const p=d.data();
                return p.tipo==='individual' && p.ativo && p.clienteWpp===clienteWpp;
            });
            if(jaTem && !confirm(`${promo.clienteNome||'Esse cliente'} já tem uma promoção individual ativa. Quer criar outra mesmo assim?`)) return;
        }catch(e){ console.error('checagem de promoção duplicada:', e); }

        // Cupom é um extra opcional, não substitui o vínculo com o cliente
        if(document.getElementById('promo-i-tem-codigo').checked){
            promo.codigo = document.getElementById('promo-i-codigo').value.trim().toUpperCase();
            if(!promo.codigo){ toast('Informe ou gere um código de cupom','var(--red)'); return; }
            try{
                const snapCodigo = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'promocoes'));
                const codigoRepetido = snapCodigo.docs.some(d=>d.data().codigo===promo.codigo);
                if(codigoRepetido){ toast('Esse código já está em uso por outra promoção','var(--red)'); return; }
            }catch(e){ console.error('checagem de código duplicado:', e); }
        }
    }
    if(periodo==='personalizado'){
        promo.dataInicio = document.getElementById('promo-data-ini').value;
        promo.dataFim    = document.getElementById('promo-data-fim').value;
        if(!promo.dataInicio||!promo.dataFim){ toast('Defina as datas da promoção','var(--red)'); return; }
    }

    try{
        await addDoc(collection(db,'barbeiros',barbeiroData.uid,'promocoes'), promo);
        // Limpa campos
        document.getElementById('promo-titulo').value='';
        document.getElementById('promo-desc').value='';
        document.getElementById('promo-s-servicos').value='';
        document.getElementById('promo-s-valor').value='';
        document.getElementById('promo-p-qtd').value='';
        document.getElementById('promo-p-valor').value='';
        document.getElementById('promo-d-min').value='';
        document.getElementById('promo-d-pct').value='';
        document.getElementById('promo-f-meta').value='';
        document.getElementById('promo-f-brinde').value='';
        document.getElementById('promo-i-cliente-select').value='';
        document.getElementById('promo-i-tem-codigo').checked=false;
        document.getElementById('promo-i-campos-codigo').style.display='none';
        document.getElementById('promo-i-codigo').value='';
        document.getElementById('promo-i-desconto-valor').value='';
        document.getElementById('promo-i-valido-ate').value='';
        toast('✓ Promoção criada!');
        carregarPromocoes();
    }catch(e){ toast('Erro: '+e.message,'var(--red)'); }
});
}

// Carrega promoções
async function carregarPromocoes(){
    try{
        const snap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'promocoes'));
        const promos = [];
        snap.forEach(d=>promos.push({id:d.id,...d.data()}));
        renderPromocoes(promos);
        carregarFidelidade(promos.filter(p=>p.tipo==='fidelidade'&&p.ativo));
        carregarCachePromoCliente(); // mantém o selo da Agenda atualizado
    }catch(e){ console.error('carregarPromocoes:',e); }
}

function renderPromocoes(promos){
    const cont = document.getElementById('lista-promocoes');
    if(!promos.length){
        cont.innerHTML='<div class="empty-state"><div class="icon">🎁</div>Nenhuma promoção criada ainda.</div>';
        return;
    }
    const icones={simples:'🏷️',pacote:'📦',desconto:'💰',fidelidade:'⭐',individual:'🎯'};
    const hoje = new Date().toISOString().split('T')[0];
    cont.innerHTML = promos.map(p=>{
        // Verifica se está dentro do período
        let ativaNoPeriodo = p.ativo;
        if(p.tipo==='individual'){
            ativaNoPeriodo = p.ativo && (p.usosFeitos||0) < (p.limiteUsos||1) && (!p.validoAte || hoje<=p.validoAte);
        } else if(p.periodo==='semanal'){
            const semanaAtual = obterSemana(new Date());
            ativaNoPeriodo = p.ativo && obterSemana(new Date(p.criadoEm))===semanaAtual;
        } else if(p.periodo==='mensal'){
            const mesAtual = hoje.slice(0,7);
            ativaNoPeriodo = p.ativo && p.criadoEm.slice(0,7)===mesAtual;
        } else if(p.periodo==='personalizado'){
            ativaNoPeriodo = p.ativo && hoje>=p.dataInicio && hoje<=p.dataFim;
        }

        let detalhe='';
        if(p.tipo==='simples')    detalhe=`${p.servicos} por <strong style="color:var(--green)">R$${Number(p.valor).toFixed(2)}</strong>`;
        if(p.tipo==='pacote')     detalhe=`${p.qtdCortes} cortes por <strong style="color:var(--green)">R$${Number(p.valor).toFixed(2)}</strong> (R$${(p.valor/p.qtdCortes).toFixed(2)}/corte)`;
        if(p.tipo==='desconto')   detalhe=`${p.minCortes}+ cortes ${p.basePeriodo==='semana'?'na semana':'no mês'} = <strong style="color:var(--green)">${p.desconto}% off</strong>`;
        if(p.tipo==='fidelidade') detalhe=`A cada ${p.meta} cortes = <strong style="color:var(--yellow)">${p.brinde}</strong>`;
        if(p.tipo==='individual'){
            const valorFmt = p.descontoTipo==='percentual'?`${p.descontoValor}% off`:`R$${Number(p.descontoValor).toFixed(2)} off`;
            const quemFmt = `👤 ${escapeHtml(p.clienteNome||'Cliente')} (${escapeHtml(p.clienteWpp||'')})`;
            const cupomFmt = p.codigo ? ` · 🔑 Cupom <strong>${escapeHtml(p.codigo)}</strong>` : '';
            const usosFeitos = p.usosFeitos||0, limiteUsos = p.limiteUsos||1, usosRestam = limiteUsos-usosFeitos;
            const statusUso = usosRestam<=0
                ? ' <span style="color:var(--muted)">· esgotado</span>'
                : limiteUsos>1
                    ? ` <span style="color:var(--yellow)">· restam ${usosRestam} de ${limiteUsos} usos</span>`
                    : '';
            detalhe=`${quemFmt}${cupomFmt} — <strong style="color:var(--green)">${valorFmt}</strong>${statusUso}`;
        }

        const periodoLabel = p.tipo==='individual'
            ? (p.validoAte?`Válido até ${p.validoAte}`:'Sem validade definida')
            : ({permanente:'Permanente',semanal:'Semanal',mensal:'Mensal',personalizado:`${p.dataInicio} até ${p.dataFim}`}[p.periodo]||p.periodo);

        const wppBtn = (p.tipo==='individual' && p.clienteWpp) ? `<a href="https://wa.me/55${p.clienteWpp}?text=${encodeURIComponent(`Olá ${p.clienteNome||''}! Preparei um desconto especial para você: ${p.descontoTipo==='percentual'?p.descontoValor+'% off':'R$'+Number(p.descontoValor).toFixed(2)+' off'} no seu próximo corte na ${barbeiroData.nome||'barbearia'}. Corre lá! 🎁`)}" target="_blank" class="btn-wpp" style="text-align:center;text-decoration:none">Avisar WPP</a>` : '';
        const codigoBtn = (p.tipo==='individual' && p.codigo) ? `<button class="btn-edit" onclick="navigator.clipboard.writeText('${p.codigo}').then(()=>toast('Código copiado!'))">Copiar código</button>` : '';

        return `<div style="background:var(--card2);border:1px solid ${ativaNoPeriodo?'rgba(0,255,136,.2)':'var(--border)'};border-radius:10px;padding:1rem;margin-bottom:.6rem;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
                <div style="flex:1">
                    <div style="font-weight:700;font-size:.92rem;color:${ativaNoPeriodo?'var(--text)':'var(--muted)'}">${icones[p.tipo]} ${escapeHtml(p.titulo)}</div>
                    ${p.desc?`<div style="font-size:.75rem;color:var(--muted);margin-top:.2rem">${escapeHtml(p.desc)}</div>`:''}
                    <div style="font-size:.8rem;margin-top:.4rem">${detalhe}</div>
                    <div style="font-size:.68rem;color:var(--muted);margin-top:.3rem">📅 ${periodoLabel} · ${ativaNoPeriodo?'<span style="color:var(--green)">● Ativa</span>':'<span style="color:var(--muted)">● Encerrada</span>'}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:.35rem;flex-shrink:0">
                    ${wppBtn}
                    ${codigoBtn}
                    <button class="btn-edit" onclick="togglePromo('${p.id}',${!p.ativo})">${p.ativo?'Pausar':'Reativar'}</button>
                    <button class="btn-del" onclick="deletarPromo('${p.id}')">Excluir</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function obterSemana(date){
    const d = new Date(date);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()+3-(d.getDay()+6)%7);
    const week1 = new Date(d.getFullYear(),0,4);
    return d.getFullYear()*100+Math.round(((d-week1)/86400000-3+(week1.getDay()+6)%7)/7)+1;
}

// Atalho: vem da aba Clientes já com o cliente selecionado
window.criarPromoParaCliente = (nome, wpp) => {
    document.querySelector('.tab[data-tab="promocoes"]').click();
    const tipoSel = document.getElementById('promo-tipo');
    tipoSel.value = 'individual';
    tipoSel.dispatchEvent(new Event('change'));
    const clienteSel = document.getElementById('promo-i-cliente-select');
    clienteSel.value = wpp;
    if(clienteSel.value !== wpp){
        // Esse cliente ainda não estava na lista do select (base pode não
        // ter recarregado ainda) — adiciona ele na hora, pra não travar.
        const opt = document.createElement('option');
        opt.value = wpp; opt.textContent = nome;
        clienteSel.appendChild(opt);
        clienteSel.value = wpp;
    }
    setTimeout(()=>{
        document.getElementById('promo-i-desconto-valor').scrollIntoView({behavior:'smooth',block:'center'});
        document.getElementById('promo-i-desconto-valor').focus();
    }, 150);
};

window.togglePromo = async(id, ativo)=>{
    try{
        await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'promocoes',id),{ativo});
        toast(ativo?'✓ Promoção reativada!':'Promoção pausada');
        carregarPromocoes();
    }catch(e){ toast('Erro: '+e.message,'var(--red)'); }
};

window.deletarPromo = async(id)=>{
    if(!confirm('Excluir esta promoção?')) return;
    try{
        await deleteDoc(doc(db,'barbeiros',barbeiroData.uid,'promocoes',id));
        toast('Promoção excluída','var(--red)');
        carregarPromocoes();
    }catch(e){ toast('Erro: '+e.message,'var(--red)'); }
};

// ── FIDELIDADE — rastreia cortes por cliente ──
async function carregarFidelidade(promosAtivas){
    const cont = document.getElementById('lista-fidelidade');
    if(!promosAtivas.length){
        cont.innerHTML='<div class="empty-state"><div class="icon">⭐</div>Nenhuma promoção de fidelidade ativa.</div>';
        return;
    }
    try{
        const snap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'fidelidade'));
        const carteiras = [];
        snap.forEach(d=>carteiras.push({id:d.id,...d.data()}));

        if(!carteiras.length){
            cont.innerHTML='<div class="empty-state"><div class="icon">⭐</div>Nenhum cliente no programa ainda.</div>';
            return;
        }
        const promoFid = promosAtivas[0];
        cont.innerHTML = carteiras.map(c=>{
            const pct = Math.min(100,Math.round((c.cortes/promoFid.meta)*100));
            return `<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;margin-bottom:.5rem">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
                    <div>
                        <div style="font-weight:700;font-size:.9rem">${c.nome||c.wpp}</div>
                        <div style="font-size:.72rem;color:var(--muted)">${c.wpp}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-family:'Courier New',monospace;font-size:1.1rem;font-weight:900;color:var(--yellow)">${c.cortes}/${promoFid.meta}</div>
                        <div style="font-size:.68rem;color:var(--muted)">cortes</div>
                    </div>
                </div>
                <div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;margin-bottom:.4rem">
                    <div style="height:100%;width:${pct}%;background:${pct>=100?'var(--green)':'var(--yellow)'};border-radius:3px;transition:width .4s"></div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:.72rem;color:${pct>=100?'var(--green)':'var(--muted)'}">
                        ${pct>=100?'🎉 '+promoFid.brinde+' disponível!':'Faltam '+(promoFid.meta-c.cortes)+' cortes'}
                    </span>
                    <div style="display:flex;gap:.35rem">
                        <button class="btn-edit" style="font-size:.68rem" onclick="addCortesFidelidade('${c.id}','${c.nome||c.wpp}',${c.cortes},${promoFid.meta})">+1 corte</button>
                        ${pct>=100?`<button class="btn-add" style="padding:.2rem .5rem;font-size:.65rem" onclick="resgatarFidelidade('${c.id}','${c.nome||c.wpp}')">Resgatar</button>`:''}
                    </div>
                </div>
            </div>`;
        }).join('');
    }catch(e){ console.error('fidelidade:',e); }
}

window.addCortesFidelidade = async(id,nome,atual,meta)=>{
    try{
        const novo = atual+1;
        await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'fidelidade',id),{cortes:novo,ultimoCorte:new Date().toISOString()});
        toast(`✓ ${nome}: ${novo}/${meta} cortes`);
        carregarPromocoes();
    }catch(e){ toast('Erro: '+e.message,'var(--red)'); }
};

window.resgatarFidelidade = async(id,nome)=>{
    if(!confirm(`Confirmar resgate do brinde para ${nome}? Os cortes serão zerados.`)) return;
    try{
        await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'fidelidade',id),{cortes:0,ultimoResgate:new Date().toISOString()});
        toast(`🎉 Brinde resgatado para ${nome}!`);
        carregarPromocoes();
    }catch(e){ toast('Erro: '+e.message,'var(--red)'); }
};

// Adicionar cliente na fidelidade ao concluir agendamento
async function registrarFidelidade(clienteNome, clienteWpp){
    try{
        const promosSnap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'promocoes'));
        const promoFid = [];
        promosSnap.forEach(d=>{ const p=d.data(); if(p.tipo==='fidelidade'&&p.ativo) promoFid.push({id:d.id,...p}); });
        if(!promoFid.length) return;

        // Busca ou cria carteirinha do cliente
        const wppKey = clienteWpp.replace(/\D/g,'');
        const snap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'fidelidade'));
        let existente = null;
        snap.forEach(d=>{ if(d.data().wpp===wppKey) existente={id:d.id,...d.data()}; });

        if(existente){
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'fidelidade',existente.id),{
                cortes: existente.cortes+1,
                nome: clienteNome,
                ultimoCorte: new Date().toISOString()
            });
        } else {
            await addDoc(collection(db,'barbeiros',barbeiroData.uid,'fidelidade'),{
                wpp: wppKey, nome: clienteNome, cortes:1,
                criadoEm: new Date().toISOString(),
                ultimoCorte: new Date().toISOString()
            });
        }
    }catch(e){ console.error('registrarFidelidade:',e); }
}

// ══════════════════════════════════════════════════════════
// ACORDOS COM CLIENTE — "4 cortes por mês por R$120", sem aparecer
// como desconto. Fica separado do sistema de promoção/cupom.
// ══════════════════════════════════════════════════════════

const LABEL_PERIODO_ACORDO = {semanal:'semana', mensal:'mês', anual:'ano'};

// Calcula se o acordo precisa resetar a contagem (virou a semana/mês/ano
// desde a última vez que resetou), de forma simples e sem drift.
function acordoPrecisaResetar(acordo){
    const hoje = new Date();
    const ultimo = new Date(acordo.ultimoReset || acordo.criadoEm);
    if(acordo.periodo === 'anual'){
        return hoje.getFullYear() !== ultimo.getFullYear();
    }
    if(acordo.periodo === 'mensal'){
        return hoje.getFullYear()!==ultimo.getFullYear() || hoje.getMonth()!==ultimo.getMonth();
    }
    // semanal — reseta a cada 7 dias corridos desde o último reset
    const dias = Math.floor((hoje - ultimo) / (1000*60*60*24));
    return dias >= 7;
}

async function carregarAcordos(){
    const cont = document.getElementById('lista-acordos');
    if(!cont) return;
    try{
        const snap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'acordosCliente'));
        const acordos = [];
        snap.forEach(d=>acordos.push({id:d.id,...d.data()}));

        // Corrige o reset de cada acordo que precisar, antes de mostrar
        for(const acordo of acordos){
            if(acordo.ativo && acordoPrecisaResetar(acordo)){
                acordo.qtdUsada = 0;
                acordo.ultimoReset = new Date().toISOString();
                await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'acordosCliente',acordo.id), {
                    qtdUsada: 0, ultimoReset: acordo.ultimoReset
                });
            }
        }

        const ativos = acordos.filter(a=>a.ativo!==false);
        if(!ativos.length){
            cont.innerHTML = '<div class="empty-state"><div class="icon">🤝</div>Nenhum acordo criado ainda.</div>';
            return;
        }
        cont.innerHTML = ativos.map(a=>{
            const pct = a.qtdTotal>0 ? Math.min(100, Math.round((a.qtdUsada/a.qtdTotal)*100)) : 0;
            const estourou = a.qtdUsada > a.qtdTotal;
            const cor = estourou ? 'var(--red)' : pct>=100 ? 'var(--yellow)' : 'var(--green)';
            return `<div class="card" style="margin-bottom:.6rem">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem">
                    <div>
                        <div style="font-weight:700;font-size:.88rem">${escapeHtml(a.clienteNome||'—')}</div>
                        <div style="font-size:.7rem;color:var(--muted)">R$${Number(a.valorAcordado||0).toFixed(2)} / ${LABEL_PERIODO_ACORDO[a.periodo]||a.periodo}</div>
                    </div>
                    <button class="btn-del" data-del-acordo="${a.id}" title="Encerrar acordo" style="flex-shrink:0">✗</button>
                </div>
                <div style="height:7px;background:var(--card2);border-radius:4px;overflow:hidden;margin-bottom:.35rem">
                    <div style="height:100%;width:${pct}%;background:${cor}"></div>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <span style="font-size:.75rem;color:${cor};font-weight:700">${a.qtdUsada||0} / ${a.qtdTotal} cortes ${estourou?'(passou do combinado)':''}</span>
                    <button data-add-uso-acordo="${a.id}" style="padding:.3rem .65rem;background:rgba(168,85,247,.1);border:1.5px solid #a855f7;border-radius:6px;color:#a855f7;font-size:.72rem;cursor:pointer;font-weight:700">+1 corte manual</button>
                </div>
            </div>`;
        }).join('');

        cont.querySelectorAll('[data-add-uso-acordo]').forEach(btn=>{
            btn.addEventListener('click', async()=>{
                btn.disabled = true;
                await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'acordosCliente',btn.dataset.addUsoAcordo), {qtdUsada: increment(1)});
                toast('✓ Corte registrado no acordo');
                carregarAcordos();
            });
        });
        cont.querySelectorAll('[data-del-acordo]').forEach(btn=>{
            btn.addEventListener('click', async()=>{
                if(!confirm('Encerrar esse acordo? Ele deixa de contar cortes.')) return;
                await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'acordosCliente',btn.dataset.delAcordo), {ativo:false});
                toast('Acordo encerrado');
                carregarAcordos();
            });
        });
    }catch(e){ console.error('carregarAcordos:',e); }
}

function initAcordosExtras(){
    document.getElementById('btn-add-acordo').addEventListener('click', async()=>{
        const wpp = document.getElementById('acordo-cliente-select').value;
        const nomeOpt = document.getElementById('acordo-cliente-select').selectedOptions[0];
        const nome = nomeOpt ? nomeOpt.textContent : '';
        const qtd = parseInt(document.getElementById('acordo-qtd').value);
        const valor = parseFloat(document.getElementById('acordo-valor').value);
        const periodo = document.getElementById('acordo-periodo').value;

        if(!wpp){ toast('Selecione um cliente','var(--red)'); return; }
        if(!qtd || qtd<1){ toast('Informe a quantidade de cortes','var(--red)'); return; }
        if(isNaN(valor) || valor<0){ toast('Informe o valor combinado','var(--red)'); return; }

        const btn = document.getElementById('btn-add-acordo');
        btn.disabled = true;
        try{
            await addDoc(collection(db,'barbeiros',barbeiroData.uid,'acordosCliente'), {
                clienteNome: nome, clienteWhatsapp: wpp,
                qtdTotal: qtd, qtdUsada: 0,
                valorAcordado: valor, periodo,
                ativo: true,
                criadoEm: new Date().toISOString(),
                ultimoReset: new Date().toISOString()
            });
            toast('✓ Acordo criado!');
            document.getElementById('acordo-cliente-select').value='';
            document.getElementById('acordo-qtd').value='';
            document.getElementById('acordo-valor').value='';
            carregarAcordos();
        }catch(e){ toast('Erro ao criar: '+e.message,'var(--red)'); }
        btn.disabled = false;
    });
    carregarAcordos();
}

// Chamada automaticamente por registrarClienteConcluido (barbeiro.html)
// toda vez que um corte é concluído — não importa se veio de agendamento
// online, presencial, fila ou registro de pagamento.
window.registrarUsoAcordo = async function(clienteWhatsapp){
    if(!clienteWhatsapp) return;
    try{
        const snap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'acordosCliente'));
        let acordoAtivo = null;
        snap.forEach(d=>{
            const dados = d.data();
            if(dados.ativo!==false && dados.clienteWhatsapp===clienteWhatsapp && !acordoAtivo){
                acordoAtivo = {id:d.id, ...dados};
            }
        });
        if(!acordoAtivo) return;

        if(acordoPrecisaResetar(acordoAtivo)){
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'acordosCliente',acordoAtivo.id), {
                qtdUsada: 1, ultimoReset: new Date().toISOString()
            });
        } else {
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'acordosCliente',acordoAtivo.id), {
                qtdUsada: increment(1)
            });
        }
        if(typeof carregarAcordos==='function') carregarAcordos();
    }catch(e){ console.error('registrarUsoAcordo:',e); }
};
