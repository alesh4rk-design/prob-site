// ══════════════════════════════════════════════════════════
// AGENDAMENTOS E FILA DE ESPERA — agendamentos.js
//
// Script comum (não é módulo ES). Usa window.$, window.escapeHtml,
// window.escAttr, window.toast, window.fmtHoje, window.barbeiroData,
// window.registrarClienteConcluido, window.gerarSlots, window.horaParaMin,
// window.abrirModalVendaCliente (definida em estoque.js) e as funções do
// Firestore, disponibilizadas pelo módulo principal. Ver docs/README.md.
// ══════════════════════════════════════════════════════════

// AGENDAMENTOS — tempo real
let unsubAgendamentos=null;
let ultimaListaAppts=[];
// ══ AGENDAMENTO PRESENCIAL ══
// ══ FILA DE ESPERA ══
let unsubFila=null;

// Serviços com múltipla escolha (Fila e Agendamento Presencial usam o
// mesmo padrão) — desenha os checkboxes e mantém o total sempre atualizado.
function renderChecklistCortes(containerId, totalId){
    const cont = document.getElementById(containerId);
    const cortes = barbeiroData.cortes||[];
    if(!cortes.length){
        cont.innerHTML = '<p style="font-size:.78rem;color:var(--muted);margin:0">Nenhum serviço cadastrado ainda — cadastre na aba Cortes.</p>';
        return;
    }
    cont.innerHTML = cortes.map((c,i)=>
        `<label style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;font-size:.85rem;cursor:pointer">
            <input type="checkbox" class="checklist-corte" data-idx="${i}" data-preco="${c.preco}" style="width:16px;height:16px;accent-color:var(--green)">
            <span style="flex:1">${escapeHtml(c.nome)}</span>
            <span style="color:var(--muted)">R$${Number(c.preco).toFixed(0)}</span>
        </label>`
    ).join('');
    cont.querySelectorAll('.checklist-corte').forEach(chk=>{
        chk.addEventListener('change', ()=>atualizarTotalChecklist(containerId, totalId));
    });
    atualizarTotalChecklist(containerId, totalId);
}

function atualizarTotalChecklist(containerId, totalId){
    const marcados = document.querySelectorAll(`#${containerId} .checklist-corte:checked`);
    const total = Array.from(marcados).reduce((s,c)=>s+Number(c.dataset.preco||0),0);
    document.getElementById(totalId).textContent = `Total: R$${total.toFixed(2).replace('.',',')}`;
}

// Junta os serviços marcados num nome só ("Corte + Barba") e soma o preço —
// assim o resto do sistema (Gestão, relatórios) continua enxergando um
// "corte" e um "preço" só, sem precisar mudar nada em mais lugar nenhum.
function getSelecaoCortes(containerId){
    const cortes = barbeiroData.cortes||[];
    const marcados = Array.from(document.querySelectorAll(`#${containerId} .checklist-corte:checked`));
    if(!marcados.length) return null;
    const selecionados = marcados.map(chk=>cortes[Number(chk.dataset.idx)]).filter(Boolean);
    return {
        nome: selecionados.map(c=>c.nome).join(' + '),
        preco: selecionados.reduce((s,c)=>s+Number(c.preco||0),0)
    };
}

function initFila(){
    const equipe=barbeiroData.equipe||[];
    const wrap=document.getElementById('fila-equipe-wrap');
    const sel=document.getElementById('fila-select-barbeiro');

    if(equipe.length>0){
        wrap.style.display='block';
        sel.innerHTML=equipe.map(b=>`<option value="${b.nome}">${b.nome}</option>`).join('');
    } else {
        wrap.style.display='none';
    }

    renderChecklistCortes('fila-corte-lista','fila-corte-total');

    const btnAdd=document.getElementById('btn-add-fila');
    if(!btnAdd.dataset.bound){
        btnAdd.dataset.bound='1';
        btnAdd.addEventListener('click',adicionarNaFila);
        document.getElementById('fila-nome').addEventListener('keypress',e=>{if(e.key==='Enter')adicionarNaFila();});
    }

    // Link do painel de chamada (monitor/TV)
    const isLocalFila = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const baseUrl = isLocalFila
        ? window.location.origin + '/'
        : 'https://alesh4rk-design.github.io/prob-site/';
    const linkPainel=baseUrl+'painel-chamada.html?b='+barbeiroData.uid;
    const linkEl=document.getElementById('link-painel-chamada');
    if(linkEl)linkEl.textContent=linkPainel;
    const btnAbrirPainel=document.getElementById('btn-abrir-painel');
    if(btnAbrirPainel)btnAbrirPainel.href=linkPainel;
    const btnCopyPainel=document.getElementById('btn-copy-painel');
    if(btnCopyPainel && !btnCopyPainel.dataset.bound){
        btnCopyPainel.dataset.bound='1';
        btnCopyPainel.addEventListener('click',()=>{
            navigator.clipboard.writeText(linkPainel).then(()=>toast('Link copiado!'));
        });
    }

    carregarFila();
}

async function adicionarNaFila(){
    const nome=document.getElementById('fila-nome').value.trim();
    if(!nome){toast('Informe o nome do cliente','var(--red)');return;}

    const selecao=getSelecaoCortes('fila-corte-lista');
    if(!selecao){toast('Marque ao menos um serviço antes de adicionar na fila','var(--red)');return;}

    const wppInput=document.getElementById('fila-wpp');
    const wpp=wppInput?wppInput.value.replace(/\D/g,''):'';

    const equipe=barbeiroData.equipe||[];
    const barbeiroNome=equipe.length>0?document.getElementById('fila-select-barbeiro').value:'';

    const btn=document.getElementById('btn-add-fila');
    btn.disabled=true;

    try{
        await addDoc(collection(db,'fila'),{
            barbeiroId:barbeiroData.uid,
            clienteNome:nome,
            clienteWhatsapp:wpp,
            barbeiro:barbeiroNome,
            corte:selecao.nome,
            preco:selecao.preco,
            status:'aguardando',
            criadoEm:new Date().toISOString(),
            origem:'painel'
        });
        document.getElementById('fila-nome').value='';
        if(wppInput)wppInput.value='';
        document.querySelectorAll('#fila-corte-lista .checklist-corte:checked').forEach(chk=>chk.checked=false);
        atualizarTotalChecklist('fila-corte-lista','fila-corte-total');
        toast('✓ Adicionado à fila!');
    }catch(e){
        toast('Erro: '+e.message,'var(--red)');
    }
    btn.disabled=false;
}

let ultimaListaFila = [];
function carregarFila(){
    if(unsubFila)unsubFila();
    const q=query(collection(db,'fila'),where('barbeiroId','==',barbeiroData.uid),where('status','==','aguardando'));
    unsubFila=onSnapshot(q,snap=>{
        let lista=[];
        snap.forEach(d=>lista.push({id:d.id,...d.data()}));
        lista.sort((a,b)=>new Date(a.criadoEm)-new Date(b.criadoEm));
        ultimaListaFila=lista;
        renderFila(lista);
    },e=>console.error('Erro fila:',e));
}

async function verificarConflitoAgendamento(barbeiroFiltro){
    try{
        const hoje=fmtHoje();
        const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid),where('data','==',hoje));
        const snap=await getDocs(q);
        const agora=new Date();
        const agoraMin=agora.getHours()*60+agora.getMinutes();

        let proximoConflito=null;
        snap.forEach(d=>{
            const a=d.data();
            if(a.status==='cancelado'||a.status==='concluido')return;
            if(barbeiroFiltro && a.barbeiro!==barbeiroFiltro)return;
            const min=horaParaMin(a.hora);
            // Conflito se o agendamento é nos próximos 30 minutos
            if(min>=agoraMin && min<=agoraMin+30){
                if(!proximoConflito || min<horaParaMin(proximoConflito))proximoConflito=a.hora;
            }
        });
        return proximoConflito?`às ${proximoConflito}`:null;
    }catch(e){return null;}
}

async function atenderFila(filaId){
    const item=ultimaListaFila.find(l=>l.id===filaId);
    if(!item) return;

    if(barbeiroData.modoAtendimento==='ambos'){
        const conflito=await verificarConflitoAgendamento(item.barbeiro);
        if(conflito){
            const continuar=confirm(`⚠️ Atenção!\n\nVocê tem um cliente agendado ${conflito} para ${item.barbeiro?'o barbeiro '+item.barbeiro:'agora'}.\n\nAtender ${item.clienteNome} da fila pode atrasar esse compromisso.\n\nDeseja continuar mesmo assim?`);
            if(!continuar)return;
        }
    }

    // Cria agendamento concluído para contar no faturamento — carrega o
    // WhatsApp e a forma de pagamento que já tinham sido registrados na fila
    await addDoc(collection(db,'agendamentos'),{
        barbeiroId:barbeiroData.uid,
        clienteNome:item.clienteNome,
        clienteWhatsapp:item.clienteWhatsapp||'',
        corte:item.corte||'Corte (fila)',
        preco:item.preco||0,
        barbeiro:item.barbeiro||'',
        data:fmtHoje(),
        hora:new Date().toTimeString().slice(0,5),
        status:'concluido',
        origem:'fila',
        ...(item.formaPagamento?{formaPagamento:item.formaPagamento}:{}),
        criadoEm:new Date().toISOString()
    });
    await updateDoc(doc(db,'fila',filaId),{status:'atendido',atendidoEm:new Date().toISOString()});
    registrarClienteConcluido(barbeiroData.uid, item.clienteNome, item.clienteWhatsapp, item.corte||'Corte (fila)');
    toast('✓ Atendimento concluído!');
}

async function removerFila(filaId){
    if(!confirm('Remover da fila?')) return false;
    await updateDoc(doc(db,'fila',filaId),{status:'removido'});
    toast('Removido da fila');
    return true;
}

function renderFila(lista){
    const cont=document.getElementById('lista-fila');
    if(!cont)return;
    if(!lista.length){cont.innerHTML='<div class="empty-state"><div class="icon">🪑</div>Ninguém na fila no momento.</div>';return;}

    const equipe=barbeiroData.equipe||[];
    // Agrupa por barbeiro se houver equipe
    if(equipe.length>0){
        const porBarbeiro={};
        lista.forEach(item=>{
            const nome=item.barbeiro||'Sem barbeiro definido';
            if(!porBarbeiro[nome])porBarbeiro[nome]=[];
            porBarbeiro[nome].push(item);
        });
        cont.innerHTML=Object.entries(porBarbeiro).map(([barb,itens])=>`
            <div style="font-size:.75rem;color:var(--blue);font-weight:700;margin:.75rem 0 .4rem;text-transform:uppercase;letter-spacing:.5px">✂️ ${barb} — ${itens.length} aguardando</div>
            ${itens.map((item,i)=>renderFilaCard(item,i+1)).join('')}
        `).join('');
    } else {
        cont.innerHTML=lista.map((item,i)=>renderFilaCard(item,i+1)).join('');
    }
}

function renderFilaCard(item,posicao){
    const tempo=Math.floor((new Date()-new Date(item.criadoEm))/60000);
    const tempoStr=tempo<1?'agora':tempo<60?`${tempo}min`:`${Math.floor(tempo/60)}h${tempo%60}min`;
    const corteTag=item.corte?` · ${escapeHtml(item.corte)}`:'';
    const barbeiroTag=item.barbeiro?`<span style="display:inline-flex;align-items:center;gap:.25rem;margin-left:.4rem;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);border-radius:20px;padding:.1rem .5rem;font-size:.68rem;color:rgba(0,212,255,.85);font-weight:600">✂️ ${escapeHtml(item.barbeiro)}</span>`:'';
    const promoTagFila=gerarBadgePromoCliente(item.clienteWhatsapp);
    const pagoTag=item.formaPagamento?`<span style="display:inline-flex;align-items:center;gap:.2rem;margin-left:.4rem;background:rgba(0,255,136,.1);border:1px solid rgba(0,255,136,.25);border-radius:20px;padding:.1rem .5rem;font-size:.68rem;color:var(--green);font-weight:600">💳 ${LABEL_PAGAMENTO_CURTO[item.formaPagamento]||item.formaPagamento}</span>`:'';
    return `<div class="fila-card" style="cursor:pointer" title="Ver ações do cliente" onclick="abrirAcoesCliente('${escAttr(item.clienteNome||'')}','${escAttr(item.clienteWhatsapp||'')}',null,'','',null,'${item.id}')">
        <div class="fila-pos">${posicao}º</div>
        <div class="fila-info">
            <div class="fila-nome">${escapeHtml(item.clienteNome)}</div>
            <div class="fila-meta" style="display:flex;align-items:center;flex-wrap:wrap;gap:.25rem">
                <span>Aguardando há ${tempoStr}${corteTag}</span>${barbeiroTag}${promoTagFila}${pagoTag}
            </div>
        </div>
    </div>`;
}

const LABEL_PAGAMENTO_CURTO = {dinheiro:'Dinheiro',pix:'Pix',debito:'Débito',credito:'Crédito',pendente:'Não pago'};



function initPresencial(){
    const btnAbrir=document.getElementById('btn-abrir-presencial');
    const modal=document.getElementById('modal-presencial');
    if(!btnAbrir||!modal)return;

    btnAbrir.addEventListener('click',()=>{
        renderChecklistCortes('pres-corte-lista','pres-corte-total');

        // Popula equipe se houver
        const equipe=barbeiroData.equipe||[];
        const eqWrap=document.getElementById('pres-equipe-wrap');
        const eqSel=document.getElementById('pres-barbeiro');
        if(equipe.length>0){
            eqWrap.style.display='block';
            eqSel.innerHTML='<option value="">Selecione...</option>'+
                equipe.map(b=>`<option value="${b.nome}">${b.nome}</option>`).join('');
        } else {
            eqWrap.style.display='none';
        }

        // Data padrão hoje
        const hoje=fmtHoje();
        document.getElementById('pres-data').value=hoje;
        document.getElementById('pres-data').min=hoje;
        document.getElementById('pres-nome').value='';
        document.getElementById('pres-wpp').value='';
        document.getElementById('pres-status-msg').textContent='';

        carregarHorasPresencial();
        modal.style.display='flex';
    });

    document.getElementById('pres-data').addEventListener('change',carregarHorasPresencial);
    document.getElementById('pres-barbeiro').addEventListener('change',carregarHorasPresencial);

    document.getElementById('btn-confirmar-presencial').addEventListener('click',confirmarPresencial);
}

async function carregarHorasPresencial(){
    const data=document.getElementById('pres-data').value;
    const horaSel=document.getElementById('pres-hora');
    const statusMsg=document.getElementById('pres-status-msg');
    if(!data){horaSel.innerHTML='<option value="">Selecione data</option>';return;}

    horaSel.innerHTML='<option value="">Carregando...</option>';

    const dateObj=new Date(data+'T12:00:00');
    const diaSemana=dateObj.getDay();
    const func=funcData[diaSemana]||{aberto:false,inicio:'08:00',fim:'18:00'};

    if(!func.aberto){
        horaSel.innerHTML='<option value="">Fechado neste dia</option>';
        statusMsg.textContent='⚠️ Barbearia fechada neste dia da semana.';
        statusMsg.style.color='var(--red)';
        return;
    }

    const iniMin=horaParaMin(func.inicio);
    const fimMin=horaParaMin(func.fim);
    const barbSel=document.getElementById('pres-barbeiro').value;

    // Busca agendamentos do dia
    const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid),where('data','==',data));
    let snap;try{snap=await getDocs(q);}catch(e){snap={forEach:()=>{}};}
    const ocupadas=new Set();
    snap.forEach(d=>{
        const ag=d.data();
        if(ag.status==='cancelado')return;
        if(barbSel){if(ag.barbeiro===barbSel)ocupadas.add(ag.hora);}
        else ocupadas.add(ag.hora);
    });

    // Bloqueios
    const bloqKey=barbSel?`${data}_${barbSel}`:data;
    const bSnap=await getDoc(doc(db,'barbeiros',barbeiroData.uid,'bloqueios',bloqKey));
    const bloqueadas=bSnap.exists()?(bSnap.data().horas||[]):[];

    const agora=new Date();
    const isHoje=data===fmtHoje();
    const agoraMin=isHoje?agora.getHours()*60+agora.getMinutes():0;

    const slots=gerarSlots(iniMin,fimMin,intervaloMin);

    const disponiveis=slots.filter(s=>!ocupadas.has(s)&&!bloqueadas.includes(s)&&!(isHoje&&horaParaMin(s)<=agoraMin));

    if(!disponiveis.length){
        horaSel.innerHTML='<option value="">Sem horários livres</option>';
        statusMsg.textContent='⚠️ Não há horários disponíveis neste dia.';
        statusMsg.style.color='var(--yellow)';
        return;
    }

    horaSel.innerHTML='<option value="">Selecione...</option>'+
        disponiveis.map(h=>`<option value="${h}">${h}</option>`).join('');
    statusMsg.textContent=`✓ ${disponiveis.length} horário(s) disponível(is)`;
    statusMsg.style.color='var(--green)';
}

async function confirmarPresencial(){
    const nome=document.getElementById('pres-nome').value.trim();
    const wpp=document.getElementById('pres-wpp').value.replace(/\D/g,'');
    const selecao=getSelecaoCortes('pres-corte-lista');
    const equipe=barbeiroData.equipe||[];
    const barbeiroNome=equipe.length>0?document.getElementById('pres-barbeiro').value:'';
    const data=document.getElementById('pres-data').value;
    const hora=document.getElementById('pres-hora').value;
    const statusMsg=document.getElementById('pres-status-msg');

    if(!nome){toast('Informe o nome do cliente','var(--red)');return;}
    if(!selecao){toast('Selecione pelo menos um serviço','var(--red)');return;}
    if(equipe.length>0&&!barbeiroNome){toast('Selecione o barbeiro','var(--red)');return;}
    if(!data||!hora){toast('Selecione data e horário','var(--red)');return;}

    const btn=document.getElementById('btn-confirmar-presencial');
    btn.disabled=true;btn.textContent='Salvando...';

    try{
        // Verifica novamente se o horário ainda está livre (evita conflito)
        const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid),where('data','==',data));
        const snap=await getDocs(q);
        let ocupado=false;
        snap.forEach(d=>{
            const ag=d.data();
            if(ag.status==='cancelado')return;
            if(ag.hora!==hora)return;
            if(barbeiroNome){if(ag.barbeiro===barbeiroNome)ocupado=true;}
            else ocupado=true;
        });
        if(ocupado){
            statusMsg.textContent='⚠️ Esse horário acabou de ser ocupado. Escolha outro.';
            statusMsg.style.color='var(--red)';
            btn.disabled=false;btn.textContent='Confirmar Agendamento';
            carregarHorasPresencial();
            return;
        }

        await addDoc(collection(db,'agendamentos'),{
            barbeiroId:barbeiroData.uid,
            clienteNome:nome,
            clienteWhatsapp:wpp||'',
            corte:selecao.nome,
            preco:selecao.preco,
            barbeiro:barbeiroNome,
            data,hora,
            status:'pendente',
            origem:'presencial',
            criadoEm:new Date().toISOString()
        });

        toast('✓ Agendamento presencial criado!');
        document.getElementById('modal-presencial').style.display='none';
    }catch(e){
        toast('Erro ao salvar: '+e.message,'var(--red)');
    }
    btn.disabled=false;btn.textContent='Confirmar Agendamento';
}

// Cache de promoções individuais e fidelidade por WhatsApp do cliente,
// usado para mostrar um selo na Agenda quando o cliente tem algo ativo.
let cachePromoPorWpp = {};
let cacheFidelidadePorWpp = {};
async function carregarCachePromoCliente(){
    try{
        const hoje=fmtHoje();
        const promosSnap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'promocoes'));
        cachePromoPorWpp = {};
        promosSnap.forEach(d=>{
            const p={id:d.id,...d.data()};
            if(p.tipo!=='individual' || !p.ativo || p.alvo!=='cliente' || !p.clienteWpp) return;
            if(p.validoAte && hoje>p.validoAte) return;
            const restam=(p.limiteUsos||1)-(p.usosFeitos||0);
            if(restam<=0) return;
            cachePromoPorWpp[p.clienteWpp]=p;
        });

        const fidPromosSnap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'promocoes'));
        const metasFidelidade=[];
        fidPromosSnap.forEach(d=>{ const p=d.data(); if(p.tipo==='fidelidade'&&p.ativo) metasFidelidade.push(p); });

        cacheFidelidadePorWpp = {};
        if(metasFidelidade.length){
            const fidSnap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'fidelidade'));
            fidSnap.forEach(d=>{ cacheFidelidadePorWpp[d.id]={id:d.id,...d.data()}; });
        }
        window.__metasFidelidade = metasFidelidade;
    }catch(e){ console.error('carregarCachePromoCliente:',e); }

    // Re-renderiza o que já estava na tela, agora com os selos de promoção
    if(ultimosAgendamentos.deHoje.length || ultimosAgendamentos.proximos.length){
        renderAppts($('lista-agendamentos'),ultimosAgendamentos.deHoje,'Nenhum agendamento hoje ainda.');
        renderAppts($('lista-proximos'),ultimosAgendamentos.proximos,'Nenhum agendamento futuro.');
    }
    if(ultimaListaFila.length) renderFila(ultimaListaFila);
}

// Monta o selinho para mostrar no card do agendamento, se o cliente tiver
// promoção individual ativa e/ou estiver no programa de fidelidade.
function gerarBadgePromoCliente(wpp){
    if(!wpp) return '';
    let html='';
    const promo=cachePromoPorWpp[wpp];
    if(promo){
        const restam=(promo.limiteUsos||1)-(promo.usosFeitos||0);
        const valorFmt=promo.descontoTipo==='percentual'?`${promo.descontoValor}%`:`R$${Number(promo.descontoValor).toFixed(0)}`;
        html+=`<span class="appt-barber-tag" style="background:rgba(0,255,136,.12);color:var(--green);border-color:rgba(0,255,136,.3)" title="Desconto de ${valorFmt}, restam ${restam} uso(s)">🎁 ${valorFmt} off · ${restam}x restante${restam>1?'s':''}</span>`;
    }
    const fid=cacheFidelidadePorWpp[wpp];
    const metas=window.__metasFidelidade||[];
    if(fid && metas.length){
        const meta=metas[0]; // programa mais recente ativo
        const feitos=fid.cortes||0;
        html+=`<span class="appt-barber-tag" style="background:rgba(245,166,35,.12);color:var(--yellow);border-color:rgba(245,166,35,.3)" title="${meta.brinde} a cada ${meta.meta} cortes">⭐ ${feitos}/${meta.meta} p/ ${escapeHtml(meta.brinde||'brinde')}</span>`;
    }
    return html;
}

let ultimosAgendamentos = {deHoje:[], proximos:[], pagtoPendente:[]};

// Renderiza a lista de "aguardando pagamento" — usada tanto na aba
// Agendamentos quanto na aba Fila, então fica numa função só.
function renderPagtoPendente(wrapId, badgeId, listaId, pagtoPendente){
    const wrap = document.getElementById(wrapId);
    const badge = document.getElementById(badgeId);
    const lista = document.getElementById(listaId);
    if(!wrap || !badge || !lista) return;
    if(pagtoPendente.length > 0){
        wrap.style.display = 'block';
        badge.textContent = pagtoPendente.length;
        renderAppts(lista, pagtoPendente, 'Nada pendente.');
    } else {
        wrap.style.display = 'none';
    }
}

function carregarAgendamentos(){
    if(unsubAgendamentos)unsubAgendamentos();
    carregarCachePromoCliente();
    const hoje=fmtHoje();
    const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid));
    unsubAgendamentos=onSnapshot(q,snap=>{
        const todos=[];snap.forEach(d=>todos.push({id:d.id,...d.data()}));
        todos.sort((a,b)=>a.data===b.data?a.hora.localeCompare(b.hora):a.data.localeCompare(b.data));

        const deHoje   = todos.filter(a=>a.data===hoje);
        const proximos = todos.filter(a=>a.data>hoje);

        // Aguardando pagamento: qualquer atendimento marcado como "ainda não
        // pagou" — não importa se já foi concluído ou não (pagamento e
        // conclusão são coisas independentes agora), nem o mês (uma dívida
        // antiga continua sendo dívida). Cancelado não conta.
        const pagtoPendente = todos.filter(a=>
            a.status !== 'cancelado' &&
            a.formaPagamento === 'pendente'
        );
        ultimosAgendamentos = {deHoje, proximos, pagtoPendente};

        $('stat-hoje').textContent=deHoje.filter(a=>a.status!=='cancelado').length;
        $('stat-semana').textContent=todos.filter(a=>a.data>=hoje&&a.status!=='cancelado').length;
        const receita=deHoje.filter(a=>a.status==='concluido').reduce((s,a)=>s+Number(a.preco||0),0);
        $('stat-receita').textContent='R$'+receita.toFixed(0);
        $('stat-cancelados').textContent=deHoje.filter(a=>a.status==='cancelado').length;

        renderAppts($('lista-agendamentos'),deHoje,'Nenhum agendamento hoje ainda.');
        renderAppts($('lista-proximos'),proximos,'Nenhum agendamento futuro.');

        renderPagtoPendente('pagto-pendente-wrap','pagto-pendente-badge','lista-pagto-pendente-agendamentos',pagtoPendente);
        renderPagtoPendente('pagto-pendente-wrap-fila','pagto-pendente-badge-fila','lista-pagto-pendente-fila',pagtoPendente);
    },e=>console.error('Erro agendamentos:',e));
}

function renderAppts(container,lista,emptyMsg){
    ultimaListaAppts=lista;
    if(!lista.length){container.innerHTML=`<div class="empty-state"><div class="icon">📅</div>${emptyMsg}</div>`;return;}
    container.innerHTML=lista.map(a=>{
        const barberTag=a.barbeiro?`<span class="appt-barber-tag">✂️ ${a.barbeiro}</span>`:'';
        const presencialTag=a.origem==='presencial'?`<span class="appt-barber-tag" style="background:rgba(255,255,255,.06);color:var(--muted)">🏠 presencial</span>`:'';
        const promoTag=gerarBadgePromoCliente(a.clienteWhatsapp);
        const dataFmt=(d=>{
            if(!d) return '';
            const [y,m,dia]=d.split('-');
            const hoje=fmtHoje();
            const ams=new Date(y,m-1,Number(dia)+1).toLocaleDateString('pt-BR',{weekday:'short'});
            if(d===hoje) return 'Hoje';
            const amanha=new Date(); amanha.setDate(amanha.getDate()+1);
            const amanhaStr=`${amanha.getFullYear()}-${String(amanha.getMonth()+1).padStart(2,'0')}-${String(amanha.getDate()).padStart(2,'0')}`;
            if(d===amanhaStr) return 'Amanhã';
            return `${dia}/${m} (${ams})`;
        })(a.data);
        const dataTag=dataFmt?`<span class="appt-sep">·</span><span style="font-size:.7rem;color:rgba(0,212,255,.75);font-weight:700">${dataFmt}</span>`:'';
        const concluido=a.status==='concluido';
        const cancelado=a.status==='cancelado';
        const statusBadge=concluido
            ?`<span class="badge badge-ok">✓ feito</span>`
            :cancelado
            ?`<span class="badge badge-cancel">✗ cancel.</span>`
            :`<span class="badge badge-pend">pend</span>`;
        return `<div class="appt-card ${concluido?'appt-done':cancelado?'appt-canceled':''}" style="cursor:pointer" title="Ver ações do cliente" onclick="abrirAcoesCliente('${escAttr(a.clienteNome||'')}','${escAttr(a.clienteWhatsapp||'')}','${a.id}','${escAttr(a.data||'')}','${escAttr(a.hora||'')}','${a.status||'pendente'}')">
            <div class="appt-time">${a.hora}</div>
            <div class="appt-info">
                <span class="appt-name">${escapeHtml(a.clienteNome)}</span>
                <span class="appt-sep">·</span>
                <span class="appt-corte">${escapeHtml(a.corte)}</span>
                ${barberTag}
                ${presencialTag}
                ${promoTag}
                ${dataTag}
                ${statusBadge}
            </div>
            <span class="appt-price">R$${Number(a.preco).toFixed(0)}</span>
        </div>`;
    }).join('');
}

// Reutilizadas tanto por qualquer botão solto que ainda exista quanto pelo
// menu de Ações do Cliente (que é onde ficam agora).
async function concluirAgendamento(id){
    const item=ultimaListaAppts.find(a=>a.id===id);
    await updateDoc(doc(db,'agendamentos',id),{status:'concluido'});
    if(item) registrarClienteConcluido(barbeiroData.uid, item.clienteNome, item.clienteWhatsapp, item.corte);
    carregarAgendamentos();
    toast('Corte concluído! ✓');
}

async function cancelarAgendamento(id){
    if(!confirm('Marcar como cancelado?')) return false;
    await updateDoc(doc(db,'agendamentos',id),{status:'cancelado'});
    carregarAgendamentos();
    toast('Agendamento cancelado','var(--red)');
    return true;
}

// ══════════════════════════════════════════════════════════
// AÇÕES DO CLIENTE — clicar no nome do cliente num agendamento abre
// esse menu: forma de pagamento, WhatsApp e modelos de mensagem prontos.
// ══════════════════════════════════════════════════════════
let acClienteAtual = {nome:'', wpp:'', agendamentoId:'', data:'', hora:''};

function fmtDataExtenso(dataStr){
    if(!dataStr) return '';
    const [y,m,d] = dataStr.split('-');
    const dias = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    const dataObj = new Date(Number(y), Number(m)-1, Number(d));
    return `${d}/${m} (${dias[dataObj.getDay()]})`;
}

const MENSAGENS_PRONTAS = {
    confirmacao: (c) => `Olá, ${c.nome}! Passando para confirmar seu horário marcado para ${fmtDataExtenso(c.data)} às ${c.hora} na ${barbeiroData.nome||'barbearia'}. Contamos com sua presença!`,
    promocao: (c) => `Olá, ${c.nome}! Temos uma condição especial disponível para você. Que tal aproveitar e agendar seu próximo horário?`,
    ausente: (c) => `Olá, ${c.nome}! Notamos que já faz um tempo desde sua última visita na ${barbeiroData.nome||'barbearia'}. Que tal agendar um novo horário? Ficaremos felizes em atendê-lo(a) novamente!`,
    agradecimento: (c) => `Olá, ${c.nome}! Obrigado pela visita. Esperamos que tenha gostado do resultado — até a próxima!`,
    atraso: (c) => `Olá, ${c.nome}! Pedimos desculpas, mas haverá um pequeno atraso no seu atendimento hoje. Agradecemos a compreensão!`,
};

window.abrirAcoesCliente = function(nome, wpp, agendamentoId, data, hora, status, filaId){
    acClienteAtual = {nome, wpp, agendamentoId, data, hora, status: status||'pendente', filaId: filaId||null};
    $('ac-nome-cliente').textContent = nome || 'Cliente';
    $('ac-wpp-cliente').textContent = wpp ? formatarWppExibicao(wpp) : 'WhatsApp não informado';
    $('ac-copiar-wpp').style.display = wpp ? 'inline' : 'none';

    const temAgendamento = !!agendamentoId;
    const temFila = !!filaId;
    const temVinculo = temAgendamento || temFila;

    // Forma de pagamento e desconto funcionam com agendamento OU fila
    // (pagamento adiantado, antes do atendimento acontecer). Sem nenhum
    // dos dois vinculados (ex: aberto pela aba Clientes), ficam escondidos.
    $('ac-secao-pagamento').style.display = temVinculo ? '' : 'none';

    if(!temVinculo){
        $('ac-status-badge').style.display = 'none';
        $('ac-btn-concluir').style.display = 'none';
        $('ac-btn-cancelar').style.display = 'none';
        $('modal-acoes-cliente').style.display = 'flex';
        return;
    }

    // Marca visualmente a forma de pagamento já registrada, se houver
    document.querySelectorAll('.ac-pag-btn').forEach(b=>b.classList.remove('active'));
    let formaPagamentoAtual = null;
    if(temFila){
        const item = ultimaListaFila.find(f=>f.id===filaId);
        formaPagamentoAtual = item?.formaPagamento;
    } else {
        const item = ultimaListaAppts.find(a=>a.id===agendamentoId);
        formaPagamentoAtual = item?.formaPagamento;
    }
    if(formaPagamentoAtual){
        const btnAtivo = document.querySelector(`.ac-pag-btn[data-pag="${formaPagamentoAtual}"]`);
        if(btnAtivo) btnAtivo.classList.add('active');
    }

    const badge = $('ac-status-badge');
    if(temFila){
        // Fila: "Concluir/Cancelar" viram "Atender/Remover"
        badge.style.display = 'none';
        $('ac-btn-concluir').style.display = '';
        $('ac-btn-concluir').innerHTML = '✓<br>Atender';
        $('ac-btn-cancelar').style.display = '';
        $('ac-btn-cancelar').innerHTML = '✗<br>Remover';
    } else {
        $('ac-btn-concluir').innerHTML = '✓<br>Concluir';
        $('ac-btn-cancelar').innerHTML = '✗<br>Cancelar';
        const concluido = acClienteAtual.status==='concluido';
        const cancelado = acClienteAtual.status==='cancelado';
        if(concluido || cancelado){
            badge.style.display = 'block';
            badge.style.background = concluido ? 'rgba(0,255,136,.1)' : 'rgba(255,75,43,.1)';
            badge.style.color = concluido ? 'var(--green)' : 'var(--red)';
            badge.textContent = concluido ? '✓ Esse atendimento já foi concluído' : '✗ Esse agendamento foi cancelado';
            $('ac-btn-concluir').style.display = 'none';
            $('ac-btn-cancelar').style.display = 'none';
        } else {
            badge.style.display = 'none';
            $('ac-btn-concluir').style.display = '';
            $('ac-btn-cancelar').style.display = '';
        }
    }

    $('modal-acoes-cliente').style.display = 'flex';
};

function formatarWppExibicao(wpp){
    const limpo = (wpp||'').replace(/\D/g,'');
    if(limpo.length===11) return `(${limpo.slice(0,2)}) ${limpo.slice(2,7)}-${limpo.slice(7)}`;
    if(limpo.length===13) return `+${limpo.slice(0,2)} (${limpo.slice(2,4)}) ${limpo.slice(4,9)}-${limpo.slice(9)}`;
    return wpp;
}

function initAcoesClienteExtras(){
    $('btn-fechar-acoes-cliente').addEventListener('click', ()=>{
        $('modal-acoes-cliente').style.display = 'none';
    });

    $('ac-copiar-wpp').addEventListener('click', ()=>{
        navigator.clipboard.writeText(acClienteAtual.wpp).then(()=>toast('Número copiado!'));
    });

    $('ac-btn-vender').addEventListener('click', ()=>{
        if(typeof abrirModalVendaCliente!=='function'){ toast('Módulo de estoque ainda carregando, tenta de novo em instantes','var(--red)'); return; }
        $('modal-acoes-cliente').style.display = 'none';
        abrirModalVendaCliente(acClienteAtual.nome, acClienteAtual.wpp);
    });

    $('ac-btn-promocao').addEventListener('click', ()=>{
        if(typeof criarPromoParaCliente!=='function'){ toast('Módulo de promoções ainda carregando, tenta de novo em instantes','var(--red)'); return; }
        $('modal-acoes-cliente').style.display = 'none';
        criarPromoParaCliente(acClienteAtual.nome, acClienteAtual.wpp);
    });

    $('ac-btn-concluir').addEventListener('click', async()=>{
        $('modal-acoes-cliente').style.display = 'none';
        if(acClienteAtual.filaId){
            await atenderFila(acClienteAtual.filaId);
        } else if(acClienteAtual.agendamentoId){
            await concluirAgendamento(acClienteAtual.agendamentoId);
        }
    });

    $('ac-btn-cancelar').addEventListener('click', async()=>{
        if(acClienteAtual.filaId){
            const removeu = await removerFila(acClienteAtual.filaId);
            if(removeu) $('modal-acoes-cliente').style.display = 'none';
        } else if(acClienteAtual.agendamentoId){
            const cancelou = await cancelarAgendamento(acClienteAtual.agendamentoId);
            if(cancelou) $('modal-acoes-cliente').style.display = 'none';
        }
    });

    document.querySelectorAll('.ac-pag-btn').forEach(btn=>{
        btn.addEventListener('click', async()=>{
            if(!acClienteAtual.agendamentoId && !acClienteAtual.filaId){ toast('Esse cliente não tem nada vinculado agora','var(--red)'); return; }
            document.querySelectorAll('.ac-pag-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            try{
                // Forma de pagamento é independente de concluir o atendimento —
                // dá pra registrar mesmo em pagamento adiantado, antes do
                // corte acontecer. Grava no agendamento se já existir, ou na
                // fila (como uma "nota" que passa pro agendamento quando o
                // cliente for atendido).
                if(acClienteAtual.agendamentoId){
                    await updateDoc(doc(db,'agendamentos',acClienteAtual.agendamentoId), {formaPagamento:btn.dataset.pag});
                } else {
                    await updateDoc(doc(db,'fila',acClienteAtual.filaId), {formaPagamento:btn.dataset.pag});
                }
                toast('✓ Forma de pagamento registrada: '+btn.textContent.replace(/[^\wÀ-ÿ]/g,' ').trim());
                carregarAgendamentos();
            }catch(e){ toast('Erro ao salvar: '+e.message,'var(--red)'); }
        });
    });

    $('ac-btn-desconto').addEventListener('click', async()=>{
        if(!acClienteAtual.agendamentoId && !acClienteAtual.filaId){ toast('Esse cliente não tem nada vinculado agora','var(--red)'); return; }
        const naFila = !!acClienteAtual.filaId;
        const item = naFila
            ? ultimaListaFila.find(f=>f.id===acClienteAtual.filaId)
            : ultimaListaAppts.find(a=>a.id===acClienteAtual.agendamentoId);
        if(!item){ toast('Não encontrei esse registro','var(--red)'); return; }
        const precoAtual = item.precoOriginal!=null ? item.precoOriginal : (item.preco||0);

        const entrada = prompt(`Valor do corte: R$${Number(precoAtual).toFixed(2)}\n\nDigite o desconto — em reais (ex: 10) ou porcentagem (ex: 15%):`, '');
        if(!entrada) return;

        let novoPreco;
        let descontoTexto;
        if(entrada.trim().endsWith('%')){
            const pct = parseFloat(entrada.replace('%','').trim());
            if(isNaN(pct) || pct<=0 || pct>=100){ toast('Porcentagem inválida','var(--red)'); return; }
            novoPreco = precoAtual * (1 - pct/100);
            descontoTexto = `${pct}%`;
        } else {
            const valor = parseFloat(entrada.replace(',','.'));
            if(isNaN(valor) || valor<=0){ toast('Valor inválido','var(--red)'); return; }
            if(valor>=precoAtual){ toast('O desconto não pode ser maior ou igual ao valor do corte','var(--red)'); return; }
            novoPreco = precoAtual - valor;
            descontoTexto = `R$${valor.toFixed(2)}`;
        }
        novoPreco = Math.round(novoPreco*100)/100;

        try{
            if(naFila){
                await updateDoc(doc(db,'fila',acClienteAtual.filaId), { preco: novoPreco });
            } else {
                await updateDoc(doc(db,'agendamentos',acClienteAtual.agendamentoId), {
                    preco: novoPreco,
                    precoOriginal: precoAtual
                });
            }
            toast(`✓ Desconto de ${descontoTexto} aplicado — novo valor: R$${novoPreco.toFixed(2)}`);
            carregarAgendamentos();
        }catch(e){ toast('Erro ao aplicar desconto: '+e.message,'var(--red)'); }
    });

    document.querySelectorAll('.ac-msg-btn').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            if(!acClienteAtual.wpp){ toast('Esse cliente não tem WhatsApp cadastrado','var(--red)'); return; }
            const tipo = btn.dataset.msg;
            let texto = '';
            if(tipo==='personalizada'){
                texto = '';
            } else {
                texto = MENSAGENS_PRONTAS[tipo] ? MENSAGENS_PRONTAS[tipo](acClienteAtual) : '';
            }
            const url = `https://wa.me/55${acClienteAtual.wpp.replace(/\D/g,'')}?text=${encodeURIComponent(texto)}`;
            window.open(url, '_blank');
            $('modal-acoes-cliente').style.display = 'none';
        });
    });
}
