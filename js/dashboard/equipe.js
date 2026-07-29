// ══════════════════════════════════════════════════════════
// CORTES, EQUIPE E GANHOS — barbeiro-equipe.js
//
// Script comum (não é módulo ES), mesma lógica dos outros arquivos já
// separados. Usa window.$, window.escapeHtml, window.escAttr,
// window.toast, window.fmtHoje, window.barbeiroData, window.db e as
// funções do Firestore, todos disponibilizados pelo módulo principal.
// ══════════════════════════════════════════════════════════

// Diz se um membro da equipe corta cabelo de verdade (aparece pro cliente
// escolher e pras telas de Agendamento Presencial/Fila) — barbeiro sempre
// atende; recepcionista só se marcou explicitamente que também atende.
// Registros antigos (antes desse campo existir) não tinham "atende"
// salvo, então cai no padrão por tipo pra não sumir barbeiro nenhum.
function atendeClientes(membro){
    if(membro.atende!=null) return !!membro.atende;
    return membro.tipo!=='recepcionista';
}

// CORTES
function renderCortes(){
    const lista=barbeiroData.cortes||[];
    const container=$('lista-cortes');

    // Popula botões de categorias customizadas (além das 3 fixas)
    const CATEGORIAS_FIXAS=['Corte de Cabelo','Barba','Sobrancelha'];
    const todasSessoes=[...new Set(lista.map(c=>c.sessao||'Geral'))];
    const categoriasCustom=todasSessoes.filter(s=>!CATEGORIAS_FIXAS.includes(s));
    const btnWrap=document.getElementById('sessao-btns');
    const btnNovaCat=document.getElementById('btn-nova-categoria');
    if(btnWrap&&btnNovaCat){
        // Remove botões custom antigos antes de re-renderizar
        btnWrap.querySelectorAll('.sessao-btn-custom').forEach(b=>b.remove());
        categoriasCustom.forEach(cat=>{
            const b=document.createElement('button');
            b.type='button';
            b.className='sessao-btn sessao-btn-custom';
            b.dataset.sessao=cat;
            b.textContent='🏷️ '+cat;
            b.style.cssText='padding:.45rem .9rem;border-radius:20px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-size:.8rem;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:.3rem';
            btnWrap.insertBefore(b,btnNovaCat);
        });
        // Re-atribui eventos aos novos botões
        initSessaoBtns();
    }

    if(!lista.length){container.innerHTML=`<div class="empty-state"><div class="icon">✂️</div>Nenhum serviço cadastrado ainda.</div>`;return;}

    // Agrupa por sessão, mantendo o índice original da lista plana para remover corretamente
    const porSessao={};
    lista.forEach((c,i)=>{
        const sessao=c.sessao||'Geral';
        if(!porSessao[sessao])porSessao[sessao]=[];
        porSessao[sessao].push({...c,_idx:i});
    });

    container.innerHTML=Object.entries(porSessao).map(([sessao,itens])=>`
        <div style="font-size:.78rem;color:var(--blue);font-weight:700;margin:1rem 0 .5rem;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:.4rem">
            <span>📁 ${sessao}</span><span style="font-size:.68rem;color:var(--muted);font-weight:400">(${itens.length})</span>
        </div>
        ${itens.map(c=>`
        <div class="service-item">
            ${c.foto?`<img class="service-foto-thumb" src="${c.foto}" alt="${escapeHtml(c.nome)}" onerror="this.style.display='none'">`:`<div class="service-foto-placeholder">✂️</div>`}
            <div style="flex:1;min-width:0">
                <div class="service-name">${escapeHtml(c.nome)}</div>
                ${c.duracao?`<div style="font-size:.7rem;color:var(--muted);margin-top:.15rem">⏱️ ${c.duracao} min</div>`:''}
                ${c.obs?`<div style="font-size:.7rem;color:var(--yellow);margin-top:.2rem">ℹ️ ${escapeHtml(c.obs)}</div>`:''}
                <div class="service-actions">
                    <button class="btn-edit" data-idx="${c._idx}">✏️ Editar</button>
                    <button class="btn-del" data-idx="${c._idx}">Remover</button>
                </div>
            </div>
            <div class="service-price-badge">R$ ${Number(c.preco).toFixed(2)}</div>
        </div>`).join('')}
    `).join('');

    container.querySelectorAll('.btn-edit').forEach(btn=>{
        btn.addEventListener('click',()=>{ abrirEditarCorte(Number(btn.dataset.idx)); });
    });

    container.querySelectorAll('.btn-del').forEach(btn=>{
        btn.addEventListener('click',async()=>{
            barbeiroData.cortes.splice(Number(btn.dataset.idx),1);
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{cortes:barbeiroData.cortes});
            renderCortes();toast('Serviço removido');
        });
    });
}

// EQUIPE
async function renderLinksEquipe(){
    const container = document.getElementById('lista-links-func-equipe');
    if(!container) return;
    const equipe = barbeiroData.equipe || [];
    if(!equipe.length){
        container.innerHTML = '<div class="empty-state"><div class="icon">🔗</div>Adicione pessoas acima para gerar os convites.</div>';
        return;
    }
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const baseUrl = isLocal ? window.location.origin + '/' : 'https://alesh4rk-design.github.io/prob-site/';

    let authDocs={};
    try{
        const snap=await getDocs(collection(db,'barbeiros',barbeiroData.uid,'equipeAuth'));
        snap.forEach(d=>authDocs[d.id]=d.data());
    }catch(e){ console.error('renderLinksEquipe:',e); }

    container.innerHTML = equipe.map(b => {
        const authInfo = authDocs[b.id];
        const cargo = b.tipo==='recepcionista'?'Recepcionista':'Barbeiro';

        if(!authInfo){
            // Ainda não aceitou o convite — mostra o link de convite
            const conviteLink = `${baseUrl}barbeiro.html?convite=${encodeURIComponent(b.id)}&bId=${barbeiroData.uid}`;
            const msgWpp = encodeURIComponent(`Olá ${b.nome}! Você foi convidado(a) para trabalhar como ${cargo.toLowerCase()} — é só abrir esse link e criar sua senha de acesso: ${conviteLink}`);
            return `<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;margin-bottom:.5rem">
                <div style="font-weight:700;font-size:.88rem;margin-bottom:.2rem">${escapeHtml(b.nome)} <span style="font-size:.65rem;color:var(--yellow);font-weight:400">· convite pendente</span></div>
                <div style="font-size:.7rem;color:var(--muted);word-break:break-all;margin:.4rem 0 .6rem;background:var(--card);padding:.4rem .65rem;border-radius:6px;border:1px solid var(--border)">${conviteLink}</div>
                <div style="display:flex;gap:.5rem">
                    <button class="btn-add" style="flex:1;font-size:.75rem;padding:.4rem" onclick="navigator.clipboard.writeText('${conviteLink}').then(()=>toast('✓ Convite de ${escAttr(b.nome)} copiado!'))">📋 Copiar</button>
                    <a href="https://wa.me/?text=${msgWpp}" target="_blank" class="btn-wpp" style="flex:1;text-align:center;font-size:.75rem;padding:.4rem;text-decoration:none">📱 WhatsApp</a>
                </div>
                <button class="btn-del" style="width:100%;font-size:.72rem;padding:.35rem;margin-top:.5rem" onclick="removerConvitePendente('${b.id}','${escAttr(b.nome)}')">🗑️ Remover convite</button>
            </div>`;
        }

        const ativo = authInfo.ativo!==false;
        return `<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;margin-bottom:.5rem">
            <div style="font-weight:700;font-size:.88rem;margin-bottom:.2rem">${escapeHtml(b.nome)} <span style="font-size:.65rem;color:${ativo?'var(--green)':'var(--red)'};font-weight:400">· ${ativo?'✅ acesso ativo':'⛔ acesso desativado'}</span></div>
            <div style="font-size:.72rem;color:var(--muted);margin-bottom:.6rem">${escapeHtml(authInfo.email||'')}</div>
            <button class="btn-${ativo?'del':'add'}" style="width:100%;font-size:.75rem;padding:.4rem" onclick="toggleAcessoEquipe('${b.id}',${!ativo})">${ativo?'⛔ Desativar acesso':'✅ Reativar acesso'}</button>
        </div>`;
    }).join('');
}

window.toggleAcessoEquipe = async(equipeId, novoAtivo) => {
    try{
        await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'equipeAuth',equipeId),{ativo:novoAtivo});
        toast(novoAtivo?'Acesso reativado!':'Acesso desativado.');
        renderLinksEquipe();
    }catch(e){ toast('Erro ao atualizar acesso','var(--red)'); }
};

// Remove um convite ainda pendente (ninguém aceitou ainda) — tira a pessoa
// da equipe direto, sem precisar esperar ela criar a conta pra só depois
// conseguir remover pela lista principal.
window.removerConvitePendente = async(equipeId, nome) => {
    if(!confirm(`Remover o convite de "${nome}"? Ela(e) não vai mais conseguir usar esse link.`)) return;
    try{
        const idx = (barbeiroData.equipe||[]).findIndex(e=>e.id===equipeId);
        if(idx===-1) return;
        barbeiroData.equipe.splice(idx,1);
        await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:equipeSemComissao()});
        try{ await deleteDoc(doc(db,'barbeiros',barbeiroData.uid,'comissoes',equipeId)); }catch(e){}
        toast(`Convite de ${nome} removido.`);
        renderEquipe();renderLinksEquipe();carregarGanhos();
    }catch(e){ toast('Erro ao remover convite','var(--red)'); }
};

// Comissão (%) de cada barbeiro fica numa subcoleção à parte, não no
// documento público da barbearia — ver comentário nas regras do Firestore.
// barbeiroData.equipe[i].pct continua existindo só EM MEMÓRIA (mesclado
// aqui) pra não precisar mexer em todo o resto do código que já lê ".pct"
// dali; nunca é isso que vai pro banco quando salvamos o array "equipe".
let comissoesCache = {};
// Configuração de pagamento de comissão de cada membro (não é mais um dia
// único global — cada barbeiro pode combinar semanal, quinzenal ou mensal,
// com o próprio dia). id -> {freq:'semanal'|'quinzenal'|'mensal', dia:number}
let comissaoConfigCache = {};

function escutarComissoes(){
    if(window.__recepcionista || window.__comissoesListenerAtivo) return;
    window.__comissoesListenerAtivo = true;
    migrarComissoesAntigas();
    onSnapshot(collection(db,'barbeiros',barbeiroData.uid,'comissoes'), snap=>{
        comissoesCache = {};
        comissaoConfigCache = {};
        snap.forEach(d=>{
            const dados=d.data();
            comissoesCache[d.id] = dados.pct;
            comissaoConfigCache[d.id] = {freq: dados.freqComissao||'mensal', dia: dados.diaComissao ?? 5};
        });
        (barbeiroData.equipe||[]).forEach(e=>{
            if(e.tipo!=='recepcionista') e.pct = comissoesCache[e.id] ?? (e.pct ?? 50);
        });
        renderEquipe();
        if(typeof carregarGanhos==='function') carregarGanhos();
    }, e=>console.error('comissoes:',e));
}

// Autocorreção pra barbearias cadastradas antes da comissão sair do doc
// público: se algum membro da equipe ainda tem "pct" salvo ali, migra pra
// cá e regrava o doc público sem esse campo. Roda uma vez só, por sessão.
async function migrarComissoesAntigas(){
    const equipe = barbeiroData.equipe||[];
    const comPctAntigo = equipe.filter(e=>e.pct!=null && e.tipo!=='recepcionista');
    if(!comPctAntigo.length) return;
    try{
        for(const e of comPctAntigo){
            await setDoc(doc(db,'barbeiros',barbeiroData.uid,'comissoes',e.id),{pct:e.pct});
        }
        await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:equipeSemComissao()});
    }catch(err){ console.error('migrarComissoesAntigas:',err); }
}

// Tira o campo "pct" antes de gravar o array "equipe" no doc público —
// a comissão nunca deve ir parar lá (ver escutarComissoes acima).
function equipeSemComissao(){
    return (barbeiroData.equipe||[]).map(({pct, ...resto})=>resto);
}

function renderEquipe(){
    const lista=barbeiroData.equipe||[];
    const container=$('lista-equipe');
    if(!lista.length){container.innerHTML=`<div class="empty-state"><div class="icon">👥</div>Ninguém cadastrado ainda.</div>`;return;}
    const modoLeitura = !!window.__recepcionista;

    container.innerHTML=lista.map((b,i)=>{
        const ehRecep = b.tipo==='recepcionista';
        const badge = ehRecep
            ? `<span style="font-size:.65rem;background:rgba(0,212,255,.12);color:var(--blue);border:1px solid rgba(0,212,255,.3);border-radius:20px;padding:.1rem .5rem;margin-left:.4rem">🗒️ Recepcionista</span>`
            : `<span style="font-size:.65rem;background:rgba(0,255,136,.1);color:var(--green);border:1px solid rgba(0,255,136,.25);border-radius:20px;padding:.1rem .5rem;margin-left:.4rem">✂️ Barbeiro</span>`;
        const recepAtende = ehRecep && atendeClientes(b);
        const infoLinha = ehRecep
            ? `<div style="font-size:.75rem;color:var(--muted);margin-top:.2rem">Organiza agendamentos, fila e clientes${recepAtende?' · <span style="color:var(--green)">✂️ também corta cabelo</span>':''}</div>`
            : (modoLeitura
                ? ''
                : `<div style="font-size:.75rem;color:var(--muted);margin-top:.2rem">Comissão: <span style="color:var(--blue);font-weight:700">${b.pct||50}%</span> por corte</div>`);

        const acoes = modoLeitura ? '' : `
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;justify-content:flex-end">
                ${ehRecep?'':`
                <input type="number" class="pct-input" data-idx="${i}" value="${b.pct||50}"
                    min="0" max="100" step="5"
                    style="width:58px;background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:.3rem .5rem;color:var(--text);font-size:.85rem;text-align:center;">
                <span style="font-size:.75rem;color:var(--muted)">%</span>
                <button class="btn-save" style="padding:.3rem .7rem;font-size:.72rem" data-save="${i}">Salvar</button>`}
                ${ehRecep?`<button class="btn-edit" style="padding:.3rem .7rem;font-size:.72rem" data-toggle-atende="${i}">${recepAtende?'✂️ Também corta: Sim':'✂️ Também corta: Não'}</button>`:''}
                <button class="btn-edit" style="padding:.3rem .7rem;font-size:.72rem" data-trocar-tipo="${i}" title="Trocar entre Barbeiro e Recepcionista">🔄 ${ehRecep?'Virar Barbeiro':'Virar Recepcionista'}</button>
                <button class="btn-del" data-idx="${i}">Remover</button>
            </div>`;

        return `<div class="service-item" style="flex-wrap:wrap">
            <div style="flex:1;min-width:140px">
                <div class="service-name" style="padding-right:0">${escapeHtml(b.nome)}${badge}</div>
                ${infoLinha}
            </div>
            ${acoes}
        </div>`;
    }).join('');

    if(modoLeitura) return; // recepcionista não edita/remove/vê comissão

    container.querySelectorAll('[data-save]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
            const i=Number(btn.dataset.save);
            const pct=Number(container.querySelector(`.pct-input[data-idx="${i}"]`).value);
            barbeiroData.equipe[i].pct=pct;
            await setDoc(doc(db,'barbeiros',barbeiroData.uid,'comissoes',barbeiroData.equipe[i].id),{pct});
            toast(`${barbeiroData.equipe[i].nome}: ${pct}% salvo!`);
            renderEquipe();
            carregarGanhos();
        });
    });
    container.querySelectorAll('[data-toggle-atende]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
            const i=Number(btn.dataset.toggleAtende);
            const membro=barbeiroData.equipe[i];
            barbeiroData.equipe[i].atende = !atendeClientes(membro);
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:equipeSemComissao()});
            toast(`${membro.nome}: ${barbeiroData.equipe[i].atende?'agora corta cabelo também':'não corta mais cabelo'}`);
            renderEquipe();
        });
    });
    container.querySelectorAll('[data-trocar-tipo]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
            const i=Number(btn.dataset.trocarTipo);
            const membro=barbeiroData.equipe[i];
            const novoTipo = membro.tipo==='recepcionista' ? 'barbeiro' : 'recepcionista';
            if(!confirm(`Trocar ${membro.nome} para ${novoTipo==='recepcionista'?'Recepcionista':'Barbeiro'}?\n\nNa próxima vez que ela(e) entrar, o menu já vem atualizado sozinho.`)) return;
            barbeiroData.equipe[i].tipo = novoTipo;
            if(novoTipo==='recepcionista'){
                barbeiroData.equipe[i].pct = 0;
                await setDoc(doc(db,'barbeiros',barbeiroData.uid,'comissoes',membro.id),{pct:0});
            }
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:equipeSemComissao()});
            toast(`${membro.nome} agora é ${novoTipo==='recepcionista'?'Recepcionista':'Barbeiro'}!`);
            renderEquipe();
            carregarGanhos();
        });
    });
    container.querySelectorAll('.btn-del').forEach(btn=>{
        btn.addEventListener('click',async()=>{
            const idx=Number(btn.dataset.idx);
            const equipeId=barbeiroData.equipe[idx]?.id;
            barbeiroData.equipe.splice(idx,1);
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:equipeSemComissao()});
            // Revoga o acesso de vez, mesmo que a pessoa já tivesse criado a própria conta
            if(equipeId){
                try{ await deleteDoc(doc(db,'barbeiros',barbeiroData.uid,'equipeAuth',equipeId)); }catch(e){}
                try{ await deleteDoc(doc(db,'barbeiros',barbeiroData.uid,'comissoes',equipeId)); }catch(e){}
            }
            renderEquipe();carregarGanhos();toast('Removido e acesso revogado');
        });
    });
}

// Liga os cliques que antes rodavam soltos (fora de função) — agora
// chamados explicitamente pelo módulo principal, depois que window.$ e
// companhia já estão prontos. Ver chamada de initEquipeExtras() no
// barbeiro.html.
function initEquipeExtras(){
$('eq-tipo').addEventListener('change',function(){
    const ehRecep = this.value==='recepcionista';
    $('eq-pct-wrap').style.display = ehRecep?'none':'block';
    // Barbeiro sempre corta cabelo — a opção só faz sentido pra
    // recepcionista, que às vezes também atende em alguns casos.
    $('eq-atende-wrap').style.display = ehRecep?'flex':'none';
    if(!ehRecep) $('eq-atende').checked=false;
});

$('btn-add-barbeiro').addEventListener('click',async()=>{
    const nome=$('eq-nome').value.trim();
    const tipo=$('eq-tipo').value;
    const pct=tipo==='recepcionista'?0:(Number($('eq-pct').value)||50);
    const atende = tipo==='barbeiro' ? true : $('eq-atende').checked;
    const wpp=($('eq-wpp')?.value||'').replace(/\D/g,'');
    if(!nome){toast('Informe o nome','var(--red)');return;}
    barbeiroData.equipe=barbeiroData.equipe||[];
    const novoId=Date.now().toString();
    barbeiroData.equipe.push({id:novoId,nome,pct,tipo,atende,wpp:wpp||null,criadoEm:new Date().toISOString()});
    await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:equipeSemComissao()});
    await setDoc(doc(db,'barbeiros',barbeiroData.uid,'comissoes',novoId),{pct});
    $('eq-nome').value='';$('eq-pct').value='';$('eq-atende').checked=false;if($('eq-wpp'))$('eq-wpp').value='';
    renderEquipe();carregarGanhos();toast((tipo==='recepcionista'?'Recepcionista':'Barbeiro')+' adicionado!');
});

}

// GANHOS
// Guarda o ganho de cada barbeiro no mês atual (nome -> {total,cortes,pct,ganho})
// pra alimentar a seção de Pagamento de Comissões sem recalcular tudo de novo.
let ganhosMesCache = {};
let mesGanhosCache = '';

// Últimos "concluidos" carregados — reaproveitado pelo cálculo de período
// de comissão (semanal/quinzenal/mensal), pra não buscar tudo de novo.
let concluidosCache = [];
let ganhosCarregados = false;

async function carregarGanhos(){
    const equipe=barbeiroData.equipe||[];
    if(!equipe.length){
        $('ganhos-hoje').innerHTML='<div class="empty-state"><div class="icon">👥</div>Cadastre a equipe primeiro.</div>';
        $('ganhos-mes').innerHTML='';
        return;
    }

    const hoje=fmtHoje();
    const mesAtual=hoje.slice(0,7); // YYYY-MM

    const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid));
    let snap;try{snap=await getDocs(q);}catch(e){return;}

    const todos=[];snap.forEach(d=>todos.push(d.data()));
    const concluidos=todos.filter(a=>a.status==='concluido');
    concluidosCache = concluidos;
    ganhosCarregados = true;

    function renderGanhos(container, lista, titulo, guardarCache){
        if(!lista.length){
            container.innerHTML=`<div class="empty-state"><div class="icon">💰</div>Nenhum corte concluído ${titulo}.</div>`;
            if(guardarCache){ ganhosMesCache={}; mesGanhosCache=mesAtual; }
            return;
        }
        // Agrupa por barbeiro
        const porBarbeiro={};
        let totalGeral=0;
        lista.forEach(a=>{
            const nome=a.barbeiro||'Sem barbeiro';
            if(!porBarbeiro[nome])porBarbeiro[nome]={total:0,cortes:0};
            porBarbeiro[nome].total+=Number(a.preco||0);
            porBarbeiro[nome].cortes++;
            totalGeral+=Number(a.preco||0);
        });

        const maxTotal=Math.max(...Object.values(porBarbeiro).map(v=>v.total));

        if(guardarCache){
            ganhosMesCache={};
            mesGanhosCache=mesAtual;
            Object.entries(porBarbeiro).forEach(([nome,dados])=>{
                const membroEquipe=equipe.find(b=>b.nome===nome);
                const pct=membroEquipe?.pct||50;
                ganhosMesCache[nome]={total:dados.total,cortes:dados.cortes,pct,ganho:dados.total*pct/100};
            });
        }

        container.innerHTML=Object.entries(porBarbeiro).map(([nome,dados])=>{
            const membroEquipe=equipe.find(b=>b.nome===nome);
            const pct=membroEquipe?.pct||50;
            const ganhoBarb=(dados.total*pct/100);
            const barra=maxTotal>0?Math.round((dados.total/maxTotal)*100):0;
            return `<div class="ganho-card">
                <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem">
                        <span class="ganho-nome">✂️ ${nome}</span>
                        <span class="ganho-pct">${pct}%</span>
                        <span style="font-size:.72rem;color:var(--muted)">${dados.cortes} corte${dados.cortes>1?'s':''}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.3rem">
                        <span class="ganho-total">Faturado: R$${dados.total.toFixed(2)}</span>
                        <span class="ganho-barb">→ R$${ganhoBarb.toFixed(2)}</span>
                    </div>
                    <div class="ganho-bar-wrap">
                        <div class="ganho-bar" style="width:${barra}%"></div>
                    </div>
                </div>
            </div>`;
        }).join('')+
        `<div style="text-align:right;font-size:.78rem;color:var(--muted);margin-top:.5rem;padding:.5rem 0;border-top:1px solid var(--border)">
            Total barbearia: <span style="color:var(--green);font-family:'Courier New',monospace;font-weight:700">R$${totalGeral.toFixed(2)}</span>
        </div>`;
    }

    renderGanhos($('ganhos-hoje'), concluidos.filter(a=>a.data===hoje), 'hoje', false);
    renderGanhos($('ganhos-mes'),  concluidos.filter(a=>a.data&&a.data.startsWith(mesAtual)), 'este mês', true);
    renderPagamentoComissoes();
    if(typeof atualizarCentralAvisos==='function') atualizarCentralAvisos();
}

// ══════════════════════════════════════════════════════════
// PAGAMENTO DE COMISSÕES — cada barbeiro pode ter o próprio combinado:
// semanal, quinzenal ou mensal, cada um com seu dia. Não mexe em nada
// financeiro automático — é só um checklist com lembrete.
// ══════════════════════════════════════════════════════════
let pagamentosComissaoCache = [];
let unsubPagamentosComissao = null;

function escutarPagamentosComissao(){
    if(window.__recepcionista || window.__pagamentosComissaoListenerAtivo) return;
    window.__pagamentosComissaoListenerAtivo = true;
    unsubPagamentosComissao = onSnapshot(collection(db,'barbeiros',barbeiroData.uid,'pagamentosComissao'), snap=>{
        pagamentosComissaoCache = [];
        snap.forEach(d=>pagamentosComissaoCache.push({id:d.id,...d.data()}));
        renderPagamentoComissoes();
        if(typeof atualizarCentralAvisos==='function') atualizarCentralAvisos();
    }, e=>console.error('pagamentosComissao:',e));
}

function pad2(n){ return String(n).padStart(2,'0'); }
function toISOLocal(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

// Calcula o período de comissão atual (início/fim/vencimento) de acordo
// com a frequência combinada com aquele barbeiro específico.
// freq: 'semanal' (dia = 0-6, domingo a sábado) | 'quinzenal' (dia = 1-15,
// paga nesse dia e de novo 15 dias depois) | 'mensal' (dia = 1-28).
function periodoComissao(freq, dia){
    const hoje=new Date();
    const y=hoje.getFullYear(), m=hoje.getMonth();
    if(freq==='semanal'){
        const dow=hoje.getDay();
        const inicioD=new Date(y,m,hoje.getDate()-dow);
        const fimD=new Date(inicioD); fimD.setDate(inicioD.getDate()+6);
        const vencD=new Date(inicioD); vencD.setDate(inicioD.getDate()+(Number(dia)||0));
        return {id:'S'+toISOLocal(inicioD), inicio:toISOLocal(inicioD), fim:toISOLocal(fimD), vencimento:vencD, label:`semana de ${inicioD.toLocaleDateString('pt-BR')}`};
    }
    if(freq==='quinzenal'){
        const ultimoDia=new Date(y,m+1,0).getDate();
        const primeira=hoje.getDate()<=15;
        const inicioD=new Date(y,m,primeira?1:16);
        const fimD=new Date(y,m,primeira?15:ultimoDia);
        const diaBase=Math.min(Math.max(Number(dia)||1,1),15);
        const vencDia=primeira?diaBase:Math.min(diaBase+15,ultimoDia);
        const vencD=new Date(y,m,vencDia);
        return {id:`${y}-${pad2(m+1)}-${primeira?'A':'B'}`, inicio:toISOLocal(inicioD), fim:toISOLocal(fimD), vencimento:vencD, label:primeira?'1ª quinzena':'2ª quinzena'};
    }
    // mensal
    const ultimoDia=new Date(y,m+1,0).getDate();
    const inicioD=new Date(y,m,1);
    const fimD=new Date(y,m,ultimoDia);
    const vencD=new Date(y,m,Math.min(Math.max(Number(dia)||1,1),ultimoDia));
    return {id:`${y}-${pad2(m+1)}`, inicio:toISOLocal(inicioD), fim:toISOLocal(fimD), vencimento:vencD, label:'este mês'};
}

// Soma o que um barbeiro específico faturou dentro de um período (data
// no formato YYYY-MM-DD, comparável como texto).
function ganhoNoPeriodo(nome, pct, inicio, fim){
    let total=0, cortes=0;
    concluidosCache.forEach(a=>{
        if((a.barbeiro||'Sem barbeiro')!==nome) return;
        if(!a.data || a.data<inicio || a.data>fim) return;
        total+=Number(a.preco||0); cortes++;
    });
    return {total, cortes, ganho: total*pct/100};
}

const FREQ_LABEL = {semanal:'Semanal', quinzenal:'Quinzenal', mensal:'Mensal'};
const ROTULO_FORMA_PAGAMENTO_COMISSAO = {dinheiro:'Dinheiro', pix:'Pix', transferencia:'Transferência'};

function renderPagamentoComissoes(){
    const cont=$('lista-pagamento-comissoes');
    if(!cont) return;
    if(window.__recepcionista) return;

    const equipe=(barbeiroData.equipe||[]).filter(b=>b.tipo!=='recepcionista');
    if(!equipe.length){
        cont.innerHTML='<div class="empty-state"><div class="icon">💸</div>Cadastre barbeiros com comissão primeiro.</div>';
        return;
    }
    if(!ganhosCarregados){
        cont.innerHTML='<div class="empty-state"><div class="icon">💸</div>Carregando...</div>';
        return;
    }

    const hoje=new Date(); hoje.setHours(0,0,0,0);

    cont.innerHTML = equipe.map(b=>{
        const cfg = comissaoConfigCache[b.id] || {freq:'mensal', dia:5};
        const periodo = periodoComissao(cfg.freq, cfg.dia);
        const dados = ganhoNoPeriodo(b.nome, b.pct||50, periodo.inicio, periodo.fim);
        const valor = dados.ganho;
        const pago = pagamentosComissaoCache.find(p=>p.equipeId===b.id && p.periodo===periodo.id);
        const venceu = periodo.vencimento<=hoje;
        const atrasado = !pago && venceu && valor>0;
        const corBorda = pago ? 'var(--green)' : atrasado ? 'var(--red)' : 'var(--border)';

        const diaSemanaOpts = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
            .map((n,i)=>`<option value="${i}" ${cfg.freq==='semanal'&&Number(cfg.dia)===i?'selected':''}>${n}</option>`).join('');

        return `<div class="ganho-card" style="border-color:${corBorda};flex-direction:column;align-items:stretch;gap:.6rem">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                    <span class="ganho-nome">✂️ ${escapeHtml(b.nome)}</span>
                    ${pago
                        ? `<span style="font-size:.65rem;background:rgba(0,255,136,.12);color:var(--green);border:1px solid rgba(0,255,136,.3);border-radius:20px;padding:.1rem .5rem">✓ Pago em ${new Date(pago.pagoEm).toLocaleDateString('pt-BR')}</span>`
                        : atrasado
                            ? `<span style="font-size:.65rem;background:rgba(255,75,43,.12);color:var(--red);border:1px solid rgba(255,75,43,.3);border-radius:20px;padding:.1rem .5rem">⚠️ Pendente</span>`
                            : `<span style="font-size:.65rem;background:rgba(245,166,35,.1);color:var(--yellow);border:1px solid rgba(245,166,35,.3);border-radius:20px;padding:.1rem .5rem">Ainda não pago</span>`}
                </div>
                ${pago
                    ? `<button class="btn-edit" style="padding:.3rem .7rem;font-size:.72rem" data-desmarcar-pago="${pago.id}">Desmarcar</button>`
                    : `<div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                        <select data-forma-pagamento-comissao="${b.id}" style="background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:.35rem .5rem;color:var(--text);font-size:.72rem;outline:none">
                            <option value="dinheiro">💵 Dinheiro</option>
                            <option value="pix" selected>🔑 Pix</option>
                            <option value="transferencia">🏦 Transferência</option>
                        </select>
                        <button class="btn-save" style="padding:.3rem .7rem;font-size:.72rem" data-marcar-pago="${b.id}" data-nome="${escAttr(b.nome)}" data-valor="${valor}" data-periodo="${periodo.id}" data-periodo-label="${escAttr(periodo.label)}">✓ Marcar como pago</button>
                       </div>`}
            </div>
            <div style="font-size:.85rem;color:var(--muted)">Comissão ${periodo.label} (vence ${periodo.vencimento.toLocaleDateString('pt-BR')}): <strong style="color:var(--text)">R$${valor.toFixed(2)}</strong>${pago&&pago.formaPagamento?` · ${ROTULO_FORMA_PAGAMENTO_COMISSAO[pago.formaPagamento]||pago.formaPagamento}`:''}</div>

            <div style="display:flex;align-items:flex-end;gap:.5rem;flex-wrap:wrap;padding-top:.4rem;border-top:1px dashed var(--border)">
                <div class="input-group" style="margin-bottom:0;min-width:110px">
                    <label style="font-size:.68rem">Frequência</label>
                    <select data-freq-comissao="${b.id}" style="background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:.4rem .5rem;color:var(--text);font-size:.8rem;outline:none;width:100%">
                        <option value="semanal" ${cfg.freq==='semanal'?'selected':''}>Semanal</option>
                        <option value="quinzenal" ${cfg.freq==='quinzenal'?'selected':''}>Quinzenal</option>
                        <option value="mensal" ${cfg.freq==='mensal'?'selected':''}>Mensal</option>
                    </select>
                </div>
                <div class="input-group" style="margin-bottom:0;max-width:130px" data-dia-wrap="${b.id}">
                    ${cfg.freq==='semanal'
                        ? `<label style="font-size:.68rem">Dia da semana</label><select data-dia-comissao="${b.id}" style="background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:.4rem .5rem;color:var(--text);font-size:.8rem;outline:none;width:100%">${diaSemanaOpts}</select>`
                        : `<label style="font-size:.68rem">${cfg.freq==='quinzenal'?'Dia base (1-15)':'Dia do mês'}</label><input type="number" data-dia-comissao="${b.id}" value="${cfg.dia}" min="1" max="${cfg.freq==='quinzenal'?15:28}" step="1" style="background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:.4rem .5rem;color:var(--text);font-size:.8rem;outline:none;width:100%">`}
                </div>
                <button class="btn-save" style="padding:.4rem .7rem;font-size:.72rem" data-salvar-freq="${b.id}">Salvar</button>
            </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('[data-freq-comissao]').forEach(sel=>{
        sel.addEventListener('change', ()=>{
            const id=sel.dataset.freqComissao;
            const cfgAtual=comissaoConfigCache[id]||{freq:'mensal',dia:5};
            comissaoConfigCache[id]={...cfgAtual, freq:sel.value};
            renderPagamentoComissoes();
        });
    });

    cont.querySelectorAll('[data-salvar-freq]').forEach(btn=>{
        btn.addEventListener('click', async()=>{
            const id=btn.dataset.salvarFreq;
            const freqSel=cont.querySelector(`[data-freq-comissao="${id}"]`);
            const diaEl=cont.querySelector(`[data-dia-comissao="${id}"]`);
            const freq=freqSel?freqSel.value:'mensal';
            let dia=parseInt(diaEl?diaEl.value:5);
            if(isNaN(dia)) dia = freq==='semanal'?0:5;
            if(freq==='semanal') dia=Math.min(Math.max(dia,0),6);
            else if(freq==='quinzenal') dia=Math.min(Math.max(dia,1),15);
            else dia=Math.min(Math.max(dia,1),28);
            const membro=equipe.find(b=>b.id===id);
            await setDoc(doc(db,'barbeiros',barbeiroData.uid,'comissoes',id),{pct:membro?.pct||50, freqComissao:freq, diaComissao:dia},{merge:true});
            comissaoConfigCache[id]={freq,dia};
            toast(`✓ Combinado de pagamento de ${membro?.nome||'barbeiro'} salvo`);
            renderPagamentoComissoes();
        });
    });

    cont.querySelectorAll('[data-marcar-pago]').forEach(btn=>{
        btn.addEventListener('click', async()=>{
            const equipeId=btn.dataset.marcarPago;
            const nome=btn.dataset.nome;
            const valor=Number(btn.dataset.valor);
            const periodo=btn.dataset.periodo;
            const periodoLabel=btn.dataset.periodoLabel;
            const formaSel=cont.querySelector(`[data-forma-pagamento-comissao="${equipeId}"]`);
            const formaPagamento=formaSel?formaSel.value:'pix';
            // Dupla confirmação: essa ação já causou marcação sem querer antes.
            if(!confirm(`Marcar a comissão de ${nome} (R$${valor.toFixed(2)}) como paga?`)) return;
            if(!confirm(`Confirma mesmo? Você já pagou R$${valor.toFixed(2)} pra ${nome} agora, via ${ROTULO_FORMA_PAGAMENTO_COMISSAO[formaPagamento]}?`)) return;
            await addDoc(collection(db,'barbeiros',barbeiroData.uid,'pagamentosComissao'), {
                equipeId, nome, periodo, valor, formaPagamento, pagoEm:new Date().toISOString()
            });
            toast(`✓ Comissão de ${nome} marcada como paga`);
            const membro=equipe.find(b=>b.id===equipeId);
            if(typeof abrirComprovanteComissao==='function') abrirComprovanteComissao(membro||{nome}, valor, periodoLabel, formaPagamento);
        });
    });
    cont.querySelectorAll('[data-desmarcar-pago]').forEach(btn=>{
        btn.addEventListener('click', async()=>{
            if(!confirm('Desmarcar esse pagamento como pago?')) return;
            await deleteDoc(doc(db,'barbeiros',barbeiroData.uid,'pagamentosComissao',btn.dataset.desmarcarPago));
            toast('Pagamento desmarcado');
        });
    });
}


// ── GALERIA DE FOTOS GITHUB — DINÂMICA ──
// Leitura defensiva: se config.js não tiver carregado por qualquer motivo,
// isso não trava o resto do arquivo — só a galeria de fotos fica indisponível.
const GITHUB_BASE = (typeof PROB_CONFIG!=='undefined' && PROB_CONFIG.sistema) ? PROB_CONFIG.sistema.githubFotos : null;
const GITHUB_API  = (typeof PROB_CONFIG!=='undefined' && PROB_CONFIG.sistema) ? PROB_CONFIG.sistema.githubApi : null;

let galeriaFotoSelecionada = null;
let catalogoCache = null;

function urlFoto(arquivo){
    return GITHUB_BASE + encodeURIComponent(arquivo);
}

function nomeAmigavel(arquivo){
    return arquivo
        .replace(/[.](png|jpg|jpeg|webp)$/i,'')
        .replace(/^(corte|barba|sobrancelha)-/,'')
        .replace(/-/g,' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

async function buscarCatalogoGithub(){
    if(catalogoCache) return catalogoCache;
    try{
        const resp = await fetch(GITHUB_API);
        if(!resp.ok) throw new Error('HTTP '+resp.status);
        const lista = await resp.json();
        catalogoCache = lista
            .filter(f => /[.](png|jpg|jpeg|webp)$/i.test(f.name))
            .map(f => ({arquivo:f.name, nome:nomeAmigavel(f.name), url:urlFoto(f.name)}));
        return catalogoCache;
    }catch(e){
        console.warn('Galeria GitHub erro:',e);
        return [];
    }
}

async function renderGaleria(){
    const grid = document.getElementById('galeria-grid');
    if(!grid) return;

    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted);font-size:.82rem"><div style="font-size:1.5rem;margin-bottom:.5rem">⏳</div>Carregando fotos...</div>`;

    const fotos = await buscarCatalogoGithub();

    if(!fotos.length){
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted);font-size:.82rem">Nenhuma foto encontrada no repositório.</div>`;
        return;
    }

    const semFotoHtml = `<div class="galeria-sem-foto" id="galeria-sem-foto"><span style="font-size:1.4rem">🚫</span><span>Sem foto</span></div>`;

    grid.innerHTML = semFotoHtml + fotos.map((f,i) => `
        <div class="galeria-item ${galeriaFotoSelecionada && galeriaFotoSelecionada.arquivo===f.arquivo?'selecionado':''}"
             data-idx="${i}" data-arquivo="${f.arquivo}" data-nome="${f.nome}">
            <img src="${f.url}" alt="${f.nome}" loading="lazy" onerror="this.parentElement.style.display='none'">
            <div class="galeria-item-nome">${f.nome}</div>
            <div class="galeria-item-check">✓</div>
        </div>`).join('');

    grid.querySelectorAll('.galeria-item').forEach(item => {
        item.addEventListener('click', () => {
            grid.querySelectorAll('.galeria-item').forEach(i => i.classList.remove('selecionado'));
            item.classList.add('selecionado');
            galeriaFotoSelecionada = fotos[Number(item.dataset.idx)];
        });
    });

    document.getElementById('galeria-sem-foto').addEventListener('click', () => {
        grid.querySelectorAll('.galeria-item').forEach(i => i.classList.remove('selecionado'));
        galeriaFotoSelecionada = null;
    });
}
function abrirGaleria(){
    // Preserva URL atual se já tem foto escolhida
    const fotoAtual = document.getElementById('corte-foto').value;
    if(!fotoAtual) galeriaFotoSelecionada = null;
    // Se catálogo já foi carregado, tenta restaurar a seleção pelo arquivo
    if(fotoAtual && catalogoCache){
        const achou = catalogoCache.find(f => f.url === fotoAtual);
        galeriaFotoSelecionada = achou || {arquivo:'', nome:'', url:fotoAtual};
    }
    renderGaleria();
    document.getElementById('modal-galeria').style.display = 'flex';
}

function fecharGaleria(){
    document.getElementById('modal-galeria').style.display = 'none';
}

function aplicarFotoEscolhida(){
    if(editGaleriaAberta){
        // Veio do modal de edição
        editGaleriaAberta = false;
        const prevWrap = document.getElementById('edit-foto-preview-wrap');
        const prevImg  = document.getElementById('edit-foto-preview-img');
        const prevLbl  = document.getElementById('edit-foto-preview-label');
        const btnRem   = document.getElementById('edit-btn-remove-foto');
        if(galeriaFotoSelecionada){
            document.getElementById('edit-foto').value = galeriaFotoSelecionada.url;
            prevImg.src = galeriaFotoSelecionada.url;
            prevLbl.textContent = '📷 ' + galeriaFotoSelecionada.nome;
            prevWrap.style.display = 'block';
            btnRem.style.display = 'inline-block';
        } else {
            document.getElementById('edit-foto').value = '';
            prevWrap.style.display = 'none';
            btnRem.style.display = 'none';
        }
    } else {
        // Veio do formulário de adicionar novo serviço
        const inputFoto  = document.getElementById('corte-foto');
        const preview    = document.getElementById('foto-preview-wrap');
        const previewImg = document.getElementById('foto-preview-img');
        const previewLbl = document.getElementById('foto-preview-label');
        if(galeriaFotoSelecionada){
            inputFoto.value        = galeriaFotoSelecionada.url;
            previewImg.src         = galeriaFotoSelecionada.url;
            previewLbl.textContent = '📷 ' + galeriaFotoSelecionada.nome;
            preview.style.display  = 'block';
        } else {
            inputFoto.value       = '';
            preview.style.display = 'none';
        }
    }
    fecharGaleria();
}

// Event listeners da galeria — chamados por initEquipeExtras2(), veja
// a chamada no barbeiro.html.
function initEquipeExtras2(){
document.getElementById('btn-abrir-galeria').addEventListener('click', abrirGaleria);
document.getElementById('galeria-btn-cancelar').addEventListener('click', fecharGaleria);
document.getElementById('galeria-btn-refresh').addEventListener('click', ()=>{
    catalogoCache = null; // limpa cache
    renderGaleria();
});
document.getElementById('galeria-btn-confirmar').addEventListener('click', aplicarFotoEscolhida);
document.getElementById('foto-preview-remover').addEventListener('click', ()=>{
    document.getElementById('corte-foto').value = '';
    document.getElementById('foto-preview-wrap').style.display = 'none';
    galeriaFotoSelecionada = null;
});

// Fecha modal clicando fora
document.getElementById('modal-galeria').addEventListener('click', e => {
    if(e.target === document.getElementById('modal-galeria')) fecharGaleria();
});
}

// ── EDITAR CORTE ──
let editGaleriaAberta = false;

function abrirEditarCorte(idx){
    const c = barbeiroData.cortes[idx];
    if(!c) return;
    document.getElementById('edit-idx').value   = idx;
    document.getElementById('edit-nome').value  = c.nome||'';
    document.getElementById('edit-preco').value = c.preco||'';
    document.getElementById('edit-duracao').value = c.duracao||'';
    document.getElementById('edit-obs').value   = c.obs||'';
    document.getElementById('edit-foto').value  = c.foto||'';

    const prevWrap = document.getElementById('edit-foto-preview-wrap');
    const prevImg  = document.getElementById('edit-foto-preview-img');
    const prevLbl  = document.getElementById('edit-foto-preview-label');
    const btnRem   = document.getElementById('edit-btn-remove-foto');

    if(c.foto){
        prevImg.src = c.foto;
        prevLbl.textContent = '📷 Foto atual';
        prevWrap.style.display = 'block';
        btnRem.style.display = 'inline-block';
    } else {
        prevWrap.style.display = 'none';
        btnRem.style.display = 'none';
    }

    document.getElementById('modal-editar-corte').style.display = 'flex';
}

function fecharEditarCorte(){
    document.getElementById('modal-editar-corte').style.display = 'none';
}

document.getElementById('edit-btn-cancelar').addEventListener('click', fecharEditarCorte);
document.getElementById('modal-editar-corte').addEventListener('click', e=>{
    if(e.target === document.getElementById('modal-editar-corte')) fecharEditarCorte();
});

// Botão escolher foto — reaproveita a galeria existente
document.getElementById('edit-btn-foto').addEventListener('click', ()=>{
    editGaleriaAberta = true;
    const fotoAtual = document.getElementById('edit-foto').value;
    if(!fotoAtual) galeriaFotoSelecionada = null;
    else if(catalogoCache){
        const achou = catalogoCache.find(f => f.url === fotoAtual);
        galeriaFotoSelecionada = achou || null;
    }
    renderGaleria();
    document.getElementById('modal-galeria').style.display = 'flex';
});

// Botão remover foto
document.getElementById('edit-btn-remove-foto').addEventListener('click', ()=>{
    document.getElementById('edit-foto').value = '';
    document.getElementById('edit-foto-preview-wrap').style.display = 'none';
    document.getElementById('edit-btn-remove-foto').style.display = 'none';
    galeriaFotoSelecionada = null;
});

// flag editGaleriaAberta é verificada dentro de aplicarFotoEscolhida abaixo

// Salvar edição
document.getElementById('edit-btn-salvar').addEventListener('click', async()=>{
    const idx   = Number(document.getElementById('edit-idx').value);
    const nome  = document.getElementById('edit-nome').value.trim();
    const preco = parseFloat(document.getElementById('edit-preco').value);
    const duracao = parseInt(document.getElementById('edit-duracao').value)||30;
    const obs   = document.getElementById('edit-obs').value.trim();
    const foto  = document.getElementById('edit-foto').value.trim();

    if(!nome||isNaN(preco)||preco<0){ toast('Preencha nome e preço','var(--red)'); return; }

    const btn = document.getElementById('edit-btn-salvar');
    btn.textContent = 'Salvando...'; btn.disabled = true;

    barbeiroData.cortes[idx] = {
        ...barbeiroData.cortes[idx],
        nome, preco, duracao, obs, foto
    };

    await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{cortes:barbeiroData.cortes});
    fecharEditarCorte();
    renderCortes();
    toast('Serviço atualizado! ✓');
    btn.textContent = '💾 Salvar alterações'; btn.disabled = false;
});



// ══════════════════════════════════════════════════════════
// SISTEMA DE CATEGORIAS DE CORTE — parte de equipe.js
//
// Esse pedaço ficou perdido no barbeiro.html por um tempo (documentado no
// docs/README.md) e foi finalmente movido pra cá, onde sempre pertenceu
// tematicamente. Usa as mesmas pontes que o resto deste arquivo, mais
// renderCortes() e galeriaFotoSelecionada, que já existem aqui em cima.
// O clique só é ligado depois, por initCategoriaExtras() — chamada pelo
// módulo principal.
// ══════════════════════════════════════════════════════════

// ── SISTEMA DE CATEGORIAS ──
function removerCategoria(sessao){
    // Conta quantos servicos usam essa categoria
    const cortes=barbeiroData.cortes||[];
    const qtd=cortes.filter(c=>(c.sessao||'Geral')===sessao).length;
    const msg=qtd>0
        ? `Remover a categoria "${sessao}" e seus ${qtd} serviço(s) vinculado(s)?`
        : `Remover a categoria "${sessao}"?`;
    if(!confirm(msg)) return;
    // Remove servicos da categoria
    if(qtd>0){
        barbeiroData.cortes=cortes.filter(c=>(c.sessao||'Geral')!==sessao);
        updateDoc(doc(db,'barbeiros',barbeiroData.uid),{cortes:barbeiroData.cortes})
            .then(()=>renderCortes());
    }
    // Limpa seleção se era a categoria removida
    if(document.getElementById('corte-sessao').value===sessao){
        document.getElementById('corte-sessao').value='';
        document.getElementById('sessao-selecionada-label').textContent='Nenhuma categoria selecionada';
        document.getElementById('sessao-selecionada-label').style.color='var(--muted)';
    }
    // Remove o botão do DOM imediatamente
    const btnWrap=document.getElementById('sessao-btns');
    btnWrap.querySelectorAll('.sessao-btn').forEach(b=>{
        if(b.dataset.sessao===sessao) b.remove();
    });
}

function initSessaoBtns(){
    // Preserva a categoria atualmente selecionada antes de recriar os listeners
    const sessaoAtual=document.getElementById('corte-sessao').value;
    const btns=document.querySelectorAll('.sessao-btn');
    btns.forEach(btn=>{
        const novo=btn.cloneNode(true);
        btn.parentNode.replaceChild(novo,btn);
        // Restaura o estilo do botao que estava selecionado
        if(sessaoAtual&&novo.dataset.sessao===sessaoAtual){
            novo.style.background='rgba(0,212,255,.12)';
            novo.style.borderColor='var(--blue)';
            novo.style.color='var(--blue)';
        }
        // Garante que o span x existe no botao clonado
        if(!novo.querySelector('.sessao-btn-x')){
            const x=document.createElement('span');
            x.className='sessao-btn-x';
            x.title='Remover categoria';
            x.textContent='✕';
            novo.appendChild(x);
        }
        // Clique no x — remove categoria
        novo.querySelector('.sessao-btn-x').addEventListener('click',(e)=>{
            e.stopPropagation();
            removerCategoria(novo.dataset.sessao);
        });
        // Clique no botao — seleciona categoria
        novo.addEventListener('click',(e)=>{
            if(e.target.classList.contains('sessao-btn-x')) return;
            document.querySelectorAll('.sessao-btn').forEach(b=>{
                b.style.background='transparent';
                b.style.borderColor='var(--border)';
                b.style.color='var(--muted)';
            });
            novo.style.background='rgba(0,212,255,.12)';
            novo.style.borderColor='var(--blue)';
            novo.style.color='var(--blue)';
            document.getElementById('corte-sessao').value=novo.dataset.sessao;
            document.getElementById('sessao-selecionada-label').textContent='Categoria: '+novo.dataset.sessao;
            document.getElementById('sessao-selecionada-label').style.color='var(--blue)';
        });
    });
}

// Botão "Nova categoria" — chamado por initCategoriaExtras(), depois que
// window.$ e companhia já estão prontos.
function initCategoriaExtras(){
document.getElementById('btn-nova-categoria').addEventListener('click',()=>{
    const wrap=document.getElementById('nova-categoria-wrap');
    const visivel=wrap.style.display==='block';
    wrap.style.display=visivel?'none':'block';
    if(!visivel) document.getElementById('nova-categoria-input').focus();
});

document.getElementById('btn-confirmar-categoria').addEventListener('click',()=>{
    const val=document.getElementById('nova-categoria-input').value.trim();
    if(!val){toast('Digite um nome para a categoria','var(--red)');return;}
    const btnWrap=document.getElementById('sessao-btns');
    const btnNovaCat=document.getElementById('btn-nova-categoria');
    // Evita duplicata
    const jaExiste=[...btnWrap.querySelectorAll('.sessao-btn')].some(b=>b.dataset.sessao===val);
    if(!jaExiste){
        const b=document.createElement('button');
        b.type='button';
        b.className='sessao-btn sessao-btn-custom';
        b.dataset.sessao=val;
        b.textContent='🏷️ '+val;
        b.style.cssText='padding:.45rem .9rem;border-radius:20px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-size:.8rem;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:.3rem';
        btnWrap.insertBefore(b,btnNovaCat);
    }
    initSessaoBtns();
    // Seleciona automaticamente a nova categoria
    const novoBtn=btnWrap.querySelector(`.sessao-btn[data-sessao="${val}"]`);
    if(novoBtn) novoBtn.click();
    document.getElementById('nova-categoria-input').value='';
    document.getElementById('nova-categoria-wrap').style.display='none';
});

document.getElementById('btn-cancelar-categoria').addEventListener('click',()=>{
    document.getElementById('nova-categoria-wrap').style.display='none';
    document.getElementById('nova-categoria-input').value='';
});

document.getElementById('nova-categoria-input').addEventListener('keydown',(e)=>{
    if(e.key==='Enter') document.getElementById('btn-confirmar-categoria').click();
    if(e.key==='Escape') document.getElementById('btn-cancelar-categoria').click();
});

// Inicializa os botões fixos na primeira carga
initSessaoBtns();

$('btn-add-corte').addEventListener('click',async()=>{
    const nome=$('corte-nome').value.trim();const preco=parseFloat($('corte-preco').value);
    const duracao=parseInt($('corte-duracao').value)||30;
    const obs=$('corte-obs').value.trim();
    const sessao=$('corte-sessao').value.trim();
    const foto=$('corte-foto').value.trim();
    if(!nome||isNaN(preco)||preco<0){toast('Preencha nome e preço','var(--red)');return;}
    if(!sessao){toast('Selecione uma categoria','var(--red)');return;}
    barbeiroData.cortes=barbeiroData.cortes||[];
    barbeiroData.cortes.push({id:Date.now().toString(),nome,preco,duracao,obs,sessao,foto});
    await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{cortes:barbeiroData.cortes});
    $('corte-nome').value='';$('corte-preco').value='';$('corte-duracao').value='';$('corte-obs').value='';
    $('corte-foto').value='';
    document.getElementById('foto-preview-wrap').style.display='none';
    galeriaFotoSelecionada=null;
    // Mantém categoria selecionada para facilitar adicionar vários serviços da mesma categoria
    renderCortes();toast('Serviço adicionado!');
});
}

// ══════════════════════════════════════════════════════════
// COMPROVANTE DE PAGAMENTO DE COMISSÃO — mesmo padrão visual do
// comprovante de cliente (agendamentos.js), adaptado pra confirmar pro
// barbeiro/recepcionista que a comissão dele foi paga e o valor certo.
// ══════════════════════════════════════════════════════════
function montarComprovanteComissaoPdfBlob({ nomeBarbearia, barbeiro, periodoLabel, valor, formaPagamento }){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a5' });
    const W = 148;
    const agora = new Date().toLocaleString('pt-BR');

    const bg = [10,14,20];
    const azul = [0,212,255];
    const azulClaro = [130,230,255];
    const verde = [0,255,136];
    const textoClaro = [232,244,248];
    const cinza = [122,159,181];

    doc.setFillColor(...bg);
    doc.rect(0, 0, W, 40, 'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(22);
    doc.setTextColor(...azul);
    doc.text("PRO'B", W/2, 18, { align:'center' });
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(...azulClaro);
    doc.text(nomeBarbearia, W/2, 25, { align:'center', maxWidth: W-40 });
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.6);
    doc.line(30, 30, W-30, 30);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.setTextColor(...azul);
    doc.text('COMPROVANTE DE PAGAMENTO DE COMISSÃO', W/2, 36, { align:'center', maxWidth: W-30 });

    doc.setFont('helvetica','bold');
    doc.setFontSize(8.5);
    const avisoTexto = 'ATENÇÃO: ESTE DOCUMENTO NÃO É CUPOM FISCAL NEM NOTA FISCAL';
    const avisoLinhas = doc.splitTextToSize(avisoTexto, W-40);
    const avisoAltura = 8 + avisoLinhas.length*4.2;
    doc.setFillColor(40,16,14);
    doc.roundedRect(14, 46, W-28, avisoAltura, 2, 2, 'F');
    doc.setTextColor(255,110,90);
    doc.text(avisoLinhas, W/2, 46+5.5, { align:'center', lineHeightFactor:1.3 });

    const caixa = (x,y,w,h,rotulo,valorTexto,opts={}) => {
        doc.setFillColor(18,22,28);
        doc.setDrawColor(42,63,95);
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
    caixa(14, y, (W-28-4)/2, 20, 'Data do pagamento', agora);
    caixa(14+(W-28-4)/2+4, y, (W-28-4)/2, 20, 'Forma de pagamento', ROTULO_FORMA_PAGAMENTO_COMISSAO[formaPagamento]||formaPagamento||'Não informado');
    y += 26;
    caixa(14, y, W-28, 18, 'Barbeiro/Equipe', barbeiro || 'Não informado');
    y += 24;
    caixa(14, y, W-28, 18, 'Período', periodoLabel || '—');
    y += 24;

    doc.setFillColor(...bg);
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, W-28, 22, 2, 2, 'FD');
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(...cinza);
    doc.text('VALOR PAGO', 20, y+8);
    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.setTextColor(...verde);
    doc.text(`R$ ${Number(valor).toFixed(2)}`, W-20, y+16, { align:'right' });
    y += 30;

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

function abrirComprovanteComissao(membro, valor, periodoLabel, formaPagamento){
    if(typeof window.jspdf === 'undefined') return; // biblioteca ainda carregando — sem comprovante dessa vez
    const modal = $('modal-comprovante');
    if(!modal) return;
    const blob = montarComprovanteComissaoPdfBlob({
        nomeBarbearia: barbeiroData.nome || 'Barbearia',
        barbeiro: membro.nome,
        periodoLabel,
        valor,
        formaPagamento
    });
    comprovanteAtual = { blob, clienteWhatsapp: membro.wpp||'', nomeArquivo: `comissao-${(membro.nome||'barbeiro').replace(/\s+/g,'_')}-${Date.now()}.pdf` };
    modal.style.display = 'flex';
}
