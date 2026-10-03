// ══════════════════════════════════════════════════════════
// ESPELHO PÚBLICO — o que a tela do cliente e o painel da TV podem ver.
//
// Os agendamentos e a fila têm nome completo e WhatsApp do cliente, então
// só o dono e a equipe logada podem ler essas coleções. Pra tela pública
// saber quais horários estão ocupados (e a TV chamar o próximo), existe uma
// cópia enxuta, sem telefone e só com o primeiro nome:
//   horariosOcupados/{id}  ← um por agendamento de hoje em diante
//   filaPublica/{id}       ← um por cliente aguardando na fila
// O agendamento/fila guarda o id da cópia em `publicoId` (o id da cópia é
// diferente do original de propósito: a cópia é pública e não pode revelar
// o id do registro com os dados pessoais).
//
// Quem cria/altera o registro original também atualiza a cópia; além disso,
// o painel do dono confere tudo a cada mudança (sincronizarHorariosPublicos /
// sincronizarFilaPublica) e corrige o que estiver faltando ou sobrando.
// Script comum (não módulo): usa db, doc, setDoc... expostos no window.
// ══════════════════════════════════════════════════════════

function nomeCurtoPublico(nome){
    const partes=(nome||'Cliente').trim().split(/\s+/).filter(Boolean);
    if(!partes.length) return 'Cliente';
    return partes[0]+(partes.length>1?' '+partes[partes.length-1][0].toUpperCase()+'.':'');
}

// Duração do atendimento em minutos: a gravada no agendamento ou, para os
// antigos, a soma das durações cadastradas dos serviços ("Corte + Barba").
function duracaoAtendimento(a){
    if(a && Number(a.duracao)>0) return Number(a.duracao);
    const cortes=(window.barbeiroData&&barbeiroData.cortes)||[];
    let total=0;
    String((a&&a.corte)||'').split(' + ').forEach(n=>{
        const c=cortes.find(x=>x.nome===n.trim());
        if(c) total+=Number(c.duracao||30);
    });
    return total||30;
}

function dadosHorarioPublico(a){
    return {
        barbeiroId: a.barbeiroId || barbeiroData.uid,
        data: a.data || '',
        hora: a.hora || '',
        duracao: duracaoAtendimento(a),
        barbeiro: a.barbeiro || '',
        status: a.status || 'pendente',
        nome: nomeCurtoPublico(a.clienteNome),
        corte: a.corte || ''
    };
}
function dadosFilaPublica(f){
    return {
        barbeiroId: f.barbeiroId || barbeiroData.uid,
        nome: nomeCurtoPublico(f.clienteNome),
        corte: f.corte || '',
        barbeiro: f.barbeiro || '',
        status: f.status || 'aguardando',
        criadoEm: f.criadoEm || new Date().toISOString()
    };
}

// Agendamento que ocupa horário na agenda pública: de hoje em diante, não
// cancelado e que não seja uma cobrança avulsa (não ocupa horário).
function horarioDeveSerPublico(a){
    return !!a && a.status!=='cancelado' && a.origem!=='cobranca-manual'
        && !!a.data && !!a.hora && a.data>=fmtHoje();
}

async function espelharAgendamento(agId, a){
    try{
        if(!horarioDeveSerPublico(a)){
            if(a && a.publicoId) await deleteDoc(doc(db,'horariosOcupados',a.publicoId));
            return;
        }
        let pid=a.publicoId;
        if(!pid){
            pid=doc(collection(db,'horariosOcupados')).id;
            await updateDoc(doc(db,'agendamentos',agId),{publicoId:pid});
            a.publicoId=pid;
        }
        await setDoc(doc(db,'horariosOcupados',pid),dadosHorarioPublico(a));
    }catch(e){ console.error('espelharAgendamento:',e); }
}

async function espelharFila(filaId, f){
    try{
        if(!f || f.status!=='aguardando'){
            if(f && f.publicoId) await deleteDoc(doc(db,'filaPublica',f.publicoId));
            return;
        }
        let pid=f.publicoId;
        if(!pid){
            pid=doc(collection(db,'filaPublica')).id;
            await updateDoc(doc(db,'fila',filaId),{publicoId:pid});
            f.publicoId=pid;
        }
        await setDoc(doc(db,'filaPublica',pid),dadosFilaPublica(f));
    }catch(e){ console.error('espelharFila:',e); }
}

function mesmoConteudo(a,b){
    return Object.keys(a).every(k=>String(a[k]??'')===String((b||{})[k]??''));
}

// Confere a cópia pública contra a lista completa (só o dono tem a lista
// completa) e corrige diferenças. Com intervalo mínimo pra não rodar a cada
// mudança pequena.
let __syncHorariosTimer=null;
function sincronizarHorariosPublicos(todos){
    clearTimeout(__syncHorariosTimer);
    __syncHorariosTimer=setTimeout(()=>__sincronizarHorarios(todos),1500);
}
async function __sincronizarHorarios(todos){
    try{
        const snap=await getDocs(query(collection(db,'horariosOcupados'),where('barbeiroId','==',barbeiroData.uid)));
        const existentes={};
        snap.forEach(d=>existentes[d.id]=d.data());
        const usados=new Set();
        for(const a of todos){
            if(!horarioDeveSerPublico(a)) continue;
            if(a.publicoId && existentes[a.publicoId] && !usados.has(a.publicoId)){
                usados.add(a.publicoId);
                const desejado=dadosHorarioPublico(a);
                if(!mesmoConteudo(desejado,existentes[a.publicoId])) await setDoc(doc(db,'horariosOcupados',a.publicoId),desejado);
            } else {
                if(a.publicoId && usados.has(a.publicoId)) a.publicoId=null; // id repetido (ex: backup restaurado)
                await espelharAgendamento(a.id,a);
                if(a.publicoId) usados.add(a.publicoId);
            }
        }
        // Sobrou cópia sem agendamento correspondente (cancelado, passado, apagado)
        for(const id of Object.keys(existentes)){
            if(!usados.has(id)) await deleteDoc(doc(db,'horariosOcupados',id));
        }
    }catch(e){ console.error('sincronizarHorariosPublicos:',e); }
}

let __syncFilaTimer=null;
function sincronizarFilaPublica(aguardando){
    clearTimeout(__syncFilaTimer);
    __syncFilaTimer=setTimeout(()=>__sincronizarFila(aguardando),1500);
}
async function __sincronizarFila(aguardando){
    try{
        const snap=await getDocs(query(collection(db,'filaPublica'),where('barbeiroId','==',barbeiroData.uid)));
        const existentes={};
        snap.forEach(d=>existentes[d.id]=d.data());
        const usados=new Set();
        for(const f of aguardando){
            if(f.publicoId && existentes[f.publicoId] && !usados.has(f.publicoId)){
                usados.add(f.publicoId);
                const desejado=dadosFilaPublica(f);
                if(!mesmoConteudo(desejado,existentes[f.publicoId])) await setDoc(doc(db,'filaPublica',f.publicoId),desejado);
            } else {
                if(f.publicoId && usados.has(f.publicoId)) f.publicoId=null;
                await espelharFila(f.id,f);
                if(f.publicoId) usados.add(f.publicoId);
            }
        }
        for(const id of Object.keys(existentes)){
            if(!usados.has(id)) await deleteDoc(doc(db,'filaPublica',id));
        }
    }catch(e){ console.error('sincronizarFilaPublica:',e); }
}

// ── Duração: horários livres considerando quanto tempo cada atendimento leva ──
// ocupados: [{hora:'10:00', duracao:60}], bloqueios: ['12:00', ...] (cada um
// vale um intervalo da agenda). Um horário serve se o atendimento novo
// (duracaoNova) inteiro cabe sem encostar em nada e termina até o fechamento.
function intervalosOcupados(ocupados, bloqueios, intervaloMin){
    const lista=(ocupados||[]).map(o=>{const ini=horaParaMin(o.hora);return {ini,fim:ini+(Number(o.duracao)||intervaloMin)};});
    (bloqueios||[]).forEach(h=>{const ini=horaParaMin(h);lista.push({ini,fim:ini+intervaloMin});});
    return lista;
}
function horarioCabe(slotMin, duracaoNova, intervalos, fimMin){
    if(slotMin+duracaoNova>fimMin) return false;
    return !intervalos.some(o=>slotMin<o.fim && o.ini<slotMin+duracaoNova);
}
// Horário coberto por algum atendimento já marcado (pra pintar a grade)
function horarioCoberto(slotMin, intervalos){
    return intervalos.some(o=>slotMin>=o.ini && slotMin<o.fim);
}

window.espelharAgendamento=espelharAgendamento;
window.espelharFila=espelharFila;
window.sincronizarHorariosPublicos=sincronizarHorariosPublicos;
window.sincronizarFilaPublica=sincronizarFilaPublica;
