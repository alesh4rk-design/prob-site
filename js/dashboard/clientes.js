// ══════════════════════════════════════════════════════════
// CLIENTES — clientes.js
//
// Script comum (não é módulo ES). Usa window.$, window.escapeHtml,
// window.escAttr, window.toast, window.barbeiroData, window.todosClientes
// e as funções do Firestore, disponibilizadas pelo módulo principal.
// Os cliques da tela só são ligados depois, por initClientesExtras() e
// initClientesExtras2() — chamadas pelo módulo principal. Ver docs/README.md.
// ══════════════════════════════════════════════════════════

async function carregarClientes(){
    try{
        const snap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,'clientes'));
        todosClientes = [];
        snap.forEach(d => todosClientes.push({id:d.id,...d.data()}));
        todosClientes.sort((a,b) => (b.totalCortes||0)-(a.totalCortes||0));
        renderClientes(todosClientes);
    }catch(e){ console.error('carregarClientes:',e); }
    initAddCliente();
}

// Adiciona um cliente à base manualmente, sem precisar esperar um corte.
// Usa a mesma "chave" (whatsapp limpo) que o resto do sistema já usa, então
// se esse cliente já existir, só atualiza — não duplica.
async function salvarClienteManual(nome, wppBruto){
    const wpp = (wppBruto||'').replace(/\D/g,'');
    if(!nome){ toast('Digite o nome do cliente','var(--red)'); return false; }
    const chave = wpp || ('semtel_' + nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'_'));
    try{
        const ref = doc(db,'barbeiros',barbeiroData.uid,'clientes',chave);
        const existe = await getDoc(ref);
        await setDoc(ref, {
            nome,
            wpp,
            totalCortes: existe.exists() ? (existe.data().totalCortes||0) : 0,
        }, {merge:true});
        return true;
    }catch(e){ console.error('salvarClienteManual:',e); toast('Erro ao adicionar: '+e.message,'var(--red)'); return false; }
}

function initAddCliente(){
    if(window.__addClienteBound) return;
    window.__addClienteBound = true;

    $('btn-add-cliente').addEventListener('click', async()=>{
        const nome = $('cli-add-nome').value.trim();
        const wpp = $('cli-add-wpp').value.trim();
        const btn = $('btn-add-cliente');
        btn.disabled = true;
        const ok = await salvarClienteManual(nome, wpp);
        if(ok){
            toast('✓ Cliente adicionado!');
            $('cli-add-nome').value=''; $('cli-add-wpp').value='';
            carregarClientes();
        }
        btn.disabled = false;
    });

    // Importar da lista telefônica — só existe em alguns navegadores
    // (principalmente Chrome no Android). Nos outros, o botão nem aparece.
    if('contacts' in navigator && 'ContactsManager' in window){
        const btnImportar = $('btn-importar-contatos');
        btnImportar.style.display = 'block';
        btnImportar.addEventListener('click', async()=>{
            try{
                const contatos = await navigator.contacts.select(['name','tel'], {multiple:true});
                if(!contatos.length) return;
                btnImportar.disabled = true;
                btnImportar.textContent = 'Importando...';
                let importados = 0;
                for(const c of contatos){
                    const nome = (c.name && c.name[0]) || 'Sem nome';
                    const tel = (c.tel && c.tel[0]) || '';
                    if(await salvarClienteManual(nome, tel)) importados++;
                }
                toast(`✓ ${importados} contato(s) importado(s)!`);
                carregarClientes();
            }catch(e){
                if(e.name!=='AbortError') toast('Não deu para acessar os contatos: '+e.message,'var(--red)');
            }
            btnImportar.disabled = false;
            btnImportar.textContent = '📱 Importar dos Contatos';
        });
    } else {
        $('cli-importar-aviso').style.display = 'block';
        $('cli-importar-aviso').textContent = 'ℹ️ Importar da lista telefônica funciona só em alguns celulares Android (Chrome). Nesse aparelho, cadastre manualmente aí em cima.';
    }
}

// Classifica o cliente pelo tempo sem aparecer — usado para cor do card e para o aviso
function nivelAusencia(dias){
    if(dias>=30) return {cor:'255,75,43',  label:'⚠️ Ausente há '+dias+' dias',        peso:4};
    if(dias>=15) return {cor:'255,140,66', label:dias+' dias sem retornar',    peso:3};
    if(dias>=10) return {cor:'245,166,35', label:'🕐 '+dias+' dias sem retornar',    peso:2};
    if(dias>=5)  return {cor:'148,163,184',label:dias+' dias sem retornar',          peso:1};
    return null;
}

function renderClientes(lista){
    // Datalist de autocomplete (usado na Venda Rápida do Estoque)
    const dl = document.getElementById('lista-clientes-datalist');
    if(dl) dl.innerHTML = todosClientes.map(c=>`<option value="${escAttr(c.nome||'')}">`).join('');

    // Select de cliente da Promoção Individual — toda promoção individual
    // precisa estar vinculada a um cliente de verdade da base.
    const selPromo = document.getElementById('promo-i-cliente-select');
    if(selPromo){
        const selecionado = selPromo.value;
        selPromo.innerHTML = '<option value="">Selecione um cliente da sua base...</option>' +
            todosClientes.map(c=>`<option value="${escAttr(c.wpp||'')}">${escapeHtml(c.nome||c.wpp||'Sem nome')}</option>`).join('');
        if(selecionado) selPromo.value = selecionado;
    }

    // Select de cliente do Acordo — mesmo padrão do de cima.
    const selAcordo = document.getElementById('acordo-cliente-select');
    if(selAcordo){
        const selecionado = selAcordo.value;
        selAcordo.innerHTML = '<option value="">Selecione um cliente da sua base...</option>' +
            todosClientes.map(c=>`<option value="${escAttr(c.wpp||'')}">${escapeHtml(c.nome||c.wpp||'Sem nome')}</option>`).join('');
        if(selecionado) selAcordo.value = selecionado;
    }

    // KPIs
    document.getElementById('cli-kpi-total').textContent = lista.length;
    document.getElementById('cli-kpi-recorrentes').textContent = lista.filter(c=>c.totalCortes>1).length;
    document.getElementById('cli-kpi-cortes').textContent = lista.reduce((s,c)=>s+(c.totalCortes||0),0);
    document.getElementById('cli-kpi-atencao').textContent = lista.filter(c=>{
        const d = c.ultimaVisita ? Math.floor((new Date()-new Date(c.ultimaVisita))/(1000*60*60*24)) : 999;
        return d>=5;
    }).length;

    const cont = document.getElementById('lista-clientes-barb');
    if(!lista.length){ cont.innerHTML='<div class="empty-state"><div class="icon">👥</div>Nenhum cliente ainda.</div>'; return; }

    cont.innerHTML = lista.map(c=>{
        const ultimaVisita = c.ultimaVisita ? new Date(c.ultimaVisita).toLocaleDateString('pt-BR') : '—';
        const favorito = c.cortesFavoritos ? Object.entries(c.cortesFavoritos).sort((a,b)=>b[1]-a[1])[0]?.[0] : '—';
        const wppNum = (c.wpp||'').replace(/\D/g,'');
        const freq = c.totalCortes > 10 ? '🔥 VIP' : c.totalCortes > 5 ? '⭐ Frequente' : c.totalCortes > 1 ? '✅ Recorrente' : '🆕 Novo';
        const diasDesde = c.ultimaVisita ? Math.floor((new Date()-new Date(c.ultimaVisita))/(1000*60*60*24)) : 999;
        const ausencia = nivelAusencia(diasDesde);
        const alertaSumiu = ausencia ? `<span style="color:rgb(${ausencia.cor});font-size:.68rem">${ausencia.label}</span>` : '';

        // Cor do card: ausência tem prioridade sobre frequência; senão, novo vs recorrente
        let corBorda = 'var(--border)', corFundo = 'var(--card2)';
        if(ausencia){
            corBorda = `rgba(${ausencia.cor},.45)`; corFundo = `rgba(${ausencia.cor},.05)`;
        } else if(c.totalCortes > 1){
            corBorda = 'rgba(0,255,136,.35)'; corFundo = 'rgba(0,255,136,.04)';
        } else {
            corBorda = 'rgba(0,212,255,.3)'; corFundo = 'rgba(0,212,255,.04)';
        }

        return `<div style="background:${corFundo};border:1px solid ${corBorda};border-radius:10px;padding:.85rem 1rem;margin-bottom:.5rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;cursor:pointer" title="Ver ações do cliente" onclick="abrirAcoesCliente('${escAttr(c.nome||'')}','${escAttr(wppNum)}',null,'','',null)">
            <div style="width:38px;height:38px;border-radius:50%;background:rgba(0,212,255,.12);border:1.5px solid rgba(0,212,255,.3);display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:900;color:var(--blue);flex-shrink:0">${escapeHtml((c.nome||'?')[0].toUpperCase())}</div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:.9rem">${escapeHtml(c.nome||'—')} <span style="font-size:.7rem;font-weight:400;color:var(--muted)">${freq}</span></div>
                <div style="font-size:.72rem;color:var(--muted);margin-top:.15rem">📱 ${escapeHtml(c.wpp||'—')} · ${c.totalCortes||0} cortes · Favorito: ${escapeHtml(favorito)}</div>
                <div style="font-size:.7rem;color:var(--muted);margin-top:.1rem">Última visita: ${ultimaVisita} ${alertaSumiu}</div>
            </div>
        </div>`;
    }).join('');
}

// Busca em tempo real
let filtroAusenciaMin = 0;
function aplicarFiltrosClientes(){
    const q = document.getElementById('cli-busca').value.toLowerCase();
    const filtrado = todosClientes.filter(c=>{
        const bateBusca = (c.nome||'').toLowerCase().includes(q) || (c.wpp||'').includes(q);
        if(!bateBusca) return false;
        if(filtroAusenciaMin===0) return true;
        const dias = c.ultimaVisita ? Math.floor((new Date()-new Date(c.ultimaVisita))/(1000*60*60*24)) : 999;
        return dias >= filtroAusenciaMin;
    });
    renderClientes(filtrado);
}

// Liga a busca de clientes — chamada por initClientesExtras(), depois que
// window.$ e companhia já estão prontos (mesmo motivo do initEquipeExtras).
function initClientesExtras(){
document.getElementById('cli-busca').addEventListener('input', aplicarFiltrosClientes);
}

document.querySelectorAll('.filtro-ausencia-btn').forEach(btn=>{
    btn.addEventListener('click', function(){
        document.querySelectorAll('.filtro-ausencia-btn').forEach(b=>{
            b.classList.remove('active');
            b.style.borderColor='var(--border)'; b.style.background='transparent'; b.style.color='var(--muted)';
        });
        this.classList.add('active');
        this.style.borderColor='var(--blue)'; this.style.background='rgba(0,212,255,.12)'; this.style.color='var(--blue)';
        filtroAusenciaMin = parseInt(this.dataset.min);
        aplicarFiltrosClientes();
    });
});

// Aviso 1h antes — painel de lembretes
async function carregarAvisos1h(){
    const agora = new Date();
    const hoje = agora.toISOString().split('T')[0];
    const agoraMin = agora.getHours()*60 + agora.getMinutes();

    try{
        const snap = await getDocs(query(
            collection(db,'agendamentos'),
            where('barbeiroId','==',barbeiroData.uid),
            where('data','==',hoje),
            where('status','==','pendente')
        ));

        const avisos = [];
        snap.forEach(d=>{
            const ag = d.data();
            const [h,m] = ag.hora.split(':').map(Number);
            const agMin = h*60+m;
            const diff = agMin - agoraMin;
            if(diff > 0 && diff <= 60 && ag.clienteWhatsapp){
                avisos.push({...ag, id:d.id, diff});
            }
        });

        const cont = document.getElementById('avisos-1h-lista');
        const wrap = document.getElementById('avisos-1h-wrap');
        if(!cont||!wrap) return;

        if(!avisos.length){ wrap.style.display='none'; return; }

        wrap.style.display='block';
        document.getElementById('avisos-1h-badge').textContent = avisos.length;
        cont.innerHTML = avisos.map(ag=>{
            const wppNum = ag.clienteWhatsapp.replace(/\D/g,'');
            const msg = encodeURIComponent(`Olá ${ag.clienteNome}! Passando para lembrar do seu horário às ${ag.hora} hoje na ${barbeiroData.nome||'barbearia'}. Te esperamos! ✂️`);
            const jaEnviado = !!ag.avisoEnviado;
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.2);border-radius:8px;gap:.5rem;flex-wrap:wrap">
                <div>
                    <div style="font-size:.82rem;font-weight:700">${escapeHtml(ag.clienteNome)}</div>
                    <div style="font-size:.72rem;color:var(--muted)">⏰ ${ag.hora} · em ${ag.diff}min ${jaEnviado?'· <span style="color:var(--green)">✓ avisado</span>':''}</div>
                </div>
                <a href="https://wa.me/55${wppNum}?text=${msg}" target="_blank" class="btn-wpp aviso-1h-btn" data-id="${ag.id}" style="${jaEnviado?'opacity:.55':''}">${jaEnviado?'↻ Reenviar':'📱 Avisar'}</a>
            </div>`;
        }).join('');

        cont.querySelectorAll('.aviso-1h-btn').forEach(btn=>{
            btn.addEventListener('click',()=>{
                updateDoc(doc(db,'agendamentos',btn.dataset.id),{avisoEnviado:true}).catch(e=>console.error(e));
                btn.style.opacity='.55';
                btn.textContent='↻ Reenviar';
                const meta = btn.closest('div').querySelector('div > div:last-child');
                if(meta && !meta.innerHTML.includes('avisado')){
                    meta.innerHTML += ' · <span style="color:var(--green)">✓ avisado</span>';
                }
            });
        });
    }catch(e){ console.error('avisos1h:',e); }
}

// Verifica avisos a cada 5 minutos — chamada por initClientesExtras2()
function initClientesExtras2(){
setInterval(carregarAvisos1h, 5*60*1000);
}
