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
    // Agrupa por categoria (campo "sessao", cadastrado na aba Cortes) — sem
    // isso ficava tudo numa lista só, misturando por exemplo corte infantil
    // com adulto e espalhando barba no meio dos cortes de cabelo.
    const grupos = {};
    const ordemGrupos = [];
    cortes.forEach((c,i)=>{
        const cat = c.sessao || 'Outros';
        if(!grupos[cat]){ grupos[cat]=[]; ordemGrupos.push(cat); }
        grupos[cat].push({ ...c, _idx:i });
    });
    cont.innerHTML = ordemGrupos.map((cat,gi)=>`
        <div style="font-size:.72rem;font-weight:800;color:var(--blue);text-transform:uppercase;letter-spacing:.5px;margin:${gi===0?'0':'.7rem'} 0 .3rem">${escapeHtml(cat)}</div>
        ${grupos[cat].map(c=>
            `<label style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;font-size:.85rem;cursor:pointer">
                <input type="checkbox" class="checklist-corte" data-idx="${c._idx}" data-preco="${c.preco}" style="width:16px;height:16px;accent-color:var(--green)">
                <span style="flex:1">${escapeHtml(c.nome)}</span>
                <span style="color:var(--muted)">R$${Number(c.preco).toFixed(0)}</span>
            </label>`
        ).join('')}
    `).join('');
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
    const equipe=(barbeiroData.equipe||[]).filter(atendeClientes);
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
    $('modal-acoes-cliente').style.display = 'none';
    window.__perguntarConclusaoAposComprovante = null; // já foi concluído agora — não pergunta de novo
    abrirModalComprovante({
        nomeBarbearia: barbeiroData.nome || 'Barbearia',
        clienteNome: item.clienteNome,
        clienteWhatsapp: item.clienteWhatsapp,
        barbeiro: item.barbeiro || '',
        descricao: item.corte || 'Corte (fila)',
        valor: item.preco || 0,
        formaPagamento: item.formaPagamento || 'nao_informado'
    });
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

        // Popula equipe se houver (só quem corta cabelo de verdade)
        const equipe=(barbeiroData.equipe||[]).filter(atendeClientes);
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

// Cache de promoções vinculadas a cliente (simples/pacote/desconto/
// fidelidade — tudo, exceto cupom, que não tem dono) e de fidelidade por
// WhatsApp do cliente, usado para mostrar um selo na Agenda quando o
// cliente tem algo ativo.
let cachePromoPorWpp = {};
let cacheFidelidadePorWpp = {};
async function carregarCachePromoCliente(){
    try{
        const hoje=fmtHoje();
        const promosSnap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'promocoes'));
        cachePromoPorWpp = {};
        promosSnap.forEach(d=>{
            const p={id:d.id,...d.data()};
            if(p.tipo==='cupom' || !p.ativo || !p.clienteWpp) return;
            if(p.periodo==='personalizado' && (hoje<p.dataInicio || hoje>p.dataFim)) return;
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
        html+=`<span class="appt-barber-tag" style="background:rgba(0,255,136,.12);color:var(--green);border-color:rgba(0,255,136,.3)" title="${escapeHtml(promo.titulo||'Oferta ativa')}">🎁 ${escapeHtml(promo.titulo||'Oferta ativa')}</span>`;
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

let ultimosAgendamentos = {deHoje:[], proximos:[], pagtoPendente:[], canceladosPeloCliente:[]};

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

// Aba Cobrança — soma tudo que está marcado como "ainda não pagou" e lista
// cada cliente devedor, com um atalho pra cobrar no WhatsApp e pra marcar
// como pago (reaproveitando o modal de ações do cliente já existente).
function renderCobranca(pagtoPendente){
    const total = pagtoPendente.reduce((s,a)=>s+Number(a.preco||0),0);
    const totalEl = $('cobranca-total');
    const qtdEl = $('cobranca-qtd');
    const badgeEl = $('cobranca-badge-tab');
    if(!totalEl) return;
    totalEl.textContent = 'R$'+total.toFixed(2).replace('.',',');
    qtdEl.textContent = pagtoPendente.length;
    if(badgeEl){
        if(pagtoPendente.length>0){ badgeEl.style.display='inline-block'; badgeEl.textContent = pagtoPendente.length; }
        else badgeEl.style.display = 'none';
    }

    const cont = $('lista-cobranca');
    if(!cont) return;
    if(!pagtoPendente.length){
        cont.innerHTML = '<div class="empty-state"><div class="icon">✅</div>Nenhuma cobrança pendente — tudo em dia!</div>';
        return;
    }

    const ordenado = [...pagtoPendente].sort((a,b)=> (b.data+b.hora).localeCompare(a.data+a.hora));
    cont.innerHTML = ordenado.map(a=>{
        const wppNum = (a.clienteWhatsapp||'').replace(/\D/g,'');
        const msg = encodeURIComponent(`Olá ${a.clienteNome}! Passando pra lembrar do pagamento pendente de R$${Number(a.preco||0).toFixed(2)} referente ao seu atendimento em ${a.data?fmtDataExtenso(a.data):''}. Qualquer coisa é só chamar!`);
        const cobrarBtn = wppNum ? `<a href="https://wa.me/55${wppNum}?text=${msg}" target="_blank" class="btn-wpp" style="font-size:.72rem;padding:.4rem .7rem" onclick="event.stopPropagation()">📱 Cobrar</a>` : '';
        return `<div style="background:rgba(255,75,43,.05);border:1px solid rgba(255,75,43,.25);border-radius:10px;padding:.75rem 1rem;margin-bottom:.5rem;display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;cursor:pointer" title="Ver ações do cliente" onclick="abrirAcoesCliente('${escAttr(a.clienteNome||'')}','${escAttr(a.clienteWhatsapp||'')}','${a.id}','${escAttr(a.data||'')}','${escAttr(a.hora||'')}','${a.status||'pendente'}')">
            <div style="min-width:0">
                <div style="font-weight:700;font-size:.88rem">${escapeHtml(a.clienteNome||'—')}</div>
                <div style="font-size:.72rem;color:var(--muted);margin-top:.15rem">${escapeHtml(a.corte||'')} · ${a.data?fmtDataExtenso(a.data):''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:.6rem">
                <div style="font-family:'Courier New',monospace;font-weight:900;color:var(--red);font-size:1rem">R$${Number(a.preco||0).toFixed(2)}</div>
                ${cobrarBtn}
            </div>
        </div>`;
    }).join('');
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
        // Cancelados pelo próprio cliente (tela "Meus Agendamentos") — o
        // dono precisa saber, já que não foi ele quem cancelou.
        const canceladosPeloCliente = todos.filter(a=>a.status==='cancelado' && a.canceladoPor==='cliente');
        ultimosAgendamentos = {deHoje, proximos, pagtoPendente, canceladosPeloCliente};
        // Cache completo (não filtrado) usado pelo modal de ações do cliente
        // (desconto, forma de pagamento) — precisa ter TODOS os agendamentos,
        // não só os da lista que foi renderizada por último, senão um
        // cliente que não está em "aguardando pagamento" não é encontrado.
        ultimaListaAppts = todos;

        $('stat-hoje').textContent=deHoje.filter(a=>a.status!=='cancelado').length;
        $('stat-semana').textContent=todos.filter(a=>a.data>=hoje&&a.status!=='cancelado').length;
        const receita=deHoje.filter(a=>a.status==='concluido').reduce((s,a)=>s+Number(a.preco||0),0);
        $('stat-receita').textContent='R$'+receita.toFixed(0);
        $('stat-cancelados').textContent=deHoje.filter(a=>a.status==='cancelado').length;

        renderAppts($('lista-agendamentos'),deHoje,'Nenhum agendamento hoje ainda.');
        renderAppts($('lista-proximos'),proximos,'Nenhum agendamento futuro.');

        renderPagtoPendente('pagto-pendente-wrap','pagto-pendente-badge','lista-pagto-pendente-agendamentos',pagtoPendente);
        renderPagtoPendente('pagto-pendente-wrap-fila','pagto-pendente-badge-fila','lista-pagto-pendente-fila',pagtoPendente);
        renderCobranca(pagtoPendente);
        if(typeof atualizarCentralAvisos==='function') atualizarCentralAvisos();
    },e=>console.error('Erro agendamentos:',e));
}

function renderAppts(container,lista,emptyMsg){
    // Não mexe em ultimaListaAppts aqui — essa função é usada pra renderizar
    // várias listas filtradas diferentes (hoje, próximos, aguardando
    // pagamento), e o cache completo é mantido à parte em carregarAgendamentos().
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
    toast('Corte concluído! ✓');
    if(!window.__funcionarioMode) carregarAgendamentos();
    if(item){
        $('modal-acoes-cliente').style.display = 'none';
        // No modo funcionário, a lista só atualiza recarregando a página —
        // mas isso derrubaria o comprovante no meio da leitura, então o
        // reload fica pendente até o dono fechar/baixar/enviar o PDF (ver
        // os 3 handlers de modal-comprovante logo abaixo).
        if(window.__funcionarioMode) window.__reloadAposComprovante = true;
        window.__perguntarConclusaoAposComprovante = null; // já foi concluído agora — não pergunta de novo
        abrirModalComprovante({
            nomeBarbearia: barbeiroData.nome || 'Barbearia',
            clienteNome: item.clienteNome,
            clienteWhatsapp: item.clienteWhatsapp,
            barbeiro: item.barbeiro || '',
            descricao: item.corte || 'Serviço',
            valor: item.preco || 0,
            formaPagamento: item.formaPagamento || 'nao_informado'
        });
        return;
    }
    if(window.__funcionarioMode) setTimeout(()=>location.reload(),600);
}

async function cancelarAgendamento(id){
    if(!confirm('Marcar como cancelado?')) return false;
    await updateDoc(doc(db,'agendamentos',id),{status:'cancelado'});
    if(window.__funcionarioMode){ toast('Agendamento cancelado','var(--red)'); setTimeout(()=>location.reload(),600); return true; }
    carregarAgendamentos();
    toast('Agendamento cancelado','var(--red)');
    return true;
}

// ══════════════════════════════════════════════════════════
// AÇÕES DO CLIENTE — clicar no nome do cliente num agendamento abre
// esse menu: forma de pagamento, WhatsApp e modelos de mensagem prontos.
// ══════════════════════════════════════════════════════════
let acClienteAtual = {nome:'', wpp:'', agendamentoId:'', data:'', hora:'', formaPagamento:null};

function fmtDataExtenso(dataStr){
    if(!dataStr) return '';
    const [y,m,d] = dataStr.split('-');
    const dias = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
    const dataObj = new Date(Number(y), Number(m)-1, Number(d));
    return `${d}/${m} (${dias[dataObj.getDay()]})`;
}

// ── Comprovante de pagamento em PDF (não é nota fiscal, envio opcional) ──
// Mesmo padrão visual usado no Pro'Bronze, adaptado pras cores do Pro'B.
let comprovanteAtual = null; // { blob, clienteWhatsapp, nomeArquivo }

const ROTULO_FORMA_PAGAMENTO = { dinheiro:'Dinheiro', pix:'Pix', debito:'Débito', credito:'Crédito', nao_informado:'Não informado' };

// Marca "Pro'B" colorida (Pro em azul, ' em verde, B em branco), desenhada
// terminando em rightX — usada nos comprovantes, reposicionada num canto
// pra abrir espaço pra logo da barbearia no lugar de destaque do cabeçalho.
function desenharMarcaProB(doc, rightX, y, fontSize){
    doc.setFont('helvetica','bold');
    doc.setFontSize(fontSize);
    const segs = [{t:'Pro', c:[0,212,255]}, {t:"'", c:[0,255,136]}, {t:'B', c:[255,255,255]}];
    const widths = segs.map(s=>doc.getTextWidth(s.t));
    let cx = rightX - widths.reduce((a,b)=>a+b,0);
    segs.forEach((s,i)=>{ doc.setTextColor(...s.c); doc.text(s.t, cx, y); cx += widths[i]; });
}

function montarComprovantePdfBlob({ nomeBarbearia, clienteNome, barbeiro, descricao, valor, formaPagamento, logoBase64 }){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a5' }); // 148 x 210mm
    const W = 148;
    const agora = new Date().toLocaleString('pt-BR');

    // Cores da marca (mesmas do tema visual do Pro'B)
    const bg = [10,14,20];            // --bg
    const azul = [0,212,255];         // --blue
    const azulClaro = [130,230,255];
    const verde = [0,255,136];        // --green
    const textoClaro = [232,244,248]; // --text
    const cinza = [122,159,181];      // --muted

    // ── Cabeçalho ──
    doc.setFillColor(...bg);
    doc.rect(0, 0, W, 40, 'F');

    // Marca Pro'B — pequena, canto superior direito (a logo do dono, quando
    // cadastrada, ocupa o lugar de destaque no lugar dela).
    desenharMarcaProB(doc, W-12, 11, 11);

    let logoW = 0;
    if(logoBase64){
        try{
            const propsImg = doc.getImageProperties(logoBase64);
            const maxLado = 16;
            logoW = maxLado; let logoH = maxLado*propsImg.height/propsImg.width;
            if(logoH>maxLado){ logoH=maxLado; logoW=maxLado*propsImg.width/propsImg.height; }
            doc.addImage(logoBase64, propsImg.fileType||'JPEG', 10, 6, logoW, logoH);
        }catch(e){ logoW = 0; } // logo corrompida/ilegível — segue sem travar o comprovante
    }

    doc.setFont('helvetica','bold');
    doc.setFontSize(15);
    doc.setTextColor(...textoClaro);
    doc.text(nomeBarbearia, W/2, 19, { align:'center', maxWidth: W-45 });
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.6);
    doc.line(30, 26, W-30, 26);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.setTextColor(...azul);
    doc.text('COMPROVANTE DE PAGAMENTO', W/2, 34, { align:'center' });

    // ── Aviso: não é documento fiscal ──
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.5);
    const avisoTexto = 'ATENÇÃO: ESTE DOCUMENTO NÃO É CUPOM FISCAL NEM NOTA FISCAL';
    const avisoLinhas = doc.splitTextToSize(avisoTexto, W-40);
    const avisoAltura = 8 + avisoLinhas.length*4.2;
    doc.setFillColor(40,16,14);
    doc.roundedRect(14, 46, W-28, avisoAltura, 2, 2, 'F');
    doc.setTextColor(255,110,90);
    doc.text(avisoLinhas, W/2, 46+5.5, { align:'center', lineHeightFactor:1.3 });

    // ── Corpo — campos em blocos ──
    const caixa = (x,y,w,h,rotulo,valorTexto,opts={}) => {
        doc.setFillColor(18,22,28); // --card2
        doc.setDrawColor(42,63,95); // --border
        doc.roundedRect(x, y, w, h, 2, 2, 'FD');
        doc.setFont('helvetica','normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...cinza);
        doc.text(rotulo.toUpperCase(), x+4, y+6);
        doc.setFont('helvetica', opts.negrito ? 'bold' : 'normal');
        doc.setFontSize(opts.fontSize || 11);
        doc.setTextColor(...textoClaro);
        doc.text(String(valorTexto), x+4, y+(opts.fontSize?15:13), { maxWidth: w-8 });
    };

    let y = 46 + avisoAltura + 7;
    caixa(14, y, (W-28-4)/2, 20, 'Data', agora);
    caixa(14+(W-28-4)/2+4, y, (W-28-4)/2, 20, 'Forma de pagamento', ROTULO_FORMA_PAGAMENTO[formaPagamento]||formaPagamento);
    y += 26;
    caixa(14, y, W-28, 18, 'Cliente', clienteNome || 'Não informado');
    y += 24;
    if(barbeiro){
        caixa(14, y, W-28, 18, 'Barbeiro', barbeiro);
        y += 24;
    }
    caixa(14, y, W-28, 20, 'Serviço', descricao);
    y += 26;

    // Valor total em destaque
    doc.setFillColor(...bg);
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, W-28, 22, 2, 2, 'FD');
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(...cinza);
    doc.text('VALOR TOTAL', 20, y+8);
    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.setTextColor(...verde);
    doc.text(`R$ ${Number(valor).toFixed(2)}`, W-20, y+16, { align:'right' });
    y += 30;

    // ── Rodapé ──
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.3);
    doc.line(14, y, W-14, y);
    y += 6;
    doc.setFont('helvetica','normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140,150,160);
    doc.text("Recibo interno de controle, sem validade fiscal. Gerado pelo sistema Pro'B.", W/2, y, { align:'center', maxWidth: W-24 });

    return doc.output('blob');
}

function abrirModalComprovante({ nomeBarbearia, clienteNome, clienteWhatsapp, barbeiro, descricao, valor, formaPagamento }){
    if(typeof window.jspdf === 'undefined'){ return; } // biblioteca ainda carregando — sem comprovante dessa vez, sem travar o resto
    const blob = montarComprovantePdfBlob({ nomeBarbearia, clienteNome, barbeiro, descricao, valor, formaPagamento, logoBase64: barbeiroData.logoBase64||null });
    comprovanteAtual = { blob, clienteWhatsapp, nomeArquivo: `comprovante-${Date.now()}.pdf` };
    $('modal-comprovante').style.display = 'flex';
}

// Link de agendamento do cliente (mesmo usado na aba Clientes/QR Code) —
// incluído nas mensagens que convidam a marcar um novo horário, pra já
// deixar o caminho pronto em vez de só falar "agende".
const MENSAGENS_PRONTAS = {
    link: (c) => `Olá, ${c.nome}! Agora você pode marcar seu horário na ${barbeiroData.nome||'barbearia'} direto pelo celular, sem precisar ligar — é só abrir esse link e escolher o dia e horário:\n\n${linkClienteAtual}`,
    confirmacao: (c) => `Olá, ${c.nome}! Passando para confirmar seu horário marcado para ${fmtDataExtenso(c.data)} às ${c.hora} na ${barbeiroData.nome||'barbearia'}. Contamos com sua presença!`,
    promocao: (c) => `Olá, ${c.nome}! Temos uma condição especial disponível para você. Que tal aproveitar e agendar seu próximo horário?\n\n${linkClienteAtual}`,
    ausente: (c) => `Olá, ${c.nome}! Notamos que já faz um tempo desde sua última visita na ${barbeiroData.nome||'barbearia'}. Que tal agendar um novo horário? Ficaremos felizes em atendê-lo(a) novamente!\n\n${linkClienteAtual}`,
    agradecimento: (c) => `Olá, ${c.nome}! Obrigado pela visita. Esperamos que tenha gostado do resultado — até a próxima!`,
    atraso: (c) => `Olá, ${c.nome}! Pedimos desculpas, mas haverá um pequeno atraso no seu atendimento hoje. Agradecemos a compreensão!`,
};

window.abrirAcoesCliente = function(nome, wpp, agendamentoId, data, hora, status, filaId, clienteId){
    acClienteAtual = {nome, wpp, agendamentoId, data, hora, status: status||'pendente', filaId: filaId||null, clienteId: clienteId||null};
    $('ac-nome-cliente').textContent = nome || 'Cliente';
    $('ac-wpp-cliente').textContent = wpp ? formatarWppExibicao(wpp) : 'WhatsApp não informado';
    $('ac-copiar-wpp').style.display = wpp ? 'inline' : 'none';
    $('ac-btn-excluir-cliente').style.display = clienteId ? 'block' : 'none';
    // Vender produto/criar promoção são decisões estratégicas do dono —
    // funcionário só vê pagamento, concluir/cancelar, WhatsApp e histórico.
    if(window.__funcionarioMode){
        $('ac-btn-vender').style.display = 'none';
        $('ac-btn-promocao').style.display = 'none';
    }

    // Serviço desse agendamento específico — o card na lista já mostra o
    // barbeiro/horário, mas não qual corte foi marcado.
    const corteWrap = $('ac-corte-atual-wrap');
    const agendamentoAtual = agendamentoId ? ultimaListaAppts.find(a=>a.id===agendamentoId) : null;
    if(agendamentoAtual?.corte){
        corteWrap.style.display = 'block';
        $('ac-corte-atual').textContent = agendamentoAtual.corte;
    } else {
        corteWrap.style.display = 'none';
    }

    carregarHistoricoCortes(wpp);

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
    acClienteAtual.formaPagamento = formaPagamentoAtual || null;
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

// Busca todos os agendamentos concluídos desse cliente (por WhatsApp,
// já que nem todo agendamento antigo tem clienteId salvo) e conta quantas
// vezes cada corte apareceu — dá pra ver de cara qual o corte de sempre
// dessa pessoa, sem precisar abrir cada agendamento passado um por um.
async function carregarHistoricoCortes(wpp){
    const wrap = $('ac-historico-cortes-wrap');
    const cont = $('ac-historico-cortes');
    if(!wpp){ wrap.style.display='none'; return; }
    wrap.style.display = 'block';
    // Lista some por padrão — só abre quando o dono clica no botão. Fica
    // guardado já pronto assim que carrega, pra não ter que esperar de
    // novo no clique.
    cont.style.display = 'none';
    $('ac-historico-cortes-seta').textContent = '▾';
    cont.innerHTML = '<p style="font-size:.78rem;color:var(--muted);margin:0">Carregando...</p>';
    try{
        const q = query(
            collection(db,'agendamentos'),
            where('barbeiroId','==',barbeiroData.uid),
            where('clienteWhatsapp','==',wpp),
            where('status','==','concluido')
        );
        const snap = await getDocs(q);
        const contagem = {};
        let total = 0;
        snap.forEach(d=>{
            const corte = d.data().corte;
            if(!corte) return;
            // Combos ("Corte + Barba") contam pra cada serviço individual
            corte.split(' + ').forEach(nome=>{
                nome = nome.trim();
                if(!nome) return;
                contagem[nome] = (contagem[nome]||0)+1;
                total++;
            });
        });
        if(!total){
            cont.innerHTML = '<p style="font-size:.78rem;color:var(--muted);margin:0">Nenhum atendimento concluído registrado ainda.</p>';
            return;
        }
        const ordenado = Object.entries(contagem).sort((a,b)=>b[1]-a[1]);
        cont.innerHTML = ordenado.map(([nome,qtd])=>
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem .7rem;background:var(--card);border:1px solid var(--border);border-radius:8px;font-size:.82rem">
                <span>${escapeHtml(nome)}</span>
                <span style="color:var(--green);font-weight:700">${qtd}x</span>
            </div>`
        ).join('');
    }catch(e){
        cont.innerHTML = '<p style="font-size:.78rem;color:var(--red);margin:0">Erro ao carregar histórico.</p>';
    }
}

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

    $('btn-toggle-historico-cortes').addEventListener('click', ()=>{
        const cont = $('ac-historico-cortes');
        const aberto = cont.style.display === 'flex';
        cont.style.display = aberto ? 'none' : 'flex';
        $('ac-historico-cortes-seta').textContent = aberto ? '▾' : '▴';
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

    $('ac-btn-excluir-cliente').addEventListener('click', async()=>{
        if(!acClienteAtual.clienteId) return;
        if(!confirm(`Apagar ${acClienteAtual.nome||'esse cliente'} da sua base de clientes?\n\nIsso não apaga agendamentos ou histórico já feitos, só remove o cadastro dele. Não tem como desfazer.`)) return;
        const btn = $('ac-btn-excluir-cliente');
        btn.disabled = true;
        try{
            await deleteDoc(doc(db,'barbeiros',barbeiroData.uid,'clientes',acClienteAtual.clienteId));
            $('modal-acoes-cliente').style.display = 'none';
            toast('✓ Cliente apagado da base');
            if(typeof carregarClientes==='function') carregarClientes();
        }catch(e){
            console.error('excluirCliente:',e);
            toast('Erro ao apagar: '+e.message,'var(--red)');
        }
        btn.disabled = false;
    });

    $('ac-btn-concluir').addEventListener('click', async()=>{
        // Exige forma de pagamento antes de concluir — sem isso, o
        // atendimento fica de fora do gráfico "Receita por forma de
        // pagamento" no Financeiro, mesmo já concluído e faturado.
        if(!acClienteAtual.formaPagamento){
            toast('Escolha a forma de pagamento antes de concluir','var(--yellow)');
            return;
        }
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
                acClienteAtual.formaPagamento = btn.dataset.pag;
                toast('✓ Forma de pagamento registrada: '+btn.textContent.replace(/[^\wÀ-ÿ]/g,' ').trim());
                if(!window.__funcionarioMode) carregarAgendamentos();

                // "Ainda não pagou" não é um pagamento de verdade — só gera
                // comprovante quando é uma forma que já entrou no caixa.
                if(btn.dataset.pag !== 'pendente'){
                    const item = acClienteAtual.filaId
                        ? ultimaListaFila.find(f=>f.id===acClienteAtual.filaId)
                        : ultimaListaAppts.find(a=>a.id===acClienteAtual.agendamentoId);
                    if(item){
                        $('modal-acoes-cliente').style.display = 'none';
                        // Depois de fechar o comprovante, pergunta se o
                        // atendimento já foi concluído — só faz sentido aqui
                        // (registrar forma de pagamento não é a mesma coisa
                        // que concluir; o corte pode ter sido pago antes de
                        // acontecer). Ver fecharModalComprovante().
                        window.__perguntarConclusaoAposComprovante = {
                            agendamentoId: acClienteAtual.agendamentoId || null,
                            filaId: acClienteAtual.filaId || null
                        };
                        abrirModalComprovante({
                            nomeBarbearia: barbeiroData.nome || "Barbearia",
                            clienteNome: acClienteAtual.nome,
                            clienteWhatsapp: acClienteAtual.wpp,
                            barbeiro: item.barbeiro || '',
                            descricao: item.corte || 'Serviço',
                            valor: item.preco || 0,
                            formaPagamento: btn.dataset.pag
                        });
                    }
                }
            }catch(e){ toast('Erro ao salvar: '+e.message,'var(--red)'); }
        });
    });

    // No modo funcionário, o reload da lista (que só funciona recarregando
    // a página inteira) fica pendente até fechar/baixar/enviar o comprovante
    // — ver window.__reloadAposComprovante em concluirAgendamento().
    async function fecharModalComprovante(){
        $('modal-comprovante').style.display = 'none';
        comprovanteAtual = null;

        const pendente = window.__perguntarConclusaoAposComprovante;
        window.__perguntarConclusaoAposComprovante = null;
        if(pendente && (pendente.agendamentoId || pendente.filaId)){
            if(confirm('O atendimento já foi concluído?')){
                if(pendente.filaId) await atenderFila(pendente.filaId);
                else await concluirAgendamento(pendente.agendamentoId);
                return; // concluirAgendamento/atenderFila cuidam do reload, se precisar
            }
        }

        if(window.__reloadAposComprovante){
            window.__reloadAposComprovante = false;
            location.reload();
        }
    }

    $('btn-fechar-comprovante').addEventListener('click', fecharModalComprovante);

    $('btn-baixar-comprovante').addEventListener('click', () => {
        if(!comprovanteAtual) return;
        const url = URL.createObjectURL(comprovanteAtual.blob);
        const a = document.createElement('a');
        a.href = url; a.download = comprovanteAtual.nomeArquivo; a.click();
        URL.revokeObjectURL(url);
    });

    $('btn-enviar-comprovante-wpp').addEventListener('click', async () => {
        if(!comprovanteAtual) return;
        const file = new File([comprovanteAtual.blob], comprovanteAtual.nomeArquivo, { type: 'application/pdf' });

        if(navigator.canShare && navigator.canShare({ files: [file] })){
            try{
                await navigator.share({ files: [file], title: 'Comprovante', text: 'Segue o comprovante do seu pagamento (não é nota fiscal).' });
            }catch(e){
                return; // cliente cancelou o compartilhamento — deixa o modal aberto
            }
            fecharModalComprovante();
            return;
        }

        // Navegador sem suporte a compartilhar arquivo (comum no desktop):
        // baixa o PDF e abre o WhatsApp pra anexar manualmente
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url; a.download = comprovanteAtual.nomeArquivo; a.click();
        URL.revokeObjectURL(url);
        const wppNum = (comprovanteAtual.clienteWhatsapp||'').replace(/\D/g,'');
        const msg = encodeURIComponent('Olá! Segue o comprovante do seu pagamento (não é nota fiscal). O PDF acabou de ser baixado — é só anexar aqui na conversa.');
        window.open(wppNum ? `https://wa.me/55${wppNum}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
        fecharModalComprovante();
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
            if(!window.__funcionarioMode) carregarAgendamentos();
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

    // Aba Cobrança — criar cobrança avulsa (não veio de agendamento marcado
    // como "ainda não pagou"). Vira um agendamento com formaPagamento
    // "pendente", reaproveitando toda a lógica que já existe pra listar,
    // cobrar no WhatsApp e marcar como pago.
    if($('btn-mostrar-form-cobranca')){
        $('btn-mostrar-form-cobranca').addEventListener('click', ()=>{
            $('cobranca-form-wrap').style.display = 'block';
            $('cobranca-card-intro').style.display = 'none';
            $('cobranca-form-wrap').scrollIntoView({behavior:'smooth', block:'start'});
        });
        $('btn-cancelar-form-cobranca').addEventListener('click', ()=>{
            $('cobranca-form-wrap').style.display = 'none';
            $('cobranca-card-intro').style.display = 'block';
        });
        $('btn-add-cobranca').addEventListener('click', async()=>{
            const nome = $('cobranca-cliente-nome').value.trim();
            const wpp = $('cobranca-cliente-wpp').value.replace(/\D/g,'');
            const descricao = $('cobranca-descricao').value.trim();
            const valor = Number($('cobranca-valor').value);
            if(!nome){ toast('Informe o nome do cliente','var(--red)'); return; }
            if(!descricao){ toast('Informe uma descrição pra cobrança','var(--red)'); return; }
            if(!valor || valor<=0){ toast('Informe um valor válido','var(--red)'); return; }

            const btn = $('btn-add-cobranca');
            btn.disabled = true;
            try{
                await addDoc(collection(db,'agendamentos'), {
                    barbeiroId: barbeiroData.uid,
                    clienteNome: nome,
                    clienteWhatsapp: wpp,
                    corte: descricao,
                    preco: valor,
                    barbeiro: '',
                    data: fmtHoje(),
                    hora: new Date().toTimeString().slice(0,5),
                    status: 'concluido',
                    formaPagamento: 'pendente',
                    origem: 'cobranca-manual',
                    criadoEm: new Date().toISOString()
                });
                toast('✓ Cobrança criada!');
                $('cobranca-cliente-nome').value=''; $('cobranca-cliente-wpp').value='';
                $('cobranca-descricao').value=''; $('cobranca-valor').value='';
                $('cobranca-form-wrap').style.display = 'none';
                $('cobranca-card-intro').style.display = 'block';
            }catch(e){ toast('Erro ao criar cobrança: '+e.message,'var(--red)'); }
            btn.disabled = false;
        });
    }
}

// O sininho do topo foi removido — a Central de Avisos flutuante (ver
// central-avisos.js) assumiu esse papel, com avisos individuais e
// dispensáveis em vez de um contador agregado.
