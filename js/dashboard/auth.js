// ══════════════════════════════════════════════════════════
// MODOS DE FUNCIONÁRIO E RECEPCIONISTA — auth.js
//
// Script comum (não é módulo ES). Usa window.$, window.escapeHtml,
// window.toast, window.fecharDrawer, window.barbeiroData,
// window.registrarClienteConcluido, window.gerarSlots, window.horaParaMin,
// window.carregarCachePromoCliente, window.initDash (crítico — é o que
// monta o painel depois do login), window.initLinkCliente (mora em
// horarios.js) e as funções do Firestore, disponibilizadas pelo módulo
// principal.
//
// IMPORTANTE: o login em si (onAuthStateChanged, verificarAcesso,
// tratarLoginStaff, carregarConvite, carregarBarbeiro, initDash)
// continua no módulo principal, de propósito — é a parte mais sensível
// do sistema, e mantê-la junto com o import do Firebase reduz o risco de
// quebrar o acesso de todo mundo. Só os DOIS MODOS de visão restrita
// (funcionário barbeiro e recepcionista) foram extraídos aqui. Ver
// docs/README.md.
// ══════════════════════════════════════════════════════════

// ══ PAINEL FUNCIONÁRIO (login próprio, chamado por tratarLoginStaff) ══
// ══ MODO RECEPCIONISTA — vê quase tudo, exceto valores/comissões/links ══
async function initRecepcionistaMode(bId,bData,equipeId){
    barbeiroData={uid:bId,...bData};
    window.__recepcionista=true;

    // Menu restrito: Operação do dia, Catálogo e Pessoas — sem Configurações nem Gestão
    document.getElementById('drawer-tab-items').innerHTML=`
        <div style="padding:.6rem 1.25rem .3rem;font-size:.66rem;font-weight:700;letter-spacing:.6px;color:var(--muted);text-transform:uppercase">Operação do dia</div>
        <div class="tab active" data-tab="agendamentos">📋 Agendamentos</div>
        <div class="tab" data-tab="fila">🪑 Fila de Espera</div>

        <div style="padding:.9rem 1.25rem .3rem;font-size:.66rem;font-weight:700;letter-spacing:.6px;color:var(--muted);text-transform:uppercase;border-top:1px solid var(--border);margin-top:.3rem">Catálogo</div>
        <div class="tab" data-tab="cortes">✂️ Cortes</div>
        <div class="tab" data-tab="promocoes">🎁 Promoções</div>
        <div class="tab" data-tab="horarios">🕐 Horários</div>
        <div class="tab" data-tab="estoque">📦 Estoque</div>
        <div class="tab" data-tab="insumos">🧴 Controle de Insumos</div>

        <div style="padding:.9rem 1.25rem .3rem;font-size:.66rem;font-weight:700;letter-spacing:.6px;color:var(--muted);text-transform:uppercase;border-top:1px solid var(--border);margin-top:.3rem">Pessoas</div>
        <div class="tab" data-tab="equipe">👥 Equipe</div>
        <div class="tab" data-tab="clientes">🧑 Clientes</div>
        <div class="tab" data-tab="visual">📱 Tela Cliente</div>
        <div class="tab" data-tab="painel-chamada">📺 Painel de Chamada</div>`;
    document.getElementById('menu-titulo-atual').innerHTML='📋 Agendamentos';

    // Esconde o que é exclusivo de dono: comissões, links de acesso, formulário de adicionar equipe
    const secaoAdd=document.getElementById('secao-add-equipe'); if(secaoAdd)secaoAdd.style.display='none';
    const secaoLinks=document.getElementById('secao-links-equipe'); if(secaoLinks)secaoLinks.style.display='none';
    const secaoGanhos=document.getElementById('secao-ganhos-equipe'); if(secaoGanhos)secaoGanhos.style.display='none';

    initDash(); // liga os cliques do menu e carrega os dados (financeiro/links ficam bloqueados pelo próprio initDash)
    initLinkCliente(); // recepcionista também pode enviar o link de agendamento para o cliente
    const btnAjudaR=document.getElementById('btn-ajuda'); if(btnAjudaR) btnAjudaR.style.display='none';

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-dash').classList.add('active');
    const av=document.getElementById('avatar-initials');
    const membro=(bData.equipe||[]).find(e=>e.id===equipeId);
    if(av) av.textContent=(membro?membro.nome:'Recepção')[0].toUpperCase();
}

async function initFuncionarioMode(bId, funcId){
    // Load barbearia data
    const bSnap=await getDoc(doc(db,'barbeiros',bId));
    if(!bSnap.exists())return false;
    const bData=bSnap.data();
    const funcMembro=(bData.equipe||[]).find(e=>e.id===funcId);
    if(!funcMembro)return false;

    if(funcMembro.tipo==='recepcionista'){
        await initRecepcionistaMode(bId,bData,funcId);
        return true;
    }

    // Show only employee view
    const btnAjudaF=document.getElementById('btn-ajuda'); if(btnAjudaF) btnAjudaF.style.display='none';
    barbeiroData={uid:bId,...bData};
    carregarCachePromoCliente();
    document.getElementById('drawer-tab-items').innerHTML=`
        <div class="tab active" data-tab="func-agenda">📋 Meus Agendamentos</div>
        <div class="tab" data-tab="func-fila">🪑 Fila</div>
        <div class="tab" data-tab="func-ganhos">💰 Meus Ganhos</div>
        <div class="tab" data-tab="func-horarios">🕐 Meus Horários</div>`;
    document.getElementById('menu-titulo-atual').innerHTML='📋 Meus Agendamentos';

    // Hide all tabs, show func tabs
    document.querySelectorAll('.tab-content').forEach(t=>{t.style.display='none';});

    const mainArea=document.getElementById('screen-dash').querySelector('.tabs').parentNode;

    // Inject func tabs
    const funcHTML=`
        <div class="tab-content active" id="tab-func-agenda" style="padding:1.5rem;max-width:900px;margin:0 auto">
            <div class="section-title">Meus Agendamentos de Hoje</div>
            <div id="func-lista-hoje"></div>
            <div class="section-title" style="margin-top:1.5rem">Próximos</div>
            <div id="func-lista-prox"></div>
        </div>
        <div class="tab-content" id="tab-func-fila" style="padding:1.5rem;max-width:900px;margin:0 auto">
            <div class="card" style="margin-bottom:1.2rem">
                <p style="font-size:.8rem;color:var(--muted);margin-bottom:1rem">Adicione clientes que chegaram sem agendamento. Você só vê e gerencia a sua própria fila.</p>
                <div style="display:flex;gap:.6rem;flex-wrap:wrap">
                    <input type="text" id="func-fila-nome" placeholder="Nome do cliente" style="flex:2;min-width:140px;background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:.75rem 1rem;color:var(--text);font-size:.9rem;outline:none;">
                    <input type="tel" id="func-fila-wpp" placeholder="WhatsApp (opcional)" style="flex:1;min-width:140px;background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:.75rem 1rem;color:var(--text);font-size:.9rem;outline:none;">
                    <select id="func-fila-corte" style="flex:1;min-width:120px;background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:.75rem 1rem;color:var(--text);font-size:.9rem;outline:none;">
                        <option value="">Corte (obrigatório)</option>
                    </select>
                    <button id="btn-func-add-fila" style="padding:.75rem 1.2rem;background:rgba(0,255,136,.1);border:1.5px solid var(--green);border-radius:8px;color:var(--green);font-weight:700;cursor:pointer;white-space:nowrap">+ Entrar na fila</button>
                </div>
            </div>
            <div class="section-title">Minha fila — aguardando</div>
            <div id="func-lista-fila"><div class="empty-state"><div class="icon">🪑</div>Ninguém na sua fila no momento.</div></div>
        </div>
        <div class="tab-content" id="tab-func-ganhos" style="padding:1.5rem;max-width:900px;margin:0 auto">
            <div class="fat-kpis">
                <div class="fat-kpi"><div class="fat-kpi-val" id="func-cortes-hoje">0</div><div class="fat-kpi-lbl">Cortes hoje</div></div>
                <div class="fat-kpi"><div class="fat-kpi-val" id="func-ganho-hoje">R$0</div><div class="fat-kpi-lbl">Ganho hoje</div></div>
                <div class="fat-kpi green"><div class="fat-kpi-val" id="func-ganho-semana">R$0</div><div class="fat-kpi-lbl">Ganho na semana</div></div>
                <div class="fat-kpi" style="border-color:rgba(192,160,96,.35)"><div class="fat-kpi-val" id="func-ganho-mes" style="color:#c0a060">R$0</div><div class="fat-kpi-lbl">Ganho no mês</div></div>
            </div>
            <p style="font-size:.7rem;color:var(--muted);margin-bottom:1rem;text-align:center">📅 Semana: <span id="func-periodo-semana"></span></p>
            <div class="section-title">Histórico</div>
            <div class="card" id="func-historico"></div>
        </div>
        <div class="tab-content" id="tab-func-horarios" style="padding:1.5rem;max-width:900px;margin:0 auto">
            <div class="section-title">Bloquear Meus Horários</div>
            <div class="card">
                <div class="sched-date-picker" id="func-date-picker"></div>
                <div class="sched-legend">
                    <div class="legend-item"><div class="legend-dot dot-livre"></div>Disponível</div>
                    <div class="legend-item"><div class="legend-dot dot-ocupado"></div>Agendado</div>
                    <div class="legend-item"><div class="legend-dot dot-bloq"></div>Bloqueado</div>
                </div>
                <div class="hours-grid" id="func-hours-grid"></div>
            </div>
        </div>`;

    const tabArea=document.createElement('div');
    tabArea.innerHTML=funcHTML;
    document.getElementById('screen-dash').appendChild(tabArea.firstElementChild);
    document.getElementById('screen-dash').appendChild(tabArea.firstElementChild);
    document.getElementById('screen-dash').appendChild(tabArea.firstElementChild);
    document.getElementById('screen-dash').appendChild(tabArea.firstElementChild);

    // Modo funcionário não tem aba Clientes — partículas ficam sempre desligadas
    if(window.setParticlesVisible) window.setParticlesVisible(false);

    // Tab switching for func tabs
    document.querySelectorAll('.tab').forEach(tab=>{
        tab.addEventListener('click',()=>{
            document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
            document.querySelectorAll('[id^="tab-func-"]').forEach(t=>t.classList.remove('active'));
            tab.classList.add('active');
            const id='tab-'+tab.dataset.tab;
            const el=document.getElementById(id);
            if(el)el.classList.add('active');
            const tituloEl=$('menu-titulo-atual');
            if(tituloEl) tituloEl.innerHTML=tab.innerHTML;
            fecharDrawer();
        });
    });

    // Gaveta lateral — liga os botões só uma vez (mesmo mecanismo do painel do dono)
    if(!window.__drawerBound){
        window.__drawerBound = true;
        const abrirDrawer=()=>{
            $('drawer-menu').style.transform='translateX(0)';
            $('drawer-overlay').style.opacity='1';
            $('drawer-overlay').style.pointerEvents='auto';
        };
        $('btn-menu-hamburger').addEventListener('click', abrirDrawer);
        $('btn-fechar-drawer').addEventListener('click', fecharDrawer);
        $('drawer-overlay').addEventListener('click', fecharDrawer);
    }

    // Load func agendamentos
    const hoje=new Date().toISOString().split('T')[0];
    const mesAtual=hoje.slice(0,7);
    const qf=query(collection(db,'agendamentos'),where('barbeiroId','==',bId));
    let fs;try{fs=await getDocs(qf);}catch(e){fs={forEach:()=>{}};}

    const meus=[];fs.forEach(d=>{const a=d.data();if(a.barbeiro===funcMembro.nome)meus.push({id:d.id,...a});});
    meus.sort((a,b)=>a.data===b.data?a.hora.localeCompare(b.hora):a.data.localeCompare(b.data));

    const deHoje=meus.filter(a=>a.data===hoje);
    const proximos=meus.filter(a=>a.data>hoje);

    const renderFuncAppts=(cont,lista,empty)=>{
        if(!lista.length){cont.innerHTML=`<div class="empty-state"><div class="icon">📅</div>${empty}</div>`;return;}
        cont.innerHTML=lista.map(a=>{
            const concluido=a.status==='concluido';
            const cancelado=a.status==='cancelado';
            const btnAcoes=concluido
                ?`<span class="badge badge-ok">✓ feito</span>`
                :cancelado
                ?`<span class="badge badge-cancel">✗ cancel.</span>`
                :`<button class="btn-concluir" data-id="${a.id}">✓</button>
                  <button class="btn-cancelar" data-id="${a.id}">✗</button>`;
            return `
            <div class="appt-card ${concluido?'appt-done':cancelado?'appt-canceled':''}">
                <div class="appt-time">${a.hora}</div>
                <div class="appt-info">
                    <span class="appt-name">${escapeHtml(a.clienteNome)}</span>
                    <span class="appt-sep">·</span>
                    <span class="appt-corte">${escapeHtml(a.corte)}</span>
                    ${a.data!==hoje?`<span class="appt-sep">·</span><span class="appt-corte">${a.data}</span>`:''}
                    ${!concluido&&!cancelado?`<span class="badge badge-pend">pend</span>`:''}
                </div>
                <span class="appt-price">R$${Number(a.preco).toFixed(0)}</span>
                ${btnAcoes}
            </div>`;
        }).join('');

        // Bind botões concluir/cancelar
        cont.querySelectorAll('.btn-concluir').forEach(btn=>{
            btn.addEventListener('click',async()=>{
                btn.disabled=true;btn.textContent='...';
                const item=lista.find(a=>a.id===btn.dataset.id);
                await updateDoc(doc(db,'agendamentos',btn.dataset.id),{status:'concluido'});
                if(item) registrarClienteConcluido(bId, item.clienteNome, item.clienteWhatsapp, item.corte);
                toast('Corte concluído! ✓');
                location.reload();
            });
        });
        cont.querySelectorAll('.btn-cancelar').forEach(btn=>{
            btn.addEventListener('click',async()=>{
                if(!confirm('Marcar como cancelado?'))return;
                btn.disabled=true;btn.textContent='...';
                await updateDoc(doc(db,'agendamentos',btn.dataset.id),{status:'cancelado'});
                toast('Agendamento cancelado','var(--red)');
                location.reload();
            });
        });
    };
    renderFuncAppts(document.getElementById('func-lista-hoje'),deHoje,'Nenhum agendamento hoje.');
    renderFuncAppts(document.getElementById('func-lista-prox'),proximos,'Nenhum agendamento futuro.');

    // Ganhos — semana civil (segunda a domingo)
    const pct=funcMembro.pct||50;
    const agoraDate=new Date();
    const diaSemAtual=agoraDate.getDay()||7; // 1=segunda...7=domingo
    const inicioSemana=new Date(agoraDate);inicioSemana.setDate(agoraDate.getDate()-diaSemAtual+1);
    const fimSemana=new Date(inicioSemana);fimSemana.setDate(fimSemana.getDate()+6);
    const inicioSemanaStr=inicioSemana.toISOString().split('T')[0];
    const fimSemanaStr=fimSemana.toISOString().split('T')[0];

    const concHoje=deHoje.filter(a=>a.status==='concluido');
    const concSemana=meus.filter(a=>a.status==='concluido'&&a.data>=inicioSemanaStr&&a.data<=fimSemanaStr);
    const concMes=meus.filter(a=>a.status==='concluido'&&a.data&&a.data.startsWith(mesAtual));

    const ganhoHoje=concHoje.reduce((s,a)=>s+Number(a.preco||0)*pct/100,0);
    const fatSemana=concSemana.reduce((s,a)=>s+Number(a.preco||0),0);
    const ganhoSemana=fatSemana*pct/100;
    const ganhoMes=concMes.reduce((s,a)=>s+Number(a.preco||0)*pct/100,0);

    document.getElementById('func-cortes-hoje').textContent=concHoje.length;
    document.getElementById('func-ganho-hoje').textContent='R$'+ganhoHoje.toFixed(2);
    document.getElementById('func-ganho-semana').textContent='R$'+ganhoSemana.toFixed(2);
    document.getElementById('func-ganho-mes').textContent='R$'+ganhoMes.toFixed(2);

    const fmtDataBR=(d)=>d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    document.getElementById('func-periodo-semana').textContent=`${fmtDataBR(inicioSemana)} a ${fmtDataBR(fimSemana)} (seg-dom)`;

    // Histórico por dia
    const diasComCorte=[...new Set(meus.filter(a=>a.status==='concluido').map(a=>a.data))].sort().reverse().slice(0,15);
    document.getElementById('func-historico').innerHTML=diasComCorte.length
        ?diasComCorte.map(d=>{
            const cortesD=meus.filter(a=>a.status==='concluido'&&a.data===d);
            const totalD=cortesD.reduce((s,a)=>s+Number(a.preco||0),0);
            const ganhoD=totalD*pct/100;
            return `<div class="rank-item">
                <div class="rank-info"><div class="rank-nome">${d}</div><div style="font-size:.72rem;color:var(--muted)">${cortesD.length} corte${cortesD.length>1?'s':''}</div></div>
                <div class="rank-right"><div class="rank-val">R$${ganhoD.toFixed(2)}</div><div class="rank-qtd">seu ganho</div></div>
            </div>`;
        }).join('')
        :'<div class="empty-state" style="padding:1rem">Nenhum corte concluído ainda.</div>';

    // Horários do funcionário
    const fDP=document.getElementById('func-date-picker');
    let fSelDate=hoje;
    const fHoje=new Date();
    for(let i=0;i<7;i++){
        const d=new Date(fHoje);d.setDate(fHoje.getDate()+i);
        const key=d.toISOString().split('T')[0];
        const chip=document.createElement('div');
        chip.className='date-chip'+(i===0?' active':'');
        chip.textContent=i===0?'Hoje':key.slice(5);
        chip.addEventListener('click',()=>{
            document.querySelectorAll('#func-date-picker .date-chip').forEach(c=>c.classList.remove('active'));
            chip.classList.add('active');fSelDate=key;renderFuncHours(bId,funcMembro.nome,fSelDate,meus);
        });
        fDP.appendChild(chip);
    }
    renderFuncHours(bId,funcMembro.nome,fSelDate,meus);

    // Inicializa fila do funcionário
    initFilaFuncionario(bId,funcMembro.nome,bData);

    // Update topbar name
    document.querySelector('.topbar-logo').innerHTML='PRO\'<span style="color:#fff">B</span>';
    document.querySelector('#avatar-initials').textContent=funcMembro.nome[0].toUpperCase();

    return true;
}

function initFilaFuncionario(bId,funcNome,bData){
    // Popula select de cortes
    const corteSel=document.getElementById('func-fila-corte');
    const cortes=bData.cortes||[];
    if(corteSel){
        corteSel.innerHTML='<option value="">Corte (obrigatório)</option>'+
            cortes.map((c,i)=>`<option value="${i}">${c.nome} — R$${Number(c.preco).toFixed(0)}</option>`).join('');
    }

    const btnAdd=document.getElementById('btn-func-add-fila');
    if(btnAdd && !btnAdd.dataset.bound){
        btnAdd.dataset.bound='1';
        btnAdd.addEventListener('click',async()=>{
            const nome=document.getElementById('func-fila-nome').value.trim();
            if(!nome){toast('Informe o nome do cliente','var(--red)');return;}
            const corteIdx=document.getElementById('func-fila-corte').value;
            if(corteIdx===''){toast('Escolha o corte antes de adicionar na fila','var(--red)');return;}
            const corte=cortes[Number(corteIdx)];
            const wppEl=document.getElementById('func-fila-wpp');
            const wpp=wppEl?wppEl.value.replace(/\D/g,''):'';

            btnAdd.disabled=true;
            try{
                await addDoc(collection(db,'fila'),{
                    barbeiroId:bId,
                    clienteNome:nome,
                    clienteWhatsapp:wpp,
                    barbeiro:funcNome,
                    corte:corte?corte.nome:'',
                    preco:corte?corte.preco:0,
                    status:'aguardando',
                    criadoEm:new Date().toISOString(),
                    origem:'painel-funcionario'
                });
                document.getElementById('func-fila-nome').value='';
                if(wppEl)wppEl.value='';
                document.getElementById('func-fila-corte').value='';
                toast('✓ Adicionado à fila!');
            }catch(e){
                toast('Erro: '+e.message,'var(--red)');
            }
            btnAdd.disabled=false;
        });
        document.getElementById('func-fila-nome').addEventListener('keypress',e=>{if(e.key==='Enter')btnAdd.click();});
    }

    // Escuta a fila em tempo real, filtrando só os deste funcionário
    const q=query(collection(db,'fila'),where('barbeiroId','==',bId),where('status','==','aguardando'));
    onSnapshot(q,snap=>{
        let lista=[];
        snap.forEach(d=>{
            const item=d.data();
            if(item.barbeiro===funcNome)lista.push({id:d.id,...item});
        });
        lista.sort((a,b)=>new Date(a.criadoEm)-new Date(b.criadoEm));
        renderFilaFuncionario(lista,bId);
    });
}

function renderFilaFuncionario(lista,bId){
    const cont=document.getElementById('func-lista-fila');
    if(!cont)return;
    if(!lista.length){cont.innerHTML='<div class="empty-state"><div class="icon">🪑</div>Ninguém na sua fila no momento.</div>';return;}

    cont.innerHTML=lista.map((item,i)=>{
        const tempo=Math.floor((new Date()-new Date(item.criadoEm))/60000);
        const tempoStr=tempo<1?'agora':tempo<60?`${tempo}min`:`${Math.floor(tempo/60)}h${tempo%60}min`;
        const corteTag=item.corte?` · ${escapeHtml(item.corte)}`:'';
        const promoTagFunc=gerarBadgePromoCliente(item.clienteWhatsapp);
        return `<div class="fila-card">
            <div class="fila-pos">${i+1}º</div>
            <div class="fila-info">
                <div class="fila-nome">${escapeHtml(item.clienteNome)}</div>
                <div class="fila-meta" style="display:flex;align-items:center;flex-wrap:wrap;gap:.25rem"><span>Aguardando há ${tempoStr}${corteTag}</span>${promoTagFunc}</div>
            </div>
            <div class="fila-actions">
                <button class="btn-concluir func-fila-atender" data-id="${item.id}" title="Atender">✓</button>
                <button class="btn-cancelar func-fila-remover" data-id="${item.id}" title="Remover">✗</button>
            </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('.func-fila-atender').forEach(btn=>{
        btn.addEventListener('click',async()=>{
            btn.disabled=true;
            const item=lista.find(l=>l.id===btn.dataset.id);
            await addDoc(collection(db,'agendamentos'),{
                barbeiroId:bId,
                clienteNome:item.clienteNome,
                clienteWhatsapp:'',
                corte:item.corte||'Corte (fila)',
                preco:item.preco||0,
                barbeiro:item.barbeiro||'',
                data:fmtHoje(),
                hora:new Date().toTimeString().slice(0,5),
                status:'concluido',
                origem:'fila',
                criadoEm:new Date().toISOString()
            });
            await updateDoc(doc(db,'fila',btn.dataset.id),{status:'atendido',atendidoEm:new Date().toISOString()});
            registrarClienteConcluido(bId, item.clienteNome, item.clienteWhatsapp, item.corte||'Corte (fila)');
            toast('✓ Atendimento concluído!');
        });
    });
    cont.querySelectorAll('.func-fila-remover').forEach(btn=>{
        btn.addEventListener('click',async()=>{
            if(!confirm('Remover da fila?'))return;
            btn.disabled=true;
            await updateDoc(doc(db,'fila',btn.dataset.id),{status:'removido'});
            toast('Removido da fila');
        });
    });
}

async function renderFuncHours(bId,funcNome,data,meus){
    const grid=document.getElementById('func-hours-grid');
    grid.innerHTML='<div style="color:var(--muted);font-size:.8rem">Carregando...</div>';

    const ocupados=new Set(meus.filter(a=>a.data===data&&a.status!=='cancelado').map(a=>a.hora));

    // Bloqueios do DONO (somente leitura para o funcionário)
    const bRefDono=doc(db,'barbeiros',bId,'bloqueios',data);
    const bSnapDono=await getDoc(bRefDono);
    const bloqueadosDono=bSnapDono.exists()?(bSnapDono.data().horas||[]):[];

    // Bloqueios do próprio funcionário (ele pode editar apenas os seus)
    const bloqKey=`${data}_${funcNome}`;
    const bRef=doc(db,'barbeiros',bId,'bloqueios',bloqKey);
    const bSnap=await getDoc(bRef);
    const bloqueadosFunc=bSnap.exists()?(bSnap.data().horas||[]):[];

    // Funcionamento configurado pelo dono
    const fSnap=await getDoc(doc(db,'barbeiros',bId,'config','funcionamento'));
    const funcData=fSnap.exists()?fSnap.data():{};
    const diaSem=new Date(data+'T12:00:00').getDay();
    const func=funcData[diaSem]||{aberto:true,inicio:'08:00',fim:'18:00'};

    const agora=new Date();const isHoje=data===new Date().toISOString().split('T')[0];
    const agoraMin=isHoje?agora.getHours()*60+agora.getMinutes():0;

    if(!func.aberto){
        grid.innerHTML='<div style="color:var(--muted);font-size:.85rem;padding:.5rem">Barbearia fechada neste dia.</div>';
        return;
    }

    const iniMin=horaParaMin(func.inicio);
    const fimMin=horaParaMin(func.fim);
    const intervaloFunc=funcData.intervalo||30;

    const slots=gerarSlots(iniMin,fimMin,intervaloFunc);

    grid.innerHTML=slots.map(hora=>{
        const min=horaParaMin(hora);
        const passado=isHoje&&min<=agoraMin;
        const ocp=ocupados.has(hora);
        const bloqDono=bloqueadosDono.includes(hora); // bloqueado pelo dono — não pode alterar
        const bloqFunc=bloqueadosFunc.includes(hora); // bloqueado pelo próprio func
        let cls,title='';
        if(passado) cls='passado';
        else if(ocp) cls='ocupado';
        else if(bloqDono){cls='bloqueado';title='Bloqueado pelo dono';}
        else if(bloqFunc) cls='bloqueado';
        else cls='livre';
        // Só mostra cursor pointer se não for bloqueio do dono, passado ou ocupado
        const clicavel=!passado&&!ocp&&!bloqDono;
        return `<div class="hour-slot ${cls}" data-hora="${hora}" data-status="${bloqFunc?'bloqueado':'livre'}" data-dono="${bloqDono}" style="${!clicavel?'cursor:default;':''}${bloqDono?'opacity:.5;':''}">
            ${hora}${bloqDono?'<span style="font-size:.5rem;display:block;color:var(--muted)">dono</span>':''}
        </div>`;
    }).join('');

    // Só permite clique em slots que NÃO foram bloqueados pelo dono
    grid.querySelectorAll('.hour-slot:not(.ocupado):not(.passado)').forEach(slot=>{
        if(slot.dataset.dono==='true') return; // protegido pelo dono
        slot.addEventListener('click',async()=>{
            const hora=slot.dataset.hora;const isBloq=slot.dataset.status==='bloqueado';
            const novo=isBloq?bloqueadosFunc.filter(h=>h!==hora):[...bloqueadosFunc,hora];
            await setDoc(bRef,{horas:novo});
            renderFuncHours(bId,funcNome,data,meus);
            toast(isBloq?'Horário liberado':'Horário bloqueado');
        });
    });
}
