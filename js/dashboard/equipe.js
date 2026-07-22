// ══════════════════════════════════════════════════════════
// CORTES, EQUIPE E GANHOS — barbeiro-equipe.js
//
// Script comum (não é módulo ES), mesma lógica dos outros arquivos já
// separados. Usa window.$, window.escapeHtml, window.escAttr,
// window.toast, window.fmtHoje, window.barbeiroData, window.db e as
// funções do Firestore, todos disponibilizados pelo módulo principal.
// ══════════════════════════════════════════════════════════

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
        const infoLinha = ehRecep
            ? `<div style="font-size:.75rem;color:var(--muted);margin-top:.2rem">Organiza agendamentos, fila e clientes</div>`
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
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:barbeiroData.equipe});
            toast(`${barbeiroData.equipe[i].nome}: ${pct}% salvo!`);
            renderEquipe();
            carregarGanhos();
        });
    });
    container.querySelectorAll('[data-trocar-tipo]').forEach(btn=>{
        btn.addEventListener('click',async()=>{
            const i=Number(btn.dataset.trocarTipo);
            const membro=barbeiroData.equipe[i];
            const novoTipo = membro.tipo==='recepcionista' ? 'barbeiro' : 'recepcionista';
            if(!confirm(`Trocar ${membro.nome} para ${novoTipo==='recepcionista'?'Recepcionista':'Barbeiro'}?\n\nNa próxima vez que ela(e) entrar, o menu já vem atualizado sozinho.`)) return;
            barbeiroData.equipe[i].tipo = novoTipo;
            if(novoTipo==='recepcionista') barbeiroData.equipe[i].pct = 0;
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:barbeiroData.equipe});
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
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:barbeiroData.equipe});
            // Revoga o acesso de vez, mesmo que a pessoa já tivesse criado a própria conta
            if(equipeId){
                try{ await deleteDoc(doc(db,'barbeiros',barbeiroData.uid,'equipeAuth',equipeId)); }catch(e){}
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
    $('eq-pct-wrap').style.display=this.value==='recepcionista'?'none':'block';
});

$('btn-add-barbeiro').addEventListener('click',async()=>{
    const nome=$('eq-nome').value.trim();
    const tipo=$('eq-tipo').value;
    const pct=tipo==='recepcionista'?0:(Number($('eq-pct').value)||50);
    if(!nome){toast('Informe o nome','var(--red)');return;}
    barbeiroData.equipe=barbeiroData.equipe||[];
    barbeiroData.equipe.push({id:Date.now().toString(),nome,pct,tipo,criadoEm:new Date().toISOString()});
    await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{equipe:barbeiroData.equipe});
    $('eq-nome').value='';$('eq-pct').value='';
    renderEquipe();carregarGanhos();toast((tipo==='recepcionista'?'Recepcionista':'Barbeiro')+' adicionado!');
});
}

// GANHOS
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

    function renderGanhos(container, lista, titulo){
        if(!lista.length){
            container.innerHTML=`<div class="empty-state"><div class="icon">💰</div>Nenhum corte concluído ${titulo}.</div>`;
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

    renderGanhos($('ganhos-hoje'), concluidos.filter(a=>a.data===hoje), 'hoje');
    renderGanhos($('ganhos-mes'),  concluidos.filter(a=>a.data&&a.data.startsWith(mesAtual)), 'este mês');
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
