// ══════════════════════════════════════════════════════════
// HORÁRIOS — horarios.js
//
// Script comum (não é módulo ES). Usa window.$, window.escapeHtml,
// window.toast, window.fmtHoje, window.fmtDate, window.DIAS,
// window.HORAS_OPCOES, window.gerarSlots, window.horaParaMin,
// window.barbeiroData, window.funcData, window.intervaloMin,
// window.selectedDate e as funções do Firestore, disponibilizadas pelo
// módulo principal. O clique do botão salvar só é ligado depois, por
// initHorariosExtras() — chamada pelo módulo principal. Ver docs/README.md.
// ══════════════════════════════════════════════════════════

// HORÁRIOS - FUNCIONAMENTO
function renderFuncGrid(){
    const grid=$('func-grid');
    const optsHtml=gerarHorasOpcoes(intervaloMin).map(h=>`<option value="${h}">${h}</option>`).join('');
    grid.innerHTML=DIAS.map((dia,idx)=>{
        const f=funcData[idx]||{aberto:false,inicio:'08:00',fim:'18:00'};
        return `<div class="func-day ${f.aberto?'':'fechado'}" id="func-day-${idx}">
            <div class="func-day-header">
                <span class="func-day-name">${dia}</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="func-toggle-${idx}" ${f.aberto?'checked':''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div class="func-times">
                <select id="func-ini-${idx}">${optsHtml}</select>
                <span>até</span>
                <select id="func-fim-${idx}">${optsHtml}</select>
            </div>
        </div>`;
    }).join('');

    // Set current values and events
    DIAS.forEach((_,idx)=>{
        const f=funcData[idx]||{aberto:false,inicio:'08:00',fim:'18:00'};
        const ini=$(`func-ini-${idx}`);const fim=$(`func-fim-${idx}`);
        if(ini)ini.value=f.inicio;if(fim)fim.value=f.fim;
        const toggle=$(`func-toggle-${idx}`);
        if(toggle)toggle.addEventListener('change',()=>{
            const day=$(`func-day-${idx}`);
            day.classList.toggle('fechado',!toggle.checked);
        });
    });
}

// Liga o botão de salvar horário de funcionamento — chamada por
// initHorariosExtras(), depois que window.$ e companhia já estão prontos.
function initHorariosExtras(){
$('btn-salvar-func').addEventListener('click',async()=>{
    const novo={};
    DIAS.forEach((_,idx)=>{
        const toggle=$(`func-toggle-${idx}`);
        novo[idx]={
            aberto:toggle?.checked||false,
            inicio:$(`func-ini-${idx}`)?.value||'08:00',
            fim:$(`func-fim-${idx}`)?.value||'18:00'
        };
    });
    intervaloMin=Number($('sel-intervalo').value)||30;
    novo.intervalo=intervaloMin;
    funcData=novo;
    await setDoc(doc(db,'barbeiros',barbeiroData.uid,'config','funcionamento'),novo);
    toast('Horário de funcionamento salvo!');
    renderFuncGrid();
    renderHours();
});
}

// HORÁRIOS - GRADE
function initHorarios(){
    renderFuncGrid();
    $('sel-intervalo').value=intervaloMin;
    // Populate equipe select
    const sel=$('eq-select-horario');
    const wrap=$('eq-picker-wrap');
    const equipe=barbeiroData.equipe||[];
    if(equipe.length>0){
        wrap.style.display='block';
        sel.innerHTML='<option value="">— Todos (geral) —</option>'+
            equipe.map(b=>`<option value="${b.nome}">${b.nome}</option>`).join('');
        if(!sel.dataset.bound){
            sel.dataset.bound='1';
            sel.addEventListener('change',()=>renderHours());
        }
    } else {
        wrap.style.display='none';
    }

    const picker=$('date-picker');
    picker.innerHTML='';
    const hoje=new Date();
    for(let i=0;i<7;i++){
        const d=new Date(hoje);d.setDate(hoje.getDate()+i);
        const key=d.toISOString().split('T')[0];
        const chip=document.createElement('div');
        chip.className='date-chip'+(key===selectedDate?' active':'');
        chip.textContent=i===0?'Hoje':fmtDate(d);
        chip.dataset.date=key;
        chip.addEventListener('click',()=>{
            document.querySelectorAll('.date-chip').forEach(c=>c.classList.remove('active'));
            chip.classList.add('active');selectedDate=key;renderHours();
        });
        picker.appendChild(chip);
    }
    renderHours();
}

// (Estoque, Insumos e Zona de Perigo agora ficam em barbeiro-estoque.js)


async function renderHours(){
    const grid=$('hours-grid');
    grid.innerHTML='<div style="color:var(--muted);font-size:.8rem">Carregando...</div>';

    const dateObj=new Date(selectedDate+'T12:00:00');
    const diaSemana=dateObj.getDay();
    const func=funcData[diaSemana]||{aberto:false,inicio:'08:00',fim:'18:00'};

    if(!func.aberto){
        grid.innerHTML='<div style="color:var(--muted);font-size:.85rem;padding:.5rem">Barbearia fechada neste dia.</div>';
        return;
    }

    const iniMin=horaParaMin(func.inicio);
    const fimMin=horaParaMin(func.fim);

    const agora=new Date();
    const isHoje=selectedDate===fmtHoje();
    const agoraMin=isHoje?agora.getHours()*60+agora.getMinutes():0;

    // Barbeiro selecionado no filtro
    const sel=$('eq-select-horario');
    const barbSel=sel?sel.value:'';

    // Agendamentos filtrados por barbeiro se selecionado
    const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid),where('data','==',selectedDate));
    let agendSnap;try{agendSnap=await getDocs(q);}catch(e){agendSnap={forEach:()=>{}};}
    const horasOcupadas=new Set();
    agendSnap.forEach(d=>{
        const ag=d.data();
        if(ag.status==='cancelado')return; // cancelado libera o horário
        if(barbSel) { if(ag.barbeiro===barbSel) horasOcupadas.add(ag.hora); }
        else horasOcupadas.add(ag.hora);
    });

    // Bloqueios por barbeiro ou geral
    const bloqKey = barbSel ? `${selectedDate}_${barbSel}` : selectedDate;
    const bRef=doc(db,'barbeiros',barbeiroData.uid,'bloqueios',bloqKey);
    const bSnap=await getDoc(bRef);
    const bloqueados=bSnap.exists()?(bSnap.data().horas||[]):[];

    // Gera slots dentro do horário de funcionamento
    const slots=gerarSlots(iniMin,fimMin,intervaloMin);

    if(!slots.length){grid.innerHTML='<div style="color:var(--muted);font-size:.85rem">Nenhum slot configurado.</div>';return;}

    grid.innerHTML=slots.map(hora=>{
        const min=horaParaMin(hora);
        const passado=isHoje&&min<=agoraMin;
        const ocupado=horasOcupadas.has(hora);
        const bloq=bloqueados.includes(hora);
        const cls=passado?'passado':ocupado?'ocupado':bloq?'bloqueado':'livre';
        return `<div class="hour-slot ${cls}" data-hora="${hora}" data-status="${cls}">${hora}</div>`;
    }).join('');

    grid.querySelectorAll('.hour-slot:not(.ocupado):not(.passado)').forEach(slot=>{
        slot.addEventListener('click',async()=>{
            const hora=slot.dataset.hora;
            const isBloq=slot.dataset.status==='bloqueado';
            const novosBloq=isBloq?bloqueados.filter(h=>h!==hora):[...bloqueados,hora];
            await setDoc(bRef,{horas:novosBloq});
            renderHours();
            toast(isBloq?'Horário liberado':'Horário bloqueado');
        });
    });
}

// Link de agendamento do cliente — mora na aba Clientes, mas não depende de
// nada exclusivo de Configurações, então roda para dono E recepcionista.
function initLinkCliente(){
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const baseUrl = isLocal
        ? window.location.origin + '/'
        : 'https://alesh4rk-design.github.io/prob-site/';
    const link = baseUrl + 'cliente.html?b=' + barbeiroData.uid;
    const linkEl=$('link-cliente');
    if(linkEl) linkEl.textContent=link;
    const btnCopy=$('btn-copy-link');
    if(btnCopy && !btnCopy.dataset.bound){
        btnCopy.dataset.bound='1';
        btnCopy.addEventListener('click',()=>{navigator.clipboard.writeText(link).then(()=>toast('Link copiado!'));});
    }
}
