// ══════════════════════════════════════════════════════════
// BACKUP — exporta/restaura os dados da barbearia num arquivo .json salvo
// no próprio celular do dono. Non-module, mesmo padrão dos outros arquivos:
// usa window.$, window.toast, window.barbeiroData, window.db e as funções
// do Firestore, disponibilizadas pelo módulo principal do barbeiro.html.
// ══════════════════════════════════════════════════════════

// Coleções de nível raiz filtradas por barbeiroId (não são subcoleção de
// barbeiros/{uid}) — precisam de uma query, não um collection() direto.
const BACKUP_COLECOES_POR_QUERY = {
    agendamentos: () => query(collection(db,'agendamentos'), where('barbeiroId','==',barbeiroData.uid)),
    fila:         () => query(collection(db,'fila'), where('barbeiroId','==',barbeiroData.uid))
};
// Subcoleções de barbeiros/{uid} — tudo que é dado próprio da barbearia.
const BACKUP_SUBCOLECOES = ['clientes','vendas','fidelidade','promocoes','produtos','insumos','gastosInsumos','comissoes'];

async function coletarDadosBackup(){
    const dados = { versao: 1, geradoEm: new Date().toISOString(), barbeiroUid: barbeiroData.uid, barbeiroDoc: null, colecoes: {} };

    const bSnap = await getDoc(doc(db,'barbeiros',barbeiroData.uid));
    dados.barbeiroDoc = bSnap.exists() ? bSnap.data() : null;

    for(const [nome, refFn] of Object.entries(BACKUP_COLECOES_POR_QUERY)){
        const snap = await getDocs(refFn());
        dados.colecoes[nome] = snap.docs.map(d=>({id:d.id, dados:d.data()}));
    }
    for(const sub of BACKUP_SUBCOLECOES){
        const snap = await getDocs(collection(db,'barbeiros',barbeiroData.uid,sub));
        dados.colecoes[sub] = snap.docs.map(d=>({id:d.id, dados:d.data()}));
    }
    return dados;
}

function nomeArquivoBackup(){
    const dataStr = new Date().toISOString().slice(0,10);
    const nomeSlug = (barbeiroData.nome||'barbearia').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    return `backup-prob-${nomeSlug||'barbearia'}-${dataStr}.json`;
}

// silencioso=true é usado pelo backup automático antes da Zona de Perigo —
// não trava a tela com toast de sucesso, só avisa se der errado.
async function baixarBackup(silencioso){
    try{
        const dados = await coletarDadosBackup();
        const blob = new Blob([JSON.stringify(dados,null,2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nomeArquivoBackup();
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        if(!silencioso) toast('✓ Backup baixado no seu celular!');
        return true;
    }catch(e){
        console.error('baixarBackup:', e);
        toast('Erro ao gerar backup: '+e.message,'var(--red)');
        return false;
    }
}

async function restaurarBackup(arquivo){
    let dados;
    try{
        const texto = await arquivo.text();
        dados = JSON.parse(texto);
    }catch(e){ toast('Arquivo inválido — não deu pra ler esse arquivo','var(--red)'); return; }

    if(!dados || !dados.colecoes){ toast('Esse arquivo não parece ser um backup do Pro\'B','var(--red)'); return; }

    const totalDocs = Object.values(dados.colecoes).reduce((s,arr)=>s+arr.length,0);
    const dataBackup = dados.geradoEm ? new Date(dados.geradoEm).toLocaleString('pt-BR') : 'data desconhecida';
    if(!confirm(`Restaurar o backup de ${dataBackup}?\n\n${totalDocs} registro(s) serão gravados de volta (agendamentos, clientes, vendas etc). Isso NÃO apaga o que existe agora — só recria o que estiver faltando e atualiza o que tiver o mesmo ID.\n\nContinuar?`)) return;

    let restaurados = 0, erros = 0;
    try{
        if(dados.barbeiroDoc){
            // Nunca restaura "equipe" — a comissão não mora mais lá (ver
            // equipe.js), e o array de equipe atual pode já ter mudado.
            const { equipe, ...resto } = dados.barbeiroDoc;
            await setDoc(doc(db,'barbeiros',barbeiroData.uid), resto, {merge:true});
        }
    }catch(e){ console.error('restaurarBackup (dados da barbearia):', e); erros++; }

    for(const [nomeCol, itens] of Object.entries(dados.colecoes)){
        const ehRaiz = !!BACKUP_COLECOES_POR_QUERY[nomeCol];
        for(const item of itens){
            try{
                const ref = ehRaiz
                    ? doc(db, nomeCol, item.id)
                    : doc(db,'barbeiros',barbeiroData.uid,nomeCol,item.id);
                await setDoc(ref, item.dados, {merge:true});
                restaurados++;
            }catch(e){ console.error('restaurarBackup item:', nomeCol, item.id, e); erros++; }
        }
    }

    if(erros>0){
        toast(`⚠ ${restaurados} restaurado(s), ${erros} falharam (veja o console pra detalhes)`,'var(--red)',12000);
    } else {
        toast(`✓ Backup restaurado! ${restaurados} registro(s) recuperado(s)`);
    }
    if(typeof carregarAgendamentos==='function') carregarAgendamentos();
    if(typeof carregarClientes==='function') carregarClientes();
}

function initBackup(){
    if(window.__backupBound) return;
    window.__backupBound = true;

    const btnBaixar = $('btn-baixar-backup');
    if(btnBaixar){
        btnBaixar.addEventListener('click', async()=>{
            btnBaixar.disabled = true;
            const original = btnBaixar.textContent;
            btnBaixar.textContent = 'Gerando backup...';
            await baixarBackup(false);
            btnBaixar.disabled = false;
            btnBaixar.textContent = original;
        });
    }

    const inputArquivo = $('input-restaurar-backup');
    const btnRestaurar = $('btn-restaurar-backup');
    if(btnRestaurar && inputArquivo){
        btnRestaurar.addEventListener('click', ()=>inputArquivo.click());
        inputArquivo.addEventListener('change', async()=>{
            const arquivo = inputArquivo.files[0];
            inputArquivo.value = '';
            if(!arquivo) return;
            btnRestaurar.disabled = true;
            const original = btnRestaurar.textContent;
            btnRestaurar.textContent = 'Restaurando...';
            await restaurarBackup(arquivo);
            btnRestaurar.disabled = false;
            btnRestaurar.textContent = original;
        });
    }

    const chkAuto = $('chk-backup-automatico');
    if(chkAuto){
        chkAuto.checked = barbeiroData.backupAutomatico !== false; // padrão: ligado
        chkAuto.addEventListener('change', async()=>{
            try{
                await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{backupAutomatico: chkAuto.checked});
                barbeiroData.backupAutomatico = chkAuto.checked;
                toast(chkAuto.checked ? 'Backup automático ativado' : 'Backup automático desativado');
            }catch(e){
                toast('Erro ao salvar: '+e.message,'var(--red)');
                chkAuto.checked = !chkAuto.checked;
            }
        });
    }
}
