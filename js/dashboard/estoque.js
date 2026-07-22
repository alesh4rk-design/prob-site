// ══════════════════════════════════════════════════════════
// ESTOQUE, INSUMOS E ZONA DE PERIGO — barbeiro-estoque.js
//
// Este arquivo é um script comum (não é módulo ES) de propósito — assim
// ele compartilha o mesmo espaço global de sempre com o resto do sistema,
// sem precisar de import/export. As coisas que ele usa do módulo principal
// (Firestore, barbeiroData, toast, etc.) chegam prontas via window.*,
// que é montado logo no início do <script type="module"> do barbeiro.html.
// ══════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════
// ESTOQUE — cadastro de produtos, venda rápida e leitor de
// código de barras (USB/Bluetooth digitam sozinhos; câmera é bônus)
// ══════════════════════════════════════════════════════════
let produtosCache = [];
let unsubProdutos = null;
let vendaProdutoSelecionado = null;
let vendaQtdAtual = 1;

// ══════════════════════════════════════════════════════════
// ZONA DE PERIGO — apagar dados de teste, escolhendo exatamente
// o quê. Sempre com contagem real antes e confirmação por texto.
// ══════════════════════════════════════════════════════════
function refCategoria(categoria){
    switch(categoria){
        case 'agendamentos': return query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid));
        case 'fila':          return query(collection(db,'fila'),where('barbeiroId','==',barbeiroData.uid));
        case 'clientes':      return collection(db,'barbeiros',barbeiroData.uid,'clientes');
        case 'vendas':        return collection(db,'barbeiros',barbeiroData.uid,'vendas');
        case 'fidelidade':    return collection(db,'barbeiros',barbeiroData.uid,'fidelidade');
        case 'promocoes':     return collection(db,'barbeiros',barbeiroData.uid,'promocoes');
    }
}
const ZP_LABELS = {
    agendamentos:'agendamento(s)', fila:'pessoa(s) na fila', clientes:'cliente(s) da base',
    vendas:'venda(s) de produto registrada(s)', fidelidade:'carteirinha(s) de fidelidade', promocoes:'promoção(ões) cadastrada(s)'
};

async function atualizarContagemZonaPerigo(){
    for(const cat of Object.keys(ZP_LABELS)){
        const el = document.getElementById('zp-count-'+cat);
        if(!el) continue;
        try{
            const snap = await getDocs(refCategoria(cat));
            el.textContent = `(${snap.size})`;
        }catch(e){ el.textContent=''; }
    }
}

async function apagarPorLotes(refColOuQuery){
    const snap = await getDocs(refColOuQuery);
    const docs = snap.docs;
    for(let i=0; i<docs.length; i+=450){
        const lote = docs.slice(i, i+450);
        const batch = writeBatch(db);
        lote.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
    return docs.length;
}

function initZonaPerigo(){
    if(window.__zonaPerigoBound) return;
    window.__zonaPerigoBound = true;

    document.querySelectorAll('.zona-perigo-check').forEach(chk=>{
        chk.addEventListener('change', atualizarContagemZonaPerigo);
    });
    atualizarContagemZonaPerigo();

    document.getElementById('btn-abrir-zona-perigo').addEventListener('click', async ()=>{
        const marcados = Array.from(document.querySelectorAll('.zona-perigo-check:checked')).map(c=>c.value);
        if(!marcados.length){ toast('Marque pelo menos uma categoria para apagar','var(--red)'); return; }

        const btn = document.getElementById('btn-abrir-zona-perigo');
        btn.disabled = true; btn.textContent = 'Contando...';
        const resumo = document.getElementById('zp-resumo');
        resumo.innerHTML = '';
        let algumComDados = false;
        for(const cat of marcados){
            const snap = await getDocs(refCategoria(cat));
            if(snap.size > 0) algumComDados = true;
            resumo.innerHTML += `<li><strong style="color:var(--red)">${snap.size}</strong> ${ZP_LABELS[cat]}</li>`;
        }
        btn.disabled = false; btn.textContent = '🗑️ Apagar o que eu marquei';

        if(!algumComDados){ toast('Não tem nada para apagar nas categorias marcadas'); return; }

        document.getElementById('zp-confirma-texto').value = '';
        document.getElementById('btn-confirmar-zona-perigo').disabled = true;
        document.getElementById('btn-confirmar-zona-perigo').style.opacity = '.5';
        document.getElementById('modal-zona-perigo').style.display = 'flex';
        document.getElementById('modal-zona-perigo').dataset.categorias = JSON.stringify(marcados);
    });

    document.getElementById('zp-confirma-texto').addEventListener('input', function(){
        const ok = this.value.trim().toUpperCase() === 'APAGAR';
        const btnConf = document.getElementById('btn-confirmar-zona-perigo');
        btnConf.disabled = !ok;
        btnConf.style.opacity = ok ? '1' : '.5';
    });

    document.getElementById('btn-cancelar-zona-perigo').addEventListener('click', ()=>{
        document.getElementById('modal-zona-perigo').style.display = 'none';
    });

    document.getElementById('btn-confirmar-zona-perigo').addEventListener('click', async ()=>{
        const categorias = JSON.parse(document.getElementById('modal-zona-perigo').dataset.categorias || '[]');
        const btnConf = document.getElementById('btn-confirmar-zona-perigo');
        btnConf.disabled = true;
        let totalApagado = 0;
        for(const cat of categorias){
            btnConf.textContent = 'Apagando ' + ZP_LABELS[cat] + '...';
            try{
                totalApagado += await apagarPorLotes(refCategoria(cat));
            }catch(e){ console.error('Erro ao apagar', cat, e); toast('Erro ao apagar '+cat+': '+e.message, 'var(--red)'); }
        }
        btnConf.textContent = 'Apagar de vez';
        document.getElementById('modal-zona-perigo').style.display = 'none';
        document.querySelectorAll('.zona-perigo-check').forEach(c=>c.checked=false);
        atualizarContagemZonaPerigo();
        toast(`✓ ${totalApagado} registro(s) apagado(s)`);
    });
}

function initEstoque(){
    if(window.__estoqueBound) return;
    window.__estoqueBound = true;

    if(unsubProdutos) unsubProdutos();
    unsubProdutos = onSnapshot(collection(db,'barbeiros',barbeiroData.uid,'produtos'), snap=>{
        produtosCache = [];
        snap.forEach(d=>produtosCache.push({id:d.id,...d.data()}));
        renderProdutos();
        atualizarKpiEstoqueBaixo();
    }, e=>console.error('produtos:',e));

    carregarVendasHoje();

    // Campo de código de barras — Enter (leitor manda Enter sozinho) ou digitação manual
    const inputVenda = $('venda-codigo');
    inputVenda.addEventListener('keydown', e=>{
        if(e.key==='Enter'){ e.preventDefault(); buscarProdutoPorCodigo(inputVenda.value.trim()); }
    });
    $('venda-qtd-menos').addEventListener('click', ()=>{ if(vendaQtdAtual>1){ vendaQtdAtual--; atualizarResumoVenda(); } });
    $('venda-qtd-mais').addEventListener('click', ()=>{
        if(vendaProdutoSelecionado && vendaQtdAtual>=vendaProdutoSelecionado.estoque){ toast('Não tem tanto em estoque assim','var(--red)'); return; }
        vendaQtdAtual++; atualizarResumoVenda();
    });
    $('btn-confirmar-venda').addEventListener('click', confirmarVenda);

    $('btn-add-produto').addEventListener('click', adicionarProduto);

    $('btn-scan-camera').addEventListener('click', ()=>abrirScannerCamera(codigo=>{ $('venda-codigo').value=codigo; buscarProdutoPorCodigo(codigo); }));
    $('btn-scan-camera-cadastro').addEventListener('click', ()=>abrirScannerCamera(codigo=>{ $('prod-codigo').value=codigo; verificarCodigoCadastro(); }));
    $('prod-codigo').addEventListener('input', verificarCodigoCadastro);
    $('prod-codigo').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); verificarCodigoCadastro(); $('prod-estoque').focus(); } });
    $('prod-custo').addEventListener('input', atualizarMargemCadastro);
    $('prod-preco').addEventListener('input', atualizarMargemCadastro);

    initModalVendaCliente();
    initInsumos();
}

// ══════════════════════════════════════════════════════════
// CONTROLE DE INSUMOS — itens de uso interno (café, copo
// descartável, água oxigenada...). Só quantidade, sem preço de
// venda nem código de barras — não é para vender, é para controlar gasto.
// ══════════════════════════════════════════════════════════
let insumosCache = [];
let unsubInsumos = null;

function initInsumos(){
    if(window.__insumosBound) return;
    window.__insumosBound = true;

    if(unsubInsumos) unsubInsumos();
    unsubInsumos = onSnapshot(collection(db,'barbeiros',barbeiroData.uid,'insumos'), snap=>{
        insumosCache = [];
        snap.forEach(d=>insumosCache.push({id:d.id,...d.data()}));
        insumosCache.sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
        renderInsumos();
    }, e=>console.error('insumos:',e));

    $('btn-add-insumo').addEventListener('click', adicionarInsumo);
}

// Registra um gasto com insumo — alimenta o cartão "Gastos com Insumos"
// na aba Gestão da Barbearia (financeiro.js), reduzindo o lucro líquido.
async function registrarGastoInsumo(insumoId, insumoNome, quantidade, custoTotal){
    if(!custoTotal || custoTotal<=0) return; // custo é opcional
    try{
        await addDoc(collection(db,'barbeiros',barbeiroData.uid,'gastosInsumos'), {
            insumoId, insumoNome, quantidade, custoTotal,
            data: fmtHoje(),
            criadoEm: new Date().toISOString()
        });
    }catch(e){ console.error('registrarGastoInsumo:', e); }
}

async function adicionarInsumo(){
    const nome = $('insumo-nome').value.trim();
    const unidade = $('insumo-unidade').value;
    const qtd = parseFloat($('insumo-qtd').value);
    const qtdMinima = $('insumo-qtd-min').value ? parseFloat($('insumo-qtd-min').value) : null;
    const custo = $('insumo-custo').value ? parseFloat($('insumo-custo').value) : null;
    if(!nome){ toast('Digite o nome do insumo','var(--red)'); return; }
    if(isNaN(qtd) || qtd<0){ toast('Informe a quantidade','var(--red)'); return; }

    const btn = $('btn-add-insumo');
    btn.disabled = true;

    // Já existe um insumo com esse nome? Soma na quantidade em vez de duplicar.
    const existente = insumosCache.find(i=>(i.nome||'').toLowerCase()===nome.toLowerCase());

    try{
        if(existente){
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'insumos',existente.id), {quantidade:increment(qtd)});
            await registrarGastoInsumo(existente.id, existente.nome, qtd, custo);
            toast(`✓ +${qtd} ${unidade} adicionado(s) a "${existente.nome}"${custo?' — gasto registrado':''}`);
        } else {
            const novoRef = await addDoc(collection(db,'barbeiros',barbeiroData.uid,'insumos'), {
                nome, unidade, quantidade:qtd, quantidadeMinima:qtdMinima,
                criadoEm: new Date().toISOString()
            });
            await registrarGastoInsumo(novoRef.id, nome, qtd, custo);
            toast('✓ Insumo cadastrado!'+(custo?' Gasto registrado.':''));
        }
        $('insumo-nome').value=''; $('insumo-qtd').value=''; $('insumo-qtd-min').value=''; $('insumo-custo').value='';
    }catch(e){ toast('Erro ao cadastrar: '+e.message,'var(--red)'); }
    btn.disabled = false;
}

const UNIDADE_ABREV = {unidade:'un', pacote:'pct', caixa:'cx', litro:'L', ml:'ml', kg:'kg', g:'g', rolo:'rl'};

function renderInsumos(){
    const cont = $('lista-insumos');
    if(!cont) return;

    $('insumo-kpi-total').textContent = insumosCache.length;
    $('insumo-kpi-baixo').textContent = insumosCache.filter(i=>i.quantidadeMinima!=null && i.quantidade<=i.quantidadeMinima).length;

    if(!insumosCache.length){ cont.innerHTML = '<div class="empty-state"><div class="icon">🧴</div>Nenhum insumo cadastrado ainda.</div>'; return; }

    cont.innerHTML = insumosCache.map(i=>{
        const baixo = i.quantidadeMinima!=null && i.quantidade<=i.quantidadeMinima;
        const un = UNIDADE_ABREV[i.unidade] || i.unidade || 'un';
        return `<div class="service-item" style="flex-wrap:wrap;${baixo?'border-color:rgba(255,75,43,.4)':''}">
            <div style="flex:1;min-width:140px">
                <div class="service-name" style="padding-right:0">${escapeHtml(i.nome)}${baixo?'<span style="font-size:.65rem;background:rgba(255,75,43,.12);color:var(--red);border-radius:20px;padding:.1rem .5rem;margin-left:.4rem">⚠️ Acabando</span>':''}</div>
                <div style="font-size:.72rem;color:var(--muted);margin-top:.2rem">
                    Quantidade: <span style="color:${baixo?'var(--red)':'var(--text)'};font-weight:700">${i.quantidade}</span> ${un}
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;justify-content:flex-end">
                <button class="btn-del" data-baixa-insumo="${i.id}" style="border-color:rgba(245,166,35,.4);color:var(--yellow)">− Dar baixa</button>
                <button class="btn-edit" data-add-insumo="${i.id}">+ Repor</button>
                <button class="btn-del" data-del-insumo="${i.id}">Remover</button>
            </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('[data-add-insumo]').forEach(btn=>{
        btn.addEventListener('click', async()=>{
            const item = insumosCache.find(i=>i.id===btn.dataset.addInsumo);
            const qtd = prompt(`Quanto de "${item.nome}" chegou? (${UNIDADE_ABREV[item.unidade]||item.unidade})`, '10');
            const n = parseFloat(qtd);
            if(!qtd || isNaN(n) || n<=0) return;
            const custoStr = prompt(`Quanto custou esse lote de "${item.nome}"? (R$, deixe em branco se não quiser registrar)`, '');
            const custo = custoStr ? parseFloat(custoStr) : null;
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'insumos',item.id), {quantidade:increment(n)});
            await registrarGastoInsumo(item.id, item.nome, n, custo);
            toast(`✓ +${n} adicionado(s) a "${item.nome}"${custo?' — gasto registrado':''}`);
        });
    });
    cont.querySelectorAll('[data-baixa-insumo]').forEach(btn=>{
        btn.addEventListener('click', async()=>{
            const item = insumosCache.find(i=>i.id===btn.dataset.baixaInsumo);
            const qtd = prompt(`Quanto de "${item.nome}" foi usado? (${UNIDADE_ABREV[item.unidade]||item.unidade})\nEm estoque: ${item.quantidade}`, '1');
            const n = parseFloat(qtd);
            if(!qtd || isNaN(n) || n<=0) return;
            if(n > item.quantidade){ toast('Não tem tanto assim para dar baixa','var(--red)'); return; }
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'insumos',item.id), {quantidade:increment(-n)});
            toast(`✓ Baixa de ${n} em "${item.nome}"`);
        });
    });
    cont.querySelectorAll('[data-del-insumo]').forEach(btn=>{
        btn.addEventListener('click', async()=>{
            const item = insumosCache.find(i=>i.id===btn.dataset.delInsumo);
            if(!confirm(`Remover "${item.nome}" do controle de insumos?`)) return;
            await deleteDoc(doc(db,'barbeiros',barbeiroData.uid,'insumos',item.id));
            toast('Insumo removido');
        });
    });
}

// ── Modal "Vender Produto" — aberto direto de um agendamento na Agenda,
// ou usado como venda avulsa. Compartilha o mesmo produtosCache do Estoque.
let vcProdutoSelecionado = null;
let vcQtdAtual = 1;

window.abrirModalVendaCliente = function(clienteNome, clienteWpp){
    const sel = $('vc-produto-select');
    sel.innerHTML = '<option value="">Selecione um produto...</option>' +
        produtosCache.filter(p=>p.estoque>0).map((p,i)=>
            `<option value="${p.id}">${escapeHtml(p.nome)} — R$${Number(p.preco).toFixed(2)} (${p.estoque} em estoque)</option>`
        ).join('');
    $('vc-aviso-vazio').style.display = produtosCache.filter(p=>p.estoque>0).length ? 'none' : 'block';
    $('vc-cliente-nome').value = clienteNome || '';
    $('vc-cliente-nome').dataset.wpp = clienteWpp || '';
    $('vc-detalhe').style.display = 'none';
    vcProdutoSelecionado = null;
    vcQtdAtual = 1;
    $('btn-confirmar-venda-cliente').disabled = true;
    $('btn-confirmar-venda-cliente').style.opacity = '.5';
    $('modal-venda-cliente').style.display = 'flex';
};

function initModalVendaCliente(){
    if(window.__vcBound) return;
    window.__vcBound = true;

    $('vc-cliente-nome').addEventListener('input', function(){ this.dataset.wpp = ''; });
    $('vc-produto-select').addEventListener('change', function(){
        const p = produtosCache.find(x=>x.id===this.value);
        vcProdutoSelecionado = p || null;
        vcQtdAtual = 1;
        atualizarResumoVendaCliente();
    });
    $('vc-qtd-menos').addEventListener('click', ()=>{ if(vcQtdAtual>1){ vcQtdAtual--; atualizarResumoVendaCliente(); } });
    $('vc-qtd-mais').addEventListener('click', ()=>{
        if(vcProdutoSelecionado && vcQtdAtual>=vcProdutoSelecionado.estoque){ toast('Não tem tanto em estoque assim','var(--red)'); return; }
        vcQtdAtual++; atualizarResumoVendaCliente();
    });
    $('btn-cancelar-venda-cliente').addEventListener('click', ()=>{ $('modal-venda-cliente').style.display='none'; });
    $('btn-confirmar-venda-cliente').addEventListener('click', confirmarVendaCliente);
}

function atualizarResumoVendaCliente(){
    const detalhe = $('vc-detalhe');
    const btn = $('btn-confirmar-venda-cliente');
    if(!vcProdutoSelecionado){
        detalhe.style.display = 'none';
        btn.disabled = true; btn.style.opacity = '.5';
        return;
    }
    detalhe.style.display = 'block';
    $('vc-estoque-disp').textContent = vcProdutoSelecionado.estoque;
    $('vc-qtd').textContent = vcQtdAtual;
    $('vc-total').textContent = 'R$'+(vcProdutoSelecionado.preco*vcQtdAtual).toFixed(2).replace('.',',');
    btn.disabled = false; btn.style.opacity = '1';
}

async function confirmarVendaCliente(){
    if(!vcProdutoSelecionado) return;
    if(vcQtdAtual>vcProdutoSelecionado.estoque){ toast('Quantidade maior que o estoque','var(--red)'); return; }
    const btn = $('btn-confirmar-venda-cliente');
    btn.disabled = true;
    try{
        const total = vcProdutoSelecionado.preco*vcQtdAtual;
        const nomeDigitado = $('vc-cliente-nome').value.trim();
        const wppJaVinculado = $('vc-cliente-nome').dataset.wpp;
        // Se o WhatsApp já veio direto do agendamento (mais confiável que
        // procurar por nome), usa ele. Senão, busca na base — e cadastra
        // esse cliente na hora se ele ainda não existir.
        const cliente = wppJaVinculado
            ? {nome:nomeDigitado, wpp:wppJaVinculado}
            : await resolverClienteDaVenda(nomeDigitado);
        await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'produtos',vcProdutoSelecionado.id),{estoque:increment(-vcQtdAtual)});
        await addDoc(collection(db,'barbeiros',barbeiroData.uid,'vendas'),{
            produtoId: vcProdutoSelecionado.id,
            produtoNome: vcProdutoSelecionado.nome,
            quantidade: vcQtdAtual,
            precoUnit: vcProdutoSelecionado.preco,
            total,
            clienteNome: cliente.nome,
            clienteWhatsapp: cliente.wpp || null,
            data: fmtHoje(),
            criadoEm: new Date().toISOString()
        });
        toast(`✓ Venda registrada: ${vcQtdAtual}x ${vcProdutoSelecionado.nome}${cliente.nome?' — '+cliente.nome:''}`);
        $('modal-venda-cliente').style.display = 'none';
        carregarVendasHoje();
    }catch(e){ toast('Erro ao registrar venda: '+e.message,'var(--red)'); }
    btn.disabled = false;
}

function verificarCodigoCadastro(){
    const codigo = $('prod-codigo').value.trim();
    const aviso = $('prod-codigo-aviso');
    const existente = codigo ? produtosCache.find(p=>p.codigoBarras===codigo) : null;
    if(existente){
        aviso.style.display = 'block';
        aviso.innerHTML = `📦 Esse código já é de <strong>"${existente.nome}"</strong> (${existente.estoque} em estoque). Vai só somar a quantidade abaixo, não cria outro cadastro.`;
        $('prod-nome').value = existente.nome;
        $('prod-custo').value = existente.custo!=null ? existente.custo : '';
        $('prod-preco').value = existente.preco;
        $('prod-estoque-label').textContent = 'Quantas chegaram agora';
        $('btn-add-produto').textContent = '+ Somar ao estoque';
        atualizarMargemCadastro();
    } else {
        aviso.style.display = 'none';
        $('prod-estoque-label').textContent = 'Quantidade';
        $('btn-add-produto').textContent = '+ Adicionar Produto';
    }
}

// Calcula e mostra a margem em tempo real conforme o dono digita custo/preço
function atualizarMargemCadastro(){
    const el = $('prod-margem-aviso');
    const custo = parseFloat($('prod-custo').value);
    const preco = parseFloat($('prod-preco').value);
    if(isNaN(custo) || isNaN(preco) || preco<=0){ el.style.display='none'; return; }

    const margemReais = preco - custo;
    const margemPct = (margemReais/preco)*100;

    el.style.display = 'block';
    if(margemReais < 0){
        el.style.background = 'rgba(255,75,43,.1)'; el.style.color='var(--red)';
        el.textContent = `⚠️ Prejuízo de R$${Math.abs(margemReais).toFixed(2)} por unidade — o custo está maior que o preço de venda.`;
    } else if(margemPct < 15){
        el.style.background = 'rgba(245,166,35,.1)'; el.style.color='var(--yellow)';
        el.textContent = `😐 Margem apertada: R$${margemReais.toFixed(2)} por unidade (${margemPct.toFixed(0)}%)`;
    } else {
        el.style.background = 'rgba(0,255,136,.1)'; el.style.color='var(--green)';
        el.textContent = `✓ Lucro de R$${margemReais.toFixed(2)} por unidade (margem de ${margemPct.toFixed(0)}%)`;
    }
}

function buscarProdutoPorCodigo(codigo){
    $('venda-produto-encontrado').style.display='none';
    $('venda-nao-encontrado').style.display='none';
    if(!codigo) return;
    const produto = produtosCache.find(p=>p.codigoBarras && p.codigoBarras===codigo);
    if(!produto){ $('venda-nao-encontrado').style.display='block'; return; }
    if(produto.estoque<=0){ toast('Esse produto está sem estoque','var(--red)'); return; }
    vendaProdutoSelecionado = produto;
    vendaQtdAtual = 1;
    $('venda-produto-nome').textContent = produto.nome;
    $('venda-produto-encontrado').style.display='block';
    atualizarResumoVenda();
}

function atualizarResumoVenda(){
    if(!vendaProdutoSelecionado) return;
    $('venda-qtd').textContent = vendaQtdAtual;
    $('venda-produto-estoque').textContent = vendaProdutoSelecionado.estoque;
    $('venda-produto-preco').textContent = 'R$'+Number(vendaProdutoSelecionado.preco).toFixed(2);
    $('venda-total').textContent = 'R$'+(vendaProdutoSelecionado.preco*vendaQtdAtual).toFixed(2).replace('.',',');
}

// Resolve o nome digitado contra a base de clientes de verdade. Se achar,
// usa os dados reais dela (inclusive WhatsApp). Se não achar e tiver nome,
// cadastra na hora — assim toda venda fica sempre ligada a um cliente real
// da aba Clientes, nunca só um texto solto.
async function resolverClienteDaVenda(nomeDigitado){
    const nome = (nomeDigitado||'').trim();
    if(!nome) return {nome:null, wpp:null};
    const existente = todosClientes.find(c=>(c.nome||'').toLowerCase()===nome.toLowerCase());
    if(existente) return {nome:existente.nome, wpp:existente.wpp||''};
    await salvarClienteManual(nome, '');
    carregarClientes(); // atualiza a base em segundo plano para a próxima venda já achar
    return {nome, wpp:''};
}

async function confirmarVenda(){
    if(!vendaProdutoSelecionado) return;
    if(vendaQtdAtual>vendaProdutoSelecionado.estoque){ toast('Quantidade maior que o estoque','var(--red)'); return; }
    const btn = $('btn-confirmar-venda');
    btn.disabled=true;
    try{
        const total = vendaProdutoSelecionado.preco*vendaQtdAtual;
        const nomeDigitado = $('venda-cliente-nome') ? $('venda-cliente-nome').value.trim() : '';
        const cliente = await resolverClienteDaVenda(nomeDigitado);
        await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'produtos',vendaProdutoSelecionado.id),{estoque:increment(-vendaQtdAtual)});
        await addDoc(collection(db,'barbeiros',barbeiroData.uid,'vendas'),{
            produtoId: vendaProdutoSelecionado.id,
            produtoNome: vendaProdutoSelecionado.nome,
            quantidade: vendaQtdAtual,
            precoUnit: vendaProdutoSelecionado.preco,
            total,
            clienteNome: cliente.nome,
            clienteWhatsapp: cliente.wpp || null,
            data: fmtHoje(),
            criadoEm: new Date().toISOString()
        });
        toast(`✓ Venda registrada: ${vendaQtdAtual}x ${vendaProdutoSelecionado.nome}${cliente.nome?' — '+cliente.nome:''}`);
        $('venda-codigo').value='';
        if($('venda-cliente-nome')) $('venda-cliente-nome').value='';
        $('venda-produto-encontrado').style.display='none';
        vendaProdutoSelecionado=null; vendaQtdAtual=1;
        $('venda-codigo').focus();
        carregarVendasHoje();
    }catch(e){ toast('Erro ao registrar venda: '+e.message,'var(--red)'); }
    btn.disabled=false;
}

async function carregarVendasHoje(){
    try{
        const hoje = fmtHoje();
        const q = query(collection(db,'barbeiros',barbeiroData.uid,'vendas'), where('data','==',hoje));
        const snap = await getDocs(q);
        let total=0;
        snap.forEach(d=>total+=Number(d.data().total||0));
        const el = $('estoque-kpi-vendas-hoje');
        if(el) el.textContent = 'R$'+total.toFixed(0);
    }catch(e){ console.error('carregarVendasHoje:',e); }
}

function atualizarKpiEstoqueBaixo(){
    const n = produtosCache.filter(p=>p.estoqueMinimo && p.estoque<=p.estoqueMinimo).length;
    const el = $('estoque-kpi-baixo');
    if(el) el.textContent = n;
}

async function adicionarProduto(){
    const nome = $('prod-nome').value.trim();
    const codigoBarras = $('prod-codigo').value.trim();
    const custo = $('prod-custo').value ? parseFloat($('prod-custo').value) : null;
    const preco = parseFloat($('prod-preco').value);
    const qtd = parseInt($('prod-estoque').value);
    const estoqueMinimo = $('prod-estoque-min').value ? parseInt($('prod-estoque-min').value) : null;
    if(!nome){ toast('Digite o nome do produto','var(--red)'); return; }
    if(isNaN(preco) || preco<0){ toast('Informe um preço válido','var(--red)'); return; }
    if(custo!==null && (isNaN(custo) || custo<0)){ toast('Informe um custo válido','var(--red)'); return; }
    if(isNaN(qtd) || qtd<=0){ toast('Informe a quantidade','var(--red)'); return; }

    const btn = $('btn-add-produto');
    btn.disabled=true;

    // Já existe um produto com esse código de barras? Em vez de bloquear (o
    // que forçava a cadastrar tudo de novo com nome diferente), soma no
    // estoque que já existe — é assim que os leitores de código de barras
    // funcionam em qualquer mercado/loja de verdade.
    const existente = codigoBarras ? produtosCache.find(p=>p.codigoBarras===codigoBarras) : null;

    try{
        if(existente){
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'produtos',existente.id), {estoque:increment(qtd)});
            toast(`✓ +${qtd} unidade(s) adicionada(s) a "${existente.nome}" (já cadastrado)`);
        } else {
            await addDoc(collection(db,'barbeiros',barbeiroData.uid,'produtos'), {
                nome, codigoBarras: codigoBarras||null, custo, preco, estoque: qtd, estoqueMinimo,
                criadoEm: new Date().toISOString()
            });
            toast('✓ Produto cadastrado!');
        }
        $('prod-nome').value=''; $('prod-codigo').value=''; $('prod-custo').value=''; $('prod-preco').value=''; $('prod-estoque').value=''; $('prod-estoque-min').value='';
        $('prod-margem-aviso').style.display='none';
    }catch(e){ toast('Erro ao cadastrar: '+e.message,'var(--red)'); }
    btn.disabled=false;
}

function renderProdutos(){
    const cont = $('lista-produtos');
    if(!cont) return;
    if(!produtosCache.length){ cont.innerHTML = '<div class="empty-state"><div class="icon">📦</div>Nenhum produto cadastrado ainda.</div>'; return; }
    cont.innerHTML = produtosCache.map(p=>{
        const baixo = p.estoqueMinimo && p.estoque<=p.estoqueMinimo;
        let margemHtml = '';
        if(p.custo!=null && p.preco>0){
            const margemReais = p.preco - p.custo;
            const margemPct = (margemReais/p.preco)*100;
            const cor = margemReais<0 ? 'var(--red)' : margemPct<15 ? 'var(--yellow)' : 'var(--green)';
            margemHtml = ` · <span style="color:${cor}">margem R$${margemReais.toFixed(2)} (${margemPct.toFixed(0)}%)</span>`;
        }
        return `<div class="service-item" style="flex-wrap:wrap;${baixo?'border-color:rgba(255,75,43,.4)':''}">
            <div style="flex:1;min-width:140px">
                <div class="service-name" style="padding-right:0">${escapeHtml(p.nome)}${baixo?'<span style="font-size:.65rem;background:rgba(255,75,43,.12);color:var(--red);border-radius:20px;padding:.1rem .5rem;margin-left:.4rem">⚠️ Estoque baixo</span>':''}</div>
                <div style="font-size:.72rem;color:var(--muted);margin-top:.2rem">
                    ${p.codigoBarras?`Código: ${escapeHtml(p.codigoBarras)} · `:''}Estoque: <span style="color:${baixo?'var(--red)':'var(--text)'};font-weight:700">${p.estoque}</span> · R$${Number(p.preco).toFixed(2)}${margemHtml}
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;justify-content:flex-end">
                <button class="btn-edit" data-add-estoque="${p.id}">+ Estoque</button>
                <button class="btn-del" data-del-produto="${p.id}">Remover</button>
            </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('[data-add-estoque]').forEach(btn=>{
        btn.addEventListener('click', async()=>{
            const qtd = prompt('Quantas unidades chegaram?','10');
            const n = parseInt(qtd);
            if(!qtd || isNaN(n) || n<=0) return;
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid,'produtos',btn.dataset.addEstoque),{estoque:increment(n)});
            toast(`✓ +${n} unidades adicionadas`);
        });
    });
    cont.querySelectorAll('[data-del-produto]').forEach(btn=>{
        btn.addEventListener('click', async()=>{
            if(!confirm('Remover esse produto do catálogo?')) return;
            await deleteDoc(doc(db,'barbeiros',barbeiroData.uid,'produtos',btn.dataset.delProduto));
            toast('Produto removido');
        });
    });
}

// Leitor de código de barras pela câmera do celular (bônus para quem não
// tem leitor físico). Carrega a biblioteca só quando realmente usada.
let scannerCameraCarregado = false;
function abrirScannerCamera(aoLer){
    const iniciar = () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9997;background:#000;display:flex;flex-direction:column;';
        overlay.innerHTML = `
            <div style="padding:1rem;display:flex;justify-content:space-between;align-items:center;background:var(--card2)">
                <span style="color:#fff;font-weight:700;font-size:.9rem">📷 Aponte para o código de barras</span>
                <button id="btn-fechar-scanner" style="background:transparent;border:1.5px solid var(--border);color:#fff;border-radius:8px;padding:.4rem .8rem;cursor:pointer">Fechar</button>
            </div>
            <div id="scanner-camera-view" style="flex:1"></div>
            <div style="padding:.85rem 1rem;background:var(--card2);text-align:center">
                <p style="color:var(--muted);font-size:.75rem;margin-bottom:.6rem">Não focou? Afasta e aproxima o celular devagar até travar a imagem, ou toca no botão abaixo.</p>
                <button id="btn-refocar-scanner" style="background:transparent;border:1.5px solid var(--blue);color:var(--blue);border-radius:8px;padding:.5rem 1rem;font-size:.8rem;cursor:pointer">🔄 Tentar focar de novo</button>
            </div>`;
        document.body.appendChild(overlay);

        const scanner = new Html5Qrcode('scanner-camera-view', {
            // Foco no formato certo (código de barras de produto), não tenta
            // decodificar QR code também — menos trabalho, mais acerto.
            formatsToSupport: (typeof Html5QrcodeSupportedFormats !== 'undefined') ? [
                Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODABAR, Html5QrcodeSupportedFormats.ITF,
            ] : undefined,
            verbose: false
        });
        const parar = () => { scanner.stop().catch(()=>{}); overlay.remove(); };
        overlay.querySelector('#btn-fechar-scanner').addEventListener('click', parar);

        const config = {
            fps: 15,
            qrbox: {width:280,height:130},
            aspectRatio: 1.6,
            // Pede foco contínuo para a câmera (muitos celulares travam o foco
            // uma vez só por padrão, o que atrapalha muito num código de
            // barras de perto). Se o aparelho não suportar, ignora sozinho.
            videoConstraints: {
                facingMode: 'environment',
                advanced: [{ focusMode: 'continuous' }]
            },
            // Usa o leitor nativo do navegador quando existir (Chrome/Android
            // tem um bem melhor que o de JavaScript, inclusive com foco).
            experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        };

        const tentarIniciar = () => scanner.start(
            {facingMode:'environment'}, config,
            (codigo)=>{ parar(); aoLer(codigo); },
            ()=>{}
        ).catch(e=>{ toast('Não deu para acessar a câmera: '+e.message,'var(--red)'); overlay.remove(); });

        overlay.querySelector('#btn-refocar-scanner').addEventListener('click', ()=>{
            scanner.stop().catch(()=>{}).then(()=>tentarIniciar());
        });

        tentarIniciar();
    };

    if(scannerCameraCarregado){ iniciar(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    script.onload = ()=>{ scannerCameraCarregado = true; iniciar(); };
    script.onerror = ()=> toast('Não deu para carregar o leitor de câmera. Confira sua internet.','var(--red)');
    document.head.appendChild(script);
}
