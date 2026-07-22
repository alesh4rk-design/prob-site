// ══════════════════════════════════════════════════════════
// PERFIL (CONFIGURAÇÕES) E GESTÃO DA BARBEARIA — financeiro.js
//
// Script comum (não é módulo ES). Usa window.$, window.escapeHtml,
// window.toast, window.fmtHoje, window.barbeiroData e as funções do
// Firestore, disponibilizadas pelo módulo principal. XLSX e jsPDF vêm de
// scripts externos já carregados antes (ver docs/REQUIREMENTS.md).
// Chama também initLinkCliente() (mora em horarios.js) e initZonaPerigo()
// (mora em estoque.js) — funciona porque todos os módulos compartilham o
// mesmo espaço global. O clique do botão salvar perfil só é ligado depois,
// por initFinanceiroExtras() — chamada pelo módulo principal.
//
// Nota: esse arquivo junta duas partes que estavam separadas no arquivo
// original (com o bloco de login de funcionário/recepcionista no meio,
// que ainda não foi extraído). Ver docs/README.md.
// ══════════════════════════════════════════════════════════

// PERFIL
function initPerfil(){
    $('perf-nome').value=barbeiroData.nome||'';
    $('perf-wpp').value=barbeiroData.whatsapp||'';
    $('perf-endereco').value=barbeiroData.endereco||'';
    $('perf-pix').value=barbeiroData.pix||'';
    initLinkCliente();

    // Modo de atendimento
    const modoAtual=barbeiroData.modoAtendimento||'agendamento';
    const radio=document.querySelector(`input[name="modo-atend"][value="${modoAtual}"]`);
    if(radio)radio.checked=true;
    aplicarVisibilidadeAbaFila(modoAtual);

    const btnModo=document.getElementById('btn-salvar-modo');
    if(btnModo && !btnModo.dataset.bound){
        btnModo.dataset.bound='1';
        btnModo.addEventListener('click',async()=>{
            const selecionado=document.querySelector('input[name="modo-atend"]:checked').value;
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{modoAtendimento:selecionado});
            barbeiroData.modoAtendimento=selecionado;
            aplicarVisibilidadeAbaFila(selecionado);
            toast('✓ Modo de atendimento salvo!');
        });
    }

    // ── Painel de Chamada ──
    const painelModoAtual = barbeiroData.painelModo || 'na_hora';
    const painelMinAtual  = barbeiroData.painelAntecedenciaMin || 15;
    const rdPainel = document.querySelector(`input[name="painel-modo"][value="${painelModoAtual}"]`);
    if(rdPainel) rdPainel.checked = true;
    const selMin = document.getElementById('painel-antecedencia-min');
    if(selMin) selMin.value = painelMinAtual;
    const antWrap = document.getElementById('painel-antecedencia-wrap');
    if(antWrap) antWrap.style.display = painelModoAtual==='antecedencia'?'block':'none';

    // Toggle do select de antecedência
    document.querySelectorAll('input[name="painel-modo"]').forEach(rd=>{
        rd.addEventListener('change',()=>{
            const w=document.getElementById('painel-antecedencia-wrap');
            if(w) w.style.display=rd.value==='antecedencia'?'block':'none';
        });
    });

    // Salvar configuração do painel
    const btnPainel=document.getElementById('btn-salvar-painel-modo');
    if(btnPainel && !btnPainel.dataset.bound){
        btnPainel.dataset.bound='1';
        btnPainel.addEventListener('click',async()=>{
            const modo=document.querySelector('input[name="painel-modo"]:checked')?.value||'na_hora';
            const min=parseInt(document.getElementById('painel-antecedencia-min')?.value)||15;
            barbeiroData.painelModo=modo;
            barbeiroData.painelAntecedenciaMin=min;
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{painelModo:modo,painelAntecedenciaMin:min});
            toast('✓ Configuração do painel salva!');
        });
    }

    initZonaPerigo();
}

function aplicarVisibilidadeAbaFila(modo){
    const tabFila=document.querySelector('.tab[data-tab="fila"]');
    if(!tabFila)return;
    tabFila.style.display=(modo==='fila'||modo==='ambos')?'block':'none';
    // Se a aba Fila estava ativa e o modo mudou para não tê-la, volta para Agendamentos
    if(tabFila.style.display==='none' && tabFila.classList.contains('active')){
        tabFila.classList.remove('active');
        document.getElementById('tab-fila').classList.remove('active');
        document.querySelector('.tab[data-tab="agendamentos"]').classList.add('active');
        document.getElementById('tab-agendamentos').classList.add('active');
    }
}

// Global toast helper for inline onclick
window.showToast=function(msg){toast(msg);};

// Liga o botão de salvar perfil — chamada por initFinanceiroExtras(),
// depois que window.$ e companhia já estão prontos.
function initFinanceiroExtras(){
$('btn-salvar-perfil').addEventListener('click',async()=>{
    const nome=$('perf-nome').value.trim();
    const whatsapp=$('perf-wpp').value.replace(/\D/g,'');
    const endereco=$('perf-endereco').value.trim();
    const pix=$('perf-pix').value.trim();
    if(!nome){toast('Informe o nome da barbearia','var(--red)');return;}
    await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{nome,whatsapp,endereco,pix});
    barbeiroData={...barbeiroData,nome,whatsapp,endereco,pix};
    toast('Perfil salvo!');
});
}

// ══ FATURAMENTO ══
// ══ EXPORTAR EXCEL ══
let periodoExportSelecionado='semana';

function initPeriodoExport(){
    document.querySelectorAll('.periodo-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.periodo-btn').forEach(b=>{
                b.classList.remove('active');
                b.style.borderColor='var(--border)';b.style.color='var(--muted)';
            });
            btn.classList.add('active');
            btn.style.borderColor='var(--blue)';btn.style.color='var(--blue)';
            periodoExportSelecionado=btn.dataset.periodo;
        });
    });
}

function calcularPeriodo(tipo){
    const hoje=new Date();
    let inicio,fim=new Date(hoje);
    let label='';
    if(tipo==='semana'){
        const diaSem=hoje.getDay()||7;
        inicio=new Date(hoje);inicio.setDate(hoje.getDate()-diaSem+1);
        fim=new Date(inicio);fim.setDate(fim.getDate()+6);
        label='Semana atual (seg-dom)';
    } else if(tipo==='mes'){
        inicio=new Date(hoje.getFullYear(),hoje.getMonth(),1);
        fim=new Date(hoje.getFullYear(),hoje.getMonth()+1,0);
        label='Mês atual';
    } else {
        inicio=new Date(2020,0,1);
        fim=new Date(hoje);
        label='Histórico completo';
    }
    return {
        inicioStr:inicio.toISOString().split('T')[0],
        fimStr:fim.toISOString().split('T')[0],
        inicioBR:inicio.toLocaleDateString('pt-BR'),
        fimBR:fim.toLocaleDateString('pt-BR'),
        label
    };
}

function aplicarEstiloPlanilha(ws,numCols,headerRow=0){
    ws['!cols']=Array(numCols).fill({wch:18});
}

async function exportarExcel(){
    const btn=$('btn-exportar-excel');
    btn.disabled=true;btn.textContent='Gerando...';

    try{
        const periodo=calcularPeriodo(periodoExportSelecionado);

        const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid));
        const snap=await getDocs(q);
        let todos=[];snap.forEach(d=>todos.push(d.data()));
        todos=todos.filter(a=>a.data>=periodo.inicioStr&&a.data<=periodo.fimStr);
        todos.sort((a,b)=>a.data===b.data?a.hora.localeCompare(b.hora):a.data.localeCompare(b.data));

        const concluidos=todos.filter(a=>a.status==='concluido');
        const cancelados=todos.filter(a=>a.status==='cancelado');
        const pendentes=todos.filter(a=>a.status!=='concluido'&&a.status!=='cancelado');
        const totalServicosExcel=concluidos.reduce((s,a)=>s+Number(a.preco||0),0);
        const ticketMedio=concluidos.length?totalServicosExcel/concluidos.length:0;

        // Vendas de produtos do período
        let vendasExcel=[];
        try{
            const snapVendasExcel=await getDocs(collection(db,'barbeiros',barbeiroData.uid,'vendas'));
            snapVendasExcel.forEach(d=>vendasExcel.push(d.data()));
        }catch(e){ console.error('vendas excel:',e); }
        vendasExcel=vendasExcel.filter(v=>v.data>=periodo.inicioStr&&v.data<=periodo.fimStr);
        const totalProdutosExcel=vendasExcel.reduce((s,v)=>s+Number(v.total||0),0);
        const totalFaturado=totalServicosExcel+totalProdutosExcel;

        const wb=XLSX.utils.book_new();

        // ══ ABA 1: CAPA / RESUMO ══
        const capa=[
            [`RELATÓRIO — ${(barbeiroData.nome||'BARBEARIA').toUpperCase()}`],
            [`Sistema de Agendamento Pro'B`],
            [],
            ['Período do relatório:',periodo.label],
            ['De:',periodo.inicioBR],
            ['Até:',periodo.fimBR],
            ['Gerado em:',new Date().toLocaleString('pt-BR')],
            [],
            ['RESUMO GERAL'],
            ['Indicador','Valor'],
            ['Total de agendamentos',todos.length],
            ['Cortes concluídos',concluidos.length],
            ['Agendamentos pendentes',pendentes.length],
            ['Cancelamentos',cancelados.length],
            ['Taxa de cancelamento',todos.length?((cancelados.length/todos.length)*100).toFixed(1)+'%':'0%'],
            [],
            ['FINANCEIRO'],
            ['Faturamento total (R$)',totalFaturado.toFixed(2)],
            ['  · Faturamento de serviços (R$)',totalServicosExcel.toFixed(2)],
            ['  · Faturamento de produtos (R$)',totalProdutosExcel.toFixed(2)],
            ['Ticket médio de serviço (R$)',ticketMedio.toFixed(2)],
            ['Gastos fixos mensais (R$)',totalGastosFixos().toFixed(2)],
        ];
        const wsCapa=XLSX.utils.aoa_to_sheet(capa);
        wsCapa['!cols']=[{wch:30},{wch:24}];
        wsCapa['!merges']=[
            {s:{r:0,c:0},e:{r:0,c:1}},
            {s:{r:1,c:0},e:{r:1,c:1}},
            {s:{r:8,c:0},e:{r:8,c:1}},
            {s:{r:16,c:0},e:{r:16,c:1}},
        ];
        XLSX.utils.book_append_sheet(wb,wsCapa,'Resumo');

        // ══ ABA 2: POR BARBEIRO ══
        const equipe=barbeiroData.equipe||[];
        const porBarbeiro={};
        concluidos.forEach(a=>{
            const nome=a.barbeiro||'(dono)';
            if(!porBarbeiro[nome])porBarbeiro[nome]={cortes:0,total:0};
            porBarbeiro[nome].cortes++;
            porBarbeiro[nome].total+=Number(a.preco||0);
        });
        const dadosResumo=Object.entries(porBarbeiro).map(([nome,d])=>{
            const membro=equipe.find(e=>e.nome===nome);
            const pct=membro?.pct||0;
            const ganho=nome==='(dono)'?d.total:d.total*pct/100;
            return {
                'Barbeiro':nome,'Cortes Concluídos':d.cortes,
                'Faturado (R$)':d.total.toFixed(2),
                'Comissão (%)':nome==='(dono)'?'100':pct,
                'Ganho (R$)':ganho.toFixed(2)
            };
        });
        const wsResumo=XLSX.utils.json_to_sheet(dadosResumo.length?dadosResumo:[{'Barbeiro':'Sem dados no período','Cortes Concluídos':'','Faturado (R$)':'','Comissão (%)':'','Ganho (R$)':''}]);
        aplicarEstiloPlanilha(wsResumo,5);
        XLSX.utils.book_append_sheet(wb,wsResumo,'Por Barbeiro');

        // ══ ABA 3: CORTES MAIS VENDIDOS ══
        const porCorte={};
        concluidos.forEach(a=>{
            if(!a.corte)return;
            if(!porCorte[a.corte])porCorte[a.corte]={qtd:0,total:0};
            porCorte[a.corte].qtd++;
            porCorte[a.corte].total+=Number(a.preco||0);
        });
        const dadosCortes=Object.entries(porCorte)
            .sort((a,b)=>b[1].qtd-a[1].qtd)
            .map(([nome,d])=>({'Corte':nome,'Quantidade':d.qtd,'Faturado (R$)':d.total.toFixed(2)}));
        const wsCortes=XLSX.utils.json_to_sheet(dadosCortes.length?dadosCortes:[{'Corte':'Sem dados no período','Quantidade':'','Faturado (R$)':''}]);
        aplicarEstiloPlanilha(wsCortes,3);
        XLSX.utils.book_append_sheet(wb,wsCortes,'Cortes Mais Vendidos');

        // ══ ABA 3.5: PRODUTOS MAIS VENDIDOS ══
        const porProduto={};
        vendasExcel.forEach(v=>{
            if(!v.produtoNome)return;
            if(!porProduto[v.produtoNome])porProduto[v.produtoNome]={qtd:0,total:0};
            porProduto[v.produtoNome].qtd+=Number(v.quantidade||0);
            porProduto[v.produtoNome].total+=Number(v.total||0);
        });
        const dadosProdutos=Object.entries(porProduto)
            .sort((a,b)=>b[1].qtd-a[1].qtd)
            .map(([nome,d])=>({'Produto':nome,'Quantidade Vendida':d.qtd,'Faturado (R$)':d.total.toFixed(2)}));
        const wsProdutos=XLSX.utils.json_to_sheet(dadosProdutos.length?dadosProdutos:[{'Produto':'Sem vendas no período','Quantidade Vendida':'','Faturado (R$)':''}]);
        aplicarEstiloPlanilha(wsProdutos,3);
        XLSX.utils.book_append_sheet(wb,wsProdutos,'Produtos Mais Vendidos');

        // ══ ABA 3.6: VENDAS DE PRODUTOS DETALHADAS ══
        const dadosVendas=vendasExcel
            .slice()
            .sort((a,b)=>(a.data||'').localeCompare(b.data||''))
            .map(v=>({
                'Data':v.data?v.data.split('-').reverse().join('/'):'',
                'Produto':v.produtoNome||'',
                'Quantidade':v.quantidade||0,
                'Preço Unitário (R$)':Number(v.precoUnit||0).toFixed(2),
                'Total (R$)':Number(v.total||0).toFixed(2)
            }));
        const wsVendas=XLSX.utils.json_to_sheet(dadosVendas.length?dadosVendas:[{'Data':'Sem vendas de produtos no período'}]);
        aplicarEstiloPlanilha(wsVendas,5);
        XLSX.utils.book_append_sheet(wb,wsVendas,'Vendas de Produtos');

        // ══ ABA 4: AGENDAMENTOS DETALHADOS ══
        const dadosAgend=todos.map(a=>({
            'Data':a.data?a.data.split('-').reverse().join('/'):'',
            'Hora':a.hora,'Cliente':a.clienteNome,'WhatsApp':a.clienteWhatsapp||'-',
            'Corte':a.corte,'Barbeiro':a.barbeiro||'(dono)','Preço (R$)':Number(a.preco||0).toFixed(2),
            'Status':a.status==='concluido'?'Concluído':a.status==='cancelado'?'Cancelado':'Pendente',
            'Origem':a.origem==='presencial'?'Presencial':'Online'
        }));
        const wsAgend=XLSX.utils.json_to_sheet(dadosAgend.length?dadosAgend:[{'Data':'Sem agendamentos no período'}]);
        aplicarEstiloPlanilha(wsAgend,9);
        XLSX.utils.book_append_sheet(wb,wsAgend,'Agendamentos Detalhados');

        const nomeArquivo=`relatorio-${(barbeiroData.nome||'barbearia').replace(/[^a-z0-9]/gi,'_')}-${periodoExportSelecionado}-${fmtHoje()}.xlsx`;
        XLSX.writeFile(wb,nomeArquivo);
        toast('✓ Relatório exportado!');
    }catch(e){
        toast('Erro ao gerar relatório: '+e.message,'var(--red)');
    }
    btn.disabled=false;btn.innerHTML='📊 Exportar Relatório (Excel)';
}

// ══ EXPORTAR PDF — layout "Contraste Bold" ══
async function exportarPDF(){
    const btn=$('btn-exportar-pdf');
    btn.disabled=true;btn.innerHTML='Gerando...';

    try{
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
        const W=210, H=297, M=15;

        // Paleta
        const NAVY=[7,11,18], BLUE_BRIGHT=[0,212,255], WHITE=[255,255,255];
        const BLUE_DARK=[12,68,124], BLUE_MID=[133,183,235];
        const GRAY_TXT=[90,90,88], GRAY_MUTED=[150,150,146], GRAY_LIGHT=[224,224,220];
        const CARD_BG=[242,246,250];
        const GREEN=[15,110,86], RED=[163,45,45], AMBER=[133,79,11];

        const periodo=calcularPeriodo(periodoExportSelecionado);

        // ── Dados ──
        const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid));
        const snap=await getDocs(q);
        let todos=[];snap.forEach(d=>todos.push(d.data()));

        const todosPeriodo=todos.filter(a=>a.data>=periodo.inicioStr&&a.data<=periodo.fimStr);
        const concP=todosPeriodo.filter(a=>a.status==='concluido');
        const cancP=todosPeriodo.filter(a=>a.status==='cancelado');
        const pendP=todosPeriodo.filter(a=>a.status!=='concluido'&&a.status!=='cancelado');
        const totalServicos=concP.reduce((s,a)=>s+Number(a.preco||0),0);

        // Vendas de produtos do período
        let vendasPdf=[];
        try{
            const snapVendasPdf=await getDocs(collection(db,'barbeiros',barbeiroData.uid,'vendas'));
            snapVendasPdf.forEach(d=>vendasPdf.push(d.data()));
        }catch(e){ console.error('vendas pdf:',e); }
        const vendasPeriodo=vendasPdf.filter(v=>v.data>=periodo.inicioStr&&v.data<=periodo.fimStr);
        const totalProdutos=vendasPeriodo.reduce((s,v)=>s+Number(v.total||0),0);

        const totalFaturado=totalServicos+totalProdutos;
        const ticketMedio=concP.length?totalServicos/concP.length:0;
        const pctCancel=todosPeriodo.length?Math.round((cancP.length/todosPeriodo.length)*100):0;

        const equipe=barbeiroData.equipe||[];
        const comissoesPeriodo=concP.reduce((s,a)=>{
            const b=equipe.find(e=>e.nome===a.barbeiro);
            return s+(Number(a.preco||0)*(b?.pct||0)/100);
        },0);
        const despesasFixas=totalGastosFixos();
        const lucroLiquido=totalFaturado-comissoesPeriodo-despesasFixas;

        // Últimos 7 dias (sempre relativo a hoje, igual ao painel)
        const hoje=new Date();
        const hojeStr=hoje.toISOString().split('T')[0];
        const dias7=[];
        for(let i=6;i>=0;i--){const d=new Date(hoje);d.setDate(hoje.getDate()-i);dias7.push(d.toISOString().split('T')[0]);}
        const nomes7=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        const concTodos=todos.filter(a=>a.status==='concluido');
        const vals7=dias7.map(d=>
            concTodos.filter(a=>a.data===d).reduce((s,a)=>s+Number(a.preco||0),0)
            + vendasPdf.filter(v=>v.data===d).reduce((s,v)=>s+Number(v.total||0),0)
        );

        // Últimos 6 meses — receita x despesas
        const nomesM=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const meses6=[];
        for(let i=5;i>=0;i--){const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);meses6.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);}
        const mesAtual=hojeStr.slice(0,7);
        const receitasM=meses6.map(m=>
            concTodos.filter(a=>a.data&&a.data.startsWith(m)).reduce((s,a)=>s+Number(a.preco||0),0)
            + vendasPdf.filter(v=>v.data&&v.data.startsWith(m)).reduce((s,v)=>s+Number(v.total||0),0)
        );
        const despesasM=meses6.map(m=>totalGastosNoMes(m));

        // Ranking de cortes
        const porCorte={};
        concP.forEach(a=>{
            if(!a.corte)return;
            if(!porCorte[a.corte])porCorte[a.corte]={qtd:0,total:0};
            porCorte[a.corte].qtd++;porCorte[a.corte].total+=Number(a.preco||0);
        });
        const ranking=Object.entries(porCorte).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0,6);

        // Por barbeiro
        const porBarbeiro={};
        concP.forEach(a=>{
            const nome=a.barbeiro||'(dono)';
            if(!porBarbeiro[nome])porBarbeiro[nome]={cortes:0,total:0};
            porBarbeiro[nome].cortes++;porBarbeiro[nome].total+=Number(a.preco||0);
        });
        const equipeRows=Object.entries(porBarbeiro).map(([nome,d])=>{
            const membro=equipe.find(e=>e.nome===nome);
            const pct=nome==='(dono)'?100:(membro?.pct||0);
            const ganho=nome==='(dono)'?d.total:d.total*pct/100;
            return {nome,cortes:d.cortes,total:d.total,pct,ganho};
        }).sort((a,b)=>b.total-a.total);

        // ── Helpers de desenho ──
        const setCor=(c)=>doc.setTextColor(c[0],c[1],c[2]);
        const setFill=(c)=>doc.setFillColor(c[0],c[1],c[2]);
        const setDraw=(c)=>doc.setDrawColor(c[0],c[1],c[2]);

        function addHeaderBand(){
            setFill(NAVY);doc.rect(0,0,W,34,'F');
            doc.setFont('helvetica','bold');doc.setFontSize(18);
            setCor(BLUE_BRIGHT);doc.text("PRO",M,15);
            const pw=doc.getTextWidth("PRO");
            setCor(WHITE);doc.text("'B",M+pw,15);
            doc.setFont('helvetica','normal');doc.setFontSize(8);
            setCor([150,165,180]);
            doc.text(periodo.label.toUpperCase(),W-M,10,{align:'right'});
            doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`,W-M,15,{align:'right'});
            doc.setFont('helvetica','bold');doc.setFontSize(12);
            setCor(WHITE);doc.text('Relatório financeiro',M,24);
            doc.setFont('helvetica','normal');doc.setFontSize(8.5);
            setCor([150,165,180]);
            doc.text(`${barbeiroData.nome||'Barbearia'}  ·  ${periodo.inicioBR} a ${periodo.fimBR}`,M,29.5);
        }

        function addFooter(){
            const total=doc.internal.getNumberOfPages();
            for(let i=1;i<=total;i++){
                doc.setPage(i);
                setDraw(GRAY_LIGHT);doc.setLineWidth(.2);doc.line(M,H-14,W-M,H-14);
                doc.setFont('helvetica','normal');doc.setFontSize(7);
                setCor(GRAY_MUTED);
                doc.text("Gerado pelo sistema Pro'B",M,H-10);
                doc.text(`Página ${i}/${total}`,W-M,H-10,{align:'right'});
            }
        }

        function sectionTitle(txt,y){
            doc.setFont('helvetica','bold');doc.setFontSize(10.5);
            setCor(NAVY);doc.text(txt,M,y);
            setDraw(GRAY_LIGHT);doc.setLineWidth(.2);doc.line(M,y+2,W-M,y+2);
            return y+9;
        }

        function kpiCard(x,y,w,h,label,valor,cor){
            setFill(CARD_BG);doc.roundedRect(x,y,w,h,2,2,'F');
            doc.setFont('helvetica','bold');doc.setFontSize(12);
            setCor(cor);doc.text(valor,x+w/2,y+h/2+1,{align:'center'});
            doc.setFont('helvetica','normal');doc.setFontSize(6.6);
            setCor(GRAY_TXT);doc.text(label.toUpperCase(),x+w/2,y+h-3,{align:'center'});
        }

        function chartCard(x,y,w,h,titulo){
            setFill(CARD_BG);doc.roundedRect(x,y,w,h,2,2,'F');
            doc.setFont('helvetica','normal');doc.setFontSize(7);
            setCor(GRAY_TXT);doc.text(titulo,x+4,y+6);
        }

        // ══ PÁGINA 1 ══
        addHeaderBand();
        let y=42;

        y=sectionTitle('Resumo do período',y);
        const kpiW=(W-2*M-3*4)/4;
        kpiCard(M,y,kpiW,20,'Receita bruta','R$'+totalFaturado.toFixed(0),BLUE_DARK);
        kpiCard(M+kpiW+4,y,kpiW,20,'Comissões','R$'+comissoesPeriodo.toFixed(0),AMBER);
        kpiCard(M+2*(kpiW+4),y,kpiW,20,'Despesas fixas','R$'+despesasFixas.toFixed(0),RED);
        kpiCard(M+3*(kpiW+4),y,kpiW,20,'Lucro líquido','R$'+lucroLiquido.toFixed(0),lucroLiquido>=0?GREEN:RED);
        y+=26;

        kpiCard(M,y,kpiW,18,'Cortes concluídos',String(concP.length),NAVY);
        kpiCard(M+kpiW+4,y,kpiW,18,'Ticket médio','R$'+ticketMedio.toFixed(0),NAVY);
        kpiCard(M+2*(kpiW+4),y,kpiW,18,'Cancelamentos',pctCancel+'%',pctCancel>15?RED:NAVY);
        kpiCard(M+3*(kpiW+4),y,kpiW,18,'Pendentes',String(pendP.length),NAVY);
        y+=26;

        kpiCard(M,y,kpiW,18,'Receita serviços','R$'+totalServicos.toFixed(0),NAVY);
        kpiCard(M+kpiW+4,y,kpiW,18,'Receita produtos','R$'+totalProdutos.toFixed(0),BLUE_DARK);
        kpiCard(M+2*(kpiW+4),y,kpiW,18,'Produtos vendidos',String(vendasPeriodo.reduce((s,v)=>s+Number(v.quantidade||0),0)),NAVY);
        kpiCard(M+3*(kpiW+4),y,kpiW,18,'Nº de vendas',String(vendasPeriodo.length),NAVY);
        y+=26;

        y=sectionTitle('Faturamento — últimos 7 dias',y);
        const chH=42;
        chartCard(M,y,W-2*M,chH,'');
        {
            const max7=Math.max(...vals7,1);
            const barsX=M+8, barsW=W-2*M-16, gap=3;
            const n=7, bw=(barsW-(n-1)*gap)/n;
            const baseY=y+chH-8;
            dias7.forEach((d,i)=>{
                const bh=Math.max((vals7[i]/max7)*(chH-18),1.5);
                const bx=barsX+i*(bw+gap);
                const isHoje=d===hojeStr;
                setFill(isHoje?NAVY:BLUE_MID);
                doc.roundedRect(bx,baseY-bh,bw,bh,.6,.6,'F');
                doc.setFont('helvetica','normal');doc.setFontSize(6);
                setCor(GRAY_TXT);
                doc.text(nomes7[new Date(d+'T12:00:00').getDay()],bx+bw/2,baseY+4,{align:'center'});
                if(vals7[i]>0){
                    setCor(GRAY_MUTED);doc.setFontSize(5.2);
                    doc.text('R$'+vals7[i].toFixed(0),bx+bw/2,baseY-bh-1.5,{align:'center'});
                }
            });
        }
        y+=chH+10;

        y=sectionTitle('Faturamento x Despesas — últimos 6 meses',y);
        const chH2=48;
        chartCard(M,y,W-2*M,chH2,'');
        {
            const maxM=Math.max(...receitasM,...despesasM,1);
            const barsX=M+8, barsW=W-2*M-16, gap=5;
            const n=6, groupW=(barsW-(n-1)*gap)/n, barW=(groupW-2)/2;
            const baseY=y+chH2-8;
            meses6.forEach((m,i)=>{
                const gx=barsX+i*(groupW+gap);
                const hRec=Math.max((receitasM[i]/maxM)*(chH2-18),1);
                const hDesp=Math.max((despesasM[i]/maxM)*(chH2-18),1);
                setFill(BLUE_DARK);
                doc.roundedRect(gx,baseY-hRec,barW,hRec,.6,.6,'F');
                setFill(RED);
                doc.roundedRect(gx+barW+2,baseY-hDesp,barW,hDesp,.6,.6,'F');
                doc.setFont('helvetica','normal');doc.setFontSize(6);
                setCor(GRAY_TXT);
                doc.text(nomesM[Number(m.split('-')[1])-1],gx+groupW/2-1,baseY+4,{align:'center'});
            });
            setFill(BLUE_DARK);doc.rect(M+4,y+chH2-4,3,3,'F');
            doc.setFontSize(6.2);setCor(GRAY_TXT);doc.text('Receita',M+9,y+chH2-1.5);
            setFill(RED);doc.rect(M+32,y+chH2-4,3,3,'F');
            doc.text('Despesas',M+37,y+chH2-1.5);
        }

        // ══ PÁGINA 2 ══
        doc.addPage();
        addHeaderBand();
        y=42;

        y=sectionTitle('Cortes mais vendidos',y);
        if(ranking.length){
            doc.setFont('helvetica','bold');doc.setFontSize(7.5);setCor(GRAY_MUTED);
            doc.text('CORTE',M,y);doc.text('QTD',W-M-38,y,{align:'right'});doc.text('FATURADO',W-M,y,{align:'right'});
            y+=3;setDraw(GRAY_LIGHT);doc.line(M,y,W-M,y);y+=5;
            ranking.forEach(([nome,d])=>{
                doc.setFont('helvetica','normal');doc.setFontSize(8.5);setCor(NAVY);
                doc.text(nome,M,y);
                doc.text(String(d.qtd)+'x',W-M-38,y,{align:'right'});
                setCor(BLUE_DARK);doc.setFont('helvetica','bold');
                doc.text('R$'+d.total.toFixed(0),W-M,y,{align:'right'});
                y+=6.5;
            });
        }else{
            doc.setFont('helvetica','normal');doc.setFontSize(8.5);setCor(GRAY_MUTED);
            doc.text('Nenhum corte concluído no período.',M,y);y+=6.5;
        }
        y+=6;

        y=sectionTitle('Desempenho por barbeiro',y);
        if(equipeRows.length){
            doc.setFont('helvetica','bold');doc.setFontSize(7.5);setCor(GRAY_MUTED);
            doc.text('BARBEIRO',M,y);doc.text('CORTES',W-M-70,y,{align:'right'});
            doc.text('FATURADO',W-M-35,y,{align:'right'});doc.text('GANHO',W-M,y,{align:'right'});
            y+=3;setDraw(GRAY_LIGHT);doc.line(M,y,W-M,y);y+=5;
            equipeRows.forEach(r=>{
                doc.setFont('helvetica','normal');doc.setFontSize(8.5);setCor(NAVY);
                doc.text(r.nome,M,y);
                doc.text(String(r.cortes),W-M-70,y,{align:'right'});
                doc.text('R$'+r.total.toFixed(0),W-M-35,y,{align:'right'});
                setCor(GREEN);doc.setFont('helvetica','bold');
                doc.text('R$'+r.ganho.toFixed(0),W-M,y,{align:'right'});
                y+=6.5;
            });
        }else{
            doc.setFont('helvetica','normal');doc.setFontSize(8.5);setCor(GRAY_MUTED);
            doc.text('Nenhum corte concluído no período.',M,y);
        }
        y+=10;

        y=sectionTitle('Produtos mais vendidos',y);
        const rankingProdutosPdf = (()=>{
            const cont={};
            vendasPeriodo.forEach(v=>{
                if(!v.produtoNome)return;
                if(!cont[v.produtoNome])cont[v.produtoNome]={qtd:0,total:0};
                cont[v.produtoNome].qtd+=Number(v.quantidade||0);
                cont[v.produtoNome].total+=Number(v.total||0);
            });
            return Object.entries(cont).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0,6);
        })();
        if(rankingProdutosPdf.length){
            doc.setFont('helvetica','bold');doc.setFontSize(7.5);setCor(GRAY_MUTED);
            doc.text('PRODUTO',M,y);doc.text('QTD',W-M-38,y,{align:'right'});doc.text('FATURADO',W-M,y,{align:'right'});
            y+=3;setDraw(GRAY_LIGHT);doc.line(M,y,W-M,y);y+=5;
            rankingProdutosPdf.forEach(([nome,d])=>{
                doc.setFont('helvetica','normal');doc.setFontSize(8.5);setCor(NAVY);
                doc.text(nome,M,y);
                doc.text(String(d.qtd)+'x',W-M-38,y,{align:'right'});
                setCor(BLUE_DARK);doc.setFont('helvetica','bold');
                doc.text('R$'+d.total.toFixed(0),W-M,y,{align:'right'});
                y+=6.5;
            });
        }else{
            doc.setFont('helvetica','normal');doc.setFontSize(8.5);setCor(GRAY_MUTED);
            doc.text('Nenhuma venda de produto no período.',M,y);
        }

        addFooter();

        const nomeArquivo=`relatorio-${(barbeiroData.nome||'barbearia').replace(/[^a-z0-9]/gi,'_')}-${periodoExportSelecionado}-${fmtHoje()}.pdf`;
        doc.save(nomeArquivo);
        toast('✓ Relatório em PDF baixado!');
    }catch(e){
        toast('Erro ao gerar PDF: '+e.message,'var(--red)');
    }
    btn.disabled=false;btn.innerHTML='📄 Exportar Relatório (PDF)';
}

async function carregarFaturamento(){
    const hoje=new Date();
    const hojeStr=hoje.toISOString().split('T')[0];
    const mesAtual=hojeStr.slice(0,7);

    // Inicio da semana (segunda)
    const diaSem=hoje.getDay()||7;
    const inicioSemana=new Date(hoje);inicioSemana.setDate(hoje.getDate()-diaSem+1);
    const inicioSemAnt=new Date(inicioSemana);inicioSemAnt.setDate(inicioSemAnt.getDate()-7);

    const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid));
    let snap;try{snap=await getDocs(q);}catch(e){return;}
    const todos=[];snap.forEach(d=>todos.push(d.data()));
    const conc=todos.filter(a=>a.status==='concluido');
    const canc=todos.filter(a=>a.status==='cancelado');

    const inicioSemStr=inicioSemana.toISOString().split('T')[0];
    const inicioSemAntStr=inicioSemAnt.toISOString().split('T')[0];
    const fimSemAntStr=inicioSemStr;

    const daSemana=conc.filter(a=>a.data>=inicioSemStr&&a.data<=hojeStr);
    const doMes=conc.filter(a=>a.data&&a.data.startsWith(mesAtual));
    const semAnt=conc.filter(a=>a.data>=inicioSemAntStr&&a.data<fimSemAntStr);

    // Vendas de produtos — soma no faturamento junto com os serviços
    let todasVendasFat=[];
    try{
        const snapVendasFat=await getDocs(collection(db,'barbeiros',barbeiroData.uid,'vendas'));
        snapVendasFat.forEach(d=>todasVendasFat.push(d.data()));
    }catch(e){ console.error('vendas:',e); }
    const vendasSemana=todasVendasFat.filter(v=>v.data>=inicioSemStr&&v.data<=hojeStr);
    const vendasMesFat=todasVendasFat.filter(v=>v.data&&v.data.startsWith(mesAtual));
    const vendasSemAnt=todasVendasFat.filter(v=>v.data>=inicioSemAntStr&&v.data<fimSemAntStr);
    const totalVendasSemana=vendasSemana.reduce((s,v)=>s+Number(v.total||0),0);
    const totalVendasMes=vendasMesFat.reduce((s,v)=>s+Number(v.total||0),0);
    const totalVendasSemAnt=vendasSemAnt.reduce((s,v)=>s+Number(v.total||0),0);

    const totalSemana=daSemana.reduce((s,a)=>s+Number(a.preco||0),0)+totalVendasSemana;
    const totalMes=doMes.reduce((s,a)=>s+Number(a.preco||0),0)+totalVendasMes;
    const totalSemAnt=semAnt.reduce((s,a)=>s+Number(a.preco||0),0)+totalVendasSemAnt;

    // Líquido dono (total - comissões) — produtos não têm comissão, entram inteiros
    const equipe=barbeiroData.equipe||[];
    const comissoesMes=doMes.reduce((s,a)=>{
        const b=equipe.find(e=>e.nome===a.barbeiro);
        const pct=b?.pct||0;
        return s+(Number(a.preco||0)*pct/100);
    },0);
    const liquidoMes=totalMes-comissoesMes;

    // % cancelamentos
    const totalAgend=todos.filter(a=>a.data&&a.data.startsWith(mesAtual)).length;
    const cancMes=canc.filter(a=>a.data&&a.data.startsWith(mesAtual)).length;
    const pctCancel=totalAgend>0?Math.round((cancMes/totalAgend)*100):0;

    // KPIs
    $('fat-semana').textContent='R$'+totalSemana.toFixed(0);
    $('fat-mes').textContent='R$'+totalMes.toFixed(0);
    $('fat-liquido').textContent='R$'+liquidoMes.toFixed(0);
    $('fat-cancel-pct').textContent=pctCancel+'%';

    // Comparativo semanas
    const delta=totalSemana-totalSemAnt;
    const deltaPct=totalSemAnt>0?Math.round((delta/totalSemAnt)*100):0;
    const deltaClass=delta>=0?'delta-up':'delta-down';
    const deltaIcon=delta>=0?'▲':'▼';
    $('fat-compare').innerHTML=`
        <div class="compare-col">
            <div class="compare-title">Semana Atual</div>
            <div class="compare-val" style="color:var(--green)">R$${totalSemana.toFixed(0)}</div>
            <div class="compare-delta ${deltaClass}">${deltaIcon} ${Math.abs(deltaPct)}% vs semana anterior</div>
        </div>
        <div class="compare-col">
            <div class="compare-title">Semana Anterior</div>
            <div class="compare-val">R$${totalSemAnt.toFixed(0)}</div>
            <div class="compare-delta" style="color:var(--muted)">${semAnt.length} cortes</div>
        </div>`;

    // Gráfico últimos 7 dias
    const dias7=[];
    for(let i=6;i>=0;i--){const d=new Date(hoje);d.setDate(hoje.getDate()-i);dias7.push(d.toISOString().split('T')[0]);}
    const vals7=dias7.map(d=>
        conc.filter(a=>a.data===d).reduce((s,a)=>s+Number(a.preco||0),0)
        + todasVendasFat.filter(v=>v.data===d).reduce((s,v)=>s+Number(v.total||0),0)
    );
    const max7=Math.max(...vals7,1);
    const nomes7=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    $('chart-semana').innerHTML=dias7.map((d,i)=>{
        const pct=Math.round((vals7[i]/max7)*100);
        const isHoje=d===hojeStr;
        return `<div class="bar-col">
            <div class="bar-fill-wrap"><div class="bar-fill ${isHoje?'hi':''}" style="height:${Math.max(pct,2)}%"></div></div>
            <div class="bar-val">${vals7[i]>0?'R$'+vals7[i].toFixed(0):''}</div>
            <div class="bar-lbl">${nomes7[new Date(d+'T12:00:00').getDay()]}</div>
        </div>`;
    }).join('');

    // Gráfico últimos 6 meses
    const meses6=[];
    for(let i=5;i>=0;i--){
        const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);
        meses6.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    const valsM=meses6.map(m=>conc.filter(a=>a.data&&a.data.startsWith(m)).reduce((s,a)=>s+Number(a.preco||0),0));
    const maxM=Math.max(...valsM,1);
    const nomesM=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    if(!$('chart-mensal'))return;
    $('chart-mensal').innerHTML=meses6.map((m,i)=>{
        const pct=Math.round((valsM[i]/maxM)*100);
        const isMesAtual=m===mesAtual;
        return `<div class="bar-col">
            <div class="bar-fill-wrap"><div class="bar-fill ${isMesAtual?'hi':''}" style="height:${Math.max(pct,2)}%"></div></div>
            <div class="bar-val">${valsM[i]>0?'R$'+valsM[i].toFixed(0):''}</div>
            <div class="bar-lbl">${nomesM[Number(m.split('-')[1])-1]}</div>
        </div>`;
    }).join('');

    // Ranking cortes
    const contagem={};
    conc.forEach(a=>{
        if(!a.corte)return;
        if(!contagem[a.corte])contagem[a.corte]={qtd:0,total:0};
        contagem[a.corte].qtd++;
        contagem[a.corte].total+=Number(a.preco||0);
    });
    const ranking=Object.entries(contagem).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0,6);
    const maxQtd=ranking.length?ranking[0][1].qtd:1;
    $('ranking-cortes').innerHTML=ranking.length
        ?ranking.map(([nome,d],i)=>`
            <div class="rank-item">
                <span class="rank-pos">#${i+1}</span>
                <div class="rank-info">
                    <div class="rank-nome">${nome}</div>
                    <div class="rank-bar" style="width:${Math.round((d.qtd/maxQtd)*100)}%"></div>
                </div>
                <div class="rank-right">
                    <div class="rank-qtd">${d.qtd}x</div>
                    <div class="rank-val">R$${d.total.toFixed(0)}</div>
                </div>
            </div>`).join('')
        :'<div class="empty-state" style="padding:1rem">Nenhum corte concluído ainda.</div>';

    // Atualiza também o resumo de gestão (lucro, despesas) na mesma aba unificada
    if(typeof carregarResumoGestao==='function') carregarResumoGestao();
}


// ── continuação: Gestão da Barbearia (gastos, lucro) ──

// ══ GESTÃO — GASTOS FIXOS ══
const CATEGORIA_ICONS={Aluguel:'🏠',Energia:'⚡',Água:'💧',Internet:'📶',Produtos:'🧴',Manutenção:'🔧',Outros:'📦'};

let gastoTipoSelecionado='fixo';

function initGestao(){
    renderGastos();

    document.querySelectorAll('.gasto-tipo-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.gasto-tipo-btn').forEach(b=>{
                b.classList.remove('active');
                b.style.borderColor='var(--border)';b.style.color='var(--muted)';
            });
            btn.classList.add('active');
            btn.style.borderColor='var(--blue)';btn.style.color='var(--blue)';
            gastoTipoSelecionado=btn.dataset.tipo;
            document.getElementById('gasto-parcelas-wrap').style.display=gastoTipoSelecionado==='parcelado'?'block':'none';
        });
    });

    const btnAdd=document.getElementById('btn-add-gasto');
    if(btnAdd && !btnAdd.dataset.bound){
        btnAdd.dataset.bound='1';
        btnAdd.addEventListener('click',adicionarGasto);
        document.getElementById('gasto-valor').addEventListener('keypress',e=>{if(e.key==='Enter')adicionarGasto();});
    }

    carregarResumoGestao();
}

async function adicionarGasto(){
    const nome=document.getElementById('gasto-nome').value.trim();
    const categoria=document.getElementById('gasto-categoria').value;
    const valor=parseFloat(document.getElementById('gasto-valor').value);

    if(!nome){toast('Informe o nome do gasto','var(--red)');return;}
    if(!valor||valor<=0){toast('Informe um valor válido','var(--red)');return;}

    const mesInicioAtual=new Date().toISOString().slice(0,7); // YYYY-MM
    const novoGasto={id:Date.now().toString(),nome,categoria,valor,tipo:gastoTipoSelecionado,mesInicio:mesInicioAtual};

    if(gastoTipoSelecionado==='parcelado'){
        const parcelas=parseInt(document.getElementById('gasto-parcelas').value);
        if(!parcelas||parcelas<1){toast('Informe o número de parcelas','var(--red)');return;}
        novoGasto.parcelas=parcelas;
    }

    barbeiroData.gastosFixos=barbeiroData.gastosFixos||[];
    barbeiroData.gastosFixos.push(novoGasto);
    await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{gastosFixos:barbeiroData.gastosFixos});

    document.getElementById('gasto-nome').value='';
    document.getElementById('gasto-valor').value='';
    document.getElementById('gasto-parcelas').value='';
    toast('✓ Gasto adicionado!');
    renderGastos();
    carregarResumoGestao();
}

// Calcula quantas parcelas já passaram desde o início (1-indexed) e quantas faltam
function statusParcela(gasto){
    if(gasto.tipo!=='parcelado')return null;
    const [anoIni,mesIni]=gasto.mesInicio.split('-').map(Number);
    const hoje=new Date();
    const mesesPassados=(hoje.getFullYear()-anoIni)*12+(hoje.getMonth()+1-mesIni);
    const parcelaAtual=mesesPassados+1; // parcela 1 no mês de início
    const ativa=parcelaAtual>=1 && parcelaAtual<=gasto.parcelas;
    return {parcelaAtual,total:gasto.parcelas,ativa};
}

function renderGastos(){
    const lista=barbeiroData.gastosFixos||[];
    const cont=document.getElementById('lista-gastos');
    if(!cont)return;
    if(!lista.length){cont.innerHTML='<div class="empty-state"><div class="icon">💼</div>Nenhum gasto cadastrado ainda.</div>';return;}

    const mesAtualStr=new Date().toISOString().slice(0,7);

    cont.innerHTML=lista.map((g,i)=>{
        const sp=statusParcela(g);
        let parcelaInfo='';
        let tipoLabel='🔁 fixo';

        if(g.tipo==='unico'){
            tipoLabel='📌 único';
            if(g.mesInicio===mesAtualStr){
                parcelaInfo=`<span class="gasto-parcela-tag">📌 Só este mês</span>`;
            } else {
                parcelaInfo=`<span class="gasto-parcela-tag" style="background:rgba(122,159,181,.1);border-color:rgba(122,159,181,.3);color:var(--muted)">Lançado em ${g.mesInicio}</span>`;
            }
        } else if(sp){
            tipoLabel='📅 parcelado';
            if(sp.ativa){
                parcelaInfo=`<span class="gasto-parcela-tag">📅 Parcela ${sp.parcelaAtual}/${sp.total}</span>`;
            } else if(sp.parcelaAtual>sp.total){
                parcelaInfo=`<span class="gasto-parcela-tag" style="background:rgba(0,255,136,.08);border-color:rgba(0,255,136,.25);color:var(--green)">✓ Quitado</span>`;
            } else {
                parcelaInfo=`<span class="gasto-parcela-tag">📅 Inicia em ${g.mesInicio}</span>`;
            }
        }

        return `<div class="gasto-item">
            <div class="gasto-cat">${CATEGORIA_ICONS[g.categoria]||'📦'}</div>
            <div class="gasto-info">
                <div class="gasto-nome">${g.nome}</div>
                <div class="gasto-cat-label">${g.categoria} · ${tipoLabel}</div>
                ${parcelaInfo}
            </div>
            <div class="gasto-valor">R$${Number(g.valor).toFixed(2)}</div>
            <button class="btn-del" data-idx="${i}">Remover</button>
        </div>`;
    }).join('');

    cont.querySelectorAll('.btn-del').forEach(btn=>{
        btn.addEventListener('click',async()=>{
            barbeiroData.gastosFixos.splice(Number(btn.dataset.idx),1);
            await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{gastosFixos:barbeiroData.gastosFixos});
            renderGastos();
            carregarResumoGestao();
            toast('Gasto removido');
        });
    });
}

// Compara dois meses no formato YYYY-MM: retorna true se mesA é igual ou posterior a mesB
function mesIgualOuApos(mesA,mesB){
    return mesA>=mesB; // strings YYYY-MM comparam corretamente em ordem lexicográfica
}

// Verifica se um gasto está ativo em um mês específico, conforme seu tipo
function gastoAtivoNoMes(g,mesStr){
    const inicio=g.mesInicio||'0000-00';
    if(g.tipo==='unico'){
        return mesStr===inicio;
    }
    if(g.tipo==='parcelado'){
        const [anoIni,mesIni]=inicio.split('-').map(Number);
        const [anoM,mesM]=mesStr.split('-').map(Number);
        const mesesPassados=(anoM-anoIni)*12+(mesM-mesIni);
        const parcelaNoMes=mesesPassados+1;
        return parcelaNoMes>=1 && parcelaNoMes<=g.parcelas;
    }
    // fixo: ativo a partir do mês de início, para sempre
    return mesIgualOuApos(mesStr,inicio);
}

// Total de gastos ATIVOS no mês atual
function totalGastosFixos(){
    const lista=barbeiroData.gastosFixos||[];
    const mesAtualStr=new Date().toISOString().slice(0,7);
    return lista.reduce((s,g)=>gastoAtivoNoMes(g,mesAtualStr)?s+Number(g.valor||0):s,0);
}

// Total de gastos de um mês específico (para o gráfico/histórico)
function totalGastosNoMes(mesStr){
    const lista=barbeiroData.gastosFixos||[];
    return lista.reduce((s,g)=>gastoAtivoNoMes(g,mesStr)?s+Number(g.valor||0):s,0);
}

async function carregarResumoGestao(){
    const hoje=new Date();
    const mesAtual=hoje.toISOString().slice(0,7);
    const totalGastos=totalGastosFixos();

    const q=query(collection(db,'agendamentos'),where('barbeiroId','==',barbeiroData.uid));
    let snap;try{snap=await getDocs(q);}catch(e){return;}
    const todos=[];snap.forEach(d=>todos.push({id:d.id,...d.data()}));
    const concMes=todos.filter(a=>a.status==='concluido'&&a.data&&a.data.startsWith(mesAtual));

    const receitaServicosMes=concMes.reduce((s,a)=>s+Number(a.preco||0),0);

    // Vendas de produtos — busca tudo de uma vez, reaproveita para o mês atual e para o gráfico
    let todasVendas=[];
    try{
        const snapVendas=await getDocs(collection(db,'barbeiros',barbeiroData.uid,'vendas'));
        snapVendas.forEach(d=>todasVendas.push(d.data()));
    }catch(e){ console.error('vendas:',e); }
    const vendasMes=todasVendas.filter(v=>v.data && v.data.startsWith(mesAtual));
    const receitaProdutosMes=vendasMes.reduce((s,v)=>s+Number(v.total||0),0);

    // Gastos com insumos — busca tudo de uma vez, reaproveita pro mês atual e pro ranking
    let todosGastosInsumos=[];
    try{
        const snapGastos=await getDocs(collection(db,'barbeiros',barbeiroData.uid,'gastosInsumos'));
        snapGastos.forEach(d=>todosGastosInsumos.push(d.data()));
    }catch(e){ console.error('gastosInsumos:',e); }
    const gastosInsumosMes=todosGastosInsumos.filter(g=>g.data && g.data.startsWith(mesAtual));
    const totalGastosInsumosMes=gastosInsumosMes.reduce((s,g)=>s+Number(g.custoTotal||0),0);

    const receitaMes=receitaServicosMes+receitaProdutosMes;

    const equipe=barbeiroData.equipe||[];
    const comissoesMes=concMes.reduce((s,a)=>{
        const b=equipe.find(e=>e.nome===a.barbeiro);
        const pct=b?.pct||0;
        return s+(Number(a.preco||0)*pct/100);
    },0);

    const lucroLiquido=receitaMes-comissoesMes-totalGastos-totalGastosInsumosMes;

    const elReceita=document.getElementById('gest-receita');
    const elReceitaProdutos=document.getElementById('gest-receita-produtos');
    const elDespesas=document.getElementById('gest-despesas');
    const elGastosInsumos=document.getElementById('gest-gastos-insumos');
    const elComissoes=document.getElementById('gest-comissoes');
    const elLucro=document.getElementById('gest-lucro');
    if(elReceita)elReceita.textContent='R$'+receitaServicosMes.toFixed(0);
    if(elReceitaProdutos)elReceitaProdutos.textContent='R$'+receitaProdutosMes.toFixed(0);
    if(elDespesas)elDespesas.textContent='R$'+totalGastos.toFixed(0);
    if(elGastosInsumos)elGastosInsumos.textContent='R$'+totalGastosInsumosMes.toFixed(0);
    if(elComissoes)elComissoes.textContent='R$'+comissoesMes.toFixed(0);
    if(elLucro){
        elLucro.textContent='R$'+lucroLiquido.toFixed(0);
        elLucro.style.color=lucroLiquido>=0?'var(--green)':'var(--red)';
    }

    // Ranking de produtos mais vendidos no mês
    const contagemProdutos={};
    vendasMes.forEach(v=>{
        if(!v.produtoNome)return;
        if(!contagemProdutos[v.produtoNome])contagemProdutos[v.produtoNome]={qtd:0,total:0};
        contagemProdutos[v.produtoNome].qtd+=Number(v.quantidade||0);
        contagemProdutos[v.produtoNome].total+=Number(v.total||0);
    });
    const rankingProdutos=Object.entries(contagemProdutos).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0,6);
    const elRankProdutos=document.getElementById('ranking-produtos');
    if(elRankProdutos){
        elRankProdutos.innerHTML = rankingProdutos.length
            ? rankingProdutos.map(([nome,d],i)=>`
                <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;${i>0?'border-top:1px solid var(--border)':''}">
                    <div style="font-size:.82rem">${escapeHtml(nome)} <span style="color:var(--muted);font-size:.72rem">· ${d.qtd}x</span></div>
                    <div style="font-family:'Courier New',monospace;color:var(--blue);font-weight:700;font-size:.85rem">R$${d.total.toFixed(0)}</div>
                </div>`).join('')
            : '<div class="empty-state" style="padding:1rem 0"><div class="icon">📦</div>Nenhuma venda de produto este mês ainda.</div>';
    }

    // Ranking "com o que mais se gasta" em insumos no mês — mostra a fatia
    // de cada item no total gasto, tipo pizza (mas em barras, sem precisar
    // de biblioteca de gráfico)
    const contagemGastos={};
    gastosInsumosMes.forEach(g=>{
        if(!g.insumoNome)return;
        if(!contagemGastos[g.insumoNome])contagemGastos[g.insumoNome]={total:0};
        contagemGastos[g.insumoNome].total+=Number(g.custoTotal||0);
    });
    const CORES_PIZZA=['#00d4ff','#ff4b2b','#00ff88','#f5a623','#a855f7','#ff6b9d'];
    const rankingGastos=Object.entries(contagemGastos).sort((a,b)=>b[1].total-a[1].total).slice(0,6);
    const elRankGastos=document.getElementById('ranking-gastos-insumos');
    if(elRankGastos){
        if(rankingGastos.length){
            const totalGastoInsumos=rankingGastos.reduce((s,[,d])=>s+d.total,0);
            elRankGastos.innerHTML = rankingGastos.map(([nome,d],i)=>{
                const pct = totalGastoInsumos>0 ? Math.round((d.total/totalGastoInsumos)*100) : 0;
                const cor = CORES_PIZZA[i%CORES_PIZZA.length];
                return `<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;${i>0?'border-top:1px solid var(--border)':''}">
                    <span style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></span>
                    <div style="flex:1;min-width:0">
                        <div style="font-size:.82rem">${escapeHtml(nome)}</div>
                        <div style="height:5px;background:var(--card2);border-radius:3px;margin-top:.3rem;overflow:hidden">
                            <div style="height:100%;width:${pct}%;background:${cor}"></div>
                        </div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                        <div style="font-family:'Courier New',monospace;color:${cor};font-weight:700;font-size:.85rem">R$${d.total.toFixed(0)}</div>
                        <div style="font-size:.65rem;color:var(--muted)">${pct}%</div>
                    </div>
                </div>`;
            }).join('');
        } else {
            elRankGastos.innerHTML = '<div class="empty-state" style="padding:1rem 0"><div class="icon">🧴</div>Nenhum gasto com insumo registrado este mês ainda.</div>';
        }
    }

    // Receita por forma de pagamento — só considera atendimentos já concluídos
    // e que tiveram a forma de pagamento registrada (o dono escolhe isso no
    // menu de ações de cada agendamento). "Ainda não pago" fica de fora
    // daqui — é receita que ainda não entrou de verdade, e já tem o lugar
    // próprio dela na lista de "Aguardando Pagamento".
    const LABEL_PAGAMENTO={dinheiro:'💵 Dinheiro',pix:'📱 Pix',debito:'💳 Débito',credito:'💳 Crédito'};
    const CORES_PAGAMENTO={dinheiro:'#00ff88',pix:'#00d4ff',debito:'#a855f7',credito:'#ff6b9d'};
    const contagemPagamento={};
    concMes.forEach(a=>{
        const fp = a.formaPagamento;
        if(!fp || fp==='pendente') return; // sem forma de pagamento, ou ainda não pago — não entra na conta
        if(!contagemPagamento[fp]) contagemPagamento[fp]={total:0,qtd:0};
        contagemPagamento[fp].total += Number(a.preco||0);
        contagemPagamento[fp].qtd += 1;
    });
    const rankingPagamento = Object.entries(contagemPagamento).sort((a,b)=>b[1].total-a[1].total);
    const elRankPagamento = document.getElementById('ranking-formas-pagamento');
    if(elRankPagamento){
        if(rankingPagamento.length){
            const totalRegistrado = rankingPagamento.reduce((s,[,d])=>s+d.total,0);
            elRankPagamento.innerHTML = rankingPagamento.map(([forma,d],i)=>{
                const pct = totalRegistrado>0 ? Math.round((d.total/totalRegistrado)*100) : 0;
                const cor = CORES_PAGAMENTO[forma] || '#7a9fb5';
                return `<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;${i>0?'border-top:1px solid var(--border)':''}">
                    <span style="width:10px;height:10px;border-radius:50%;background:${cor};flex-shrink:0"></span>
                    <div style="flex:1;min-width:0">
                        <div style="font-size:.82rem">${LABEL_PAGAMENTO[forma]||forma} <span style="color:var(--muted);font-size:.7rem">(${d.qtd}x)</span></div>
                        <div style="height:5px;background:var(--card2);border-radius:3px;margin-top:.3rem;overflow:hidden">
                            <div style="height:100%;width:${pct}%;background:${cor}"></div>
                        </div>
                    </div>
                    <div style="text-align:right;flex-shrink:0">
                        <div style="font-family:'Courier New',monospace;color:${cor};font-weight:700;font-size:.85rem">R$${d.total.toFixed(0)}</div>
                        <div style="font-size:.65rem;color:var(--muted)">${pct}%</div>
                    </div>
                </div>`;
            }).join('');
        } else {
            elRankPagamento.innerHTML = '<div class="empty-state" style="padding:1rem 0"><div class="icon">💳</div>Nenhum pagamento registrado este mês ainda. Registre pelo menu de ações de cada agendamento.</div>';
        }
    }

    // Gráfico últimos 6 meses — receita x despesas
    const meses6=[];
    for(let i=5;i>=0;i--){
        const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);
        meses6.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
    }
    const nomesM=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const receitasPorMes=meses6.map(m=>{
        const servicos=todos.filter(a=>a.status==='concluido'&&a.data&&a.data.startsWith(m)).reduce((s,a)=>s+Number(a.preco||0),0);
        const produtos=todasVendas.filter(v=>v.data&&v.data.startsWith(m)).reduce((s,v)=>s+Number(v.total||0),0);
        return servicos+produtos;
    });

    // Despesas por mês: gastos fixos + parcelas ativas + gastos com insumos, tudo daquele mês
    const despesasPorMes=meses6.map(m=>{
        const insumosNoMes=todosGastosInsumos.filter(g=>g.data && g.data.startsWith(m)).reduce((s,g)=>s+Number(g.custoTotal||0),0);
        return totalGastosNoMes(m)+insumosNoMes;
    });

    const maxVal=Math.max(...receitasPorMes,...despesasPorMes,1);

    const chartEl=document.getElementById('chart-receita-despesa');
    if(chartEl){
        chartEl.innerHTML=meses6.map((m,i)=>{
            const recPct=Math.round((receitasPorMes[i]/maxVal)*100);
            const despPct=Math.round((despesasPorMes[i]/maxVal)*100);
            const isMesAtual=m===mesAtual;
            return `<div class="bar-col">
                <div class="bar-fill-wrap" style="gap:2px;display:flex;align-items:flex-end;justify-content:center">
                    <div class="bar-fill ${isMesAtual?'hi':''}" style="width:38%;height:${Math.max(recPct,2)}%;background:linear-gradient(to top,var(--green),rgba(0,255,136,.5))"></div>
                    <div class="bar-fill" style="width:38%;height:${Math.max(despPct,2)}%;background:linear-gradient(to top,var(--red),rgba(255,75,43,.5))"></div>
                </div>
                <div class="bar-lbl">${nomesM[Number(m.split('-')[1])-1]}</div>
            </div>`;
        }).join('');
    }

    // ══ 1. PONTO DE EQUILÍBRIO ══
    const ticketMedioMes=concMes.length?receitaMes/concMes.length:50;
    const custoFixoTotal=totalGastos+totalGastosInsumosMes;
    const cortesNecessarios=ticketMedioMes>0?Math.ceil(custoFixoTotal/ticketMedioMes):0;
    const elBeCortesNec=document.getElementById('be-cortes-necessarios');
    const elBeCortesFeitos=document.getElementById('be-cortes-feitos');
    const elBeBar=document.getElementById('be-progress-bar');
    const elBeMsg=document.getElementById('be-status-msg');
    if(elBeCortesNec)elBeCortesNec.textContent=cortesNecessarios;
    if(elBeCortesFeitos)elBeCortesFeitos.textContent=concMes.length;
    if(elBeBar){
        const pct=cortesNecessarios>0?Math.min(100,Math.round((concMes.length/cortesNecessarios)*100)):100;
        elBeBar.style.width=pct+'%';
    }
    if(elBeMsg){
        if(cortesNecessarios===0){elBeMsg.textContent='Sem gastos fixos cadastrados — tudo é lucro!';}
        else if(concMes.length>=cortesNecessarios){
            const sobra=concMes.length-cortesNecessarios;
            elBeMsg.textContent=`✓ Meta batida! Já são ${sobra} cortes além do ponto de equilíbrio.`;
        } else {
            const falta=cortesNecessarios-concMes.length;
            elBeMsg.textContent=`Faltam ${falta} cortes para cobrir os gastos fixos do mês.`;
        }
    }

    // ══ 2. RETORNO DE CLIENTES ══
    const concComWpp=concMes.filter(a=>a.clienteWhatsapp);
    const wppCount={};
    todos.filter(a=>a.status==='concluido'&&a.clienteWhatsapp).forEach(a=>{
        wppCount[a.clienteWhatsapp]=(wppCount[a.clienteWhatsapp]||0)+1;
    });
    let novos=0,recorrentes=0;
    const wppVistosNoMes=new Set();
    concComWpp.forEach(a=>{
        if(wppVistosNoMes.has(a.clienteWhatsapp))return;
        wppVistosNoMes.add(a.clienteWhatsapp);
        if((wppCount[a.clienteWhatsapp]||0)>1)recorrentes++;
        else novos++;
    });
    const totalClientesMes=novos+recorrentes;
    const taxaRetorno=totalClientesMes>0?Math.round((recorrentes/totalClientesMes)*100):0;
    const elRetNovos=document.getElementById('ret-novos');
    const elRetRecorrentes=document.getElementById('ret-recorrentes');
    const elRetTaxa=document.getElementById('ret-taxa');
    if(elRetNovos)elRetNovos.textContent=novos;
    if(elRetRecorrentes)elRetRecorrentes.textContent=recorrentes;
    if(elRetTaxa)elRetTaxa.textContent=taxaRetorno+'%';

    // ══ 3. MAPA DE CALOR — HORÁRIOS DE PICO ══
    const trintaDiasAtras=new Date(hoje);trintaDiasAtras.setDate(trintaDiasAtras.getDate()-30);
    const trintaDiasStr=trintaDiasAtras.toISOString().split('T')[0];
    const ultimos30=todos.filter(a=>a.status!=='cancelado'&&a.data>=trintaDiasStr);
    const diasSemanaLabel=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const faixasHora=['06-09','09-12','12-15','15-18','18-21','21-24'];
    const heatData={};
    diasSemanaLabel.forEach(d=>{heatData[d]={};faixasHora.forEach(f=>heatData[d][f]=0);});
    ultimos30.forEach(a=>{
        if(!a.data||!a.hora)return;
        const dataObj=new Date(a.data+'T12:00:00');
        const diaLabel=diasSemanaLabel[dataObj.getDay()];
        const horaNum=parseInt(a.hora.split(':')[0]);
        let faixa='21-24';
        if(horaNum<9)faixa='06-09';else if(horaNum<12)faixa='09-12';else if(horaNum<15)faixa='12-15';
        else if(horaNum<18)faixa='15-18';else if(horaNum<21)faixa='18-21';
        heatData[diaLabel][faixa]++;
    });
    const maxHeat=Math.max(1,...diasSemanaLabel.flatMap(d=>faixasHora.map(f=>heatData[d][f])));
    const heatEl=document.getElementById('heatmap-horarios');
    if(heatEl){
        let html=`<div class="heatmap-row"><div class="heatmap-label"></div>${faixasHora.map(f=>`<div style="flex:1;font-size:.6rem;color:var(--muted);text-align:center">${f}</div>`).join('')}</div>`;
        diasSemanaLabel.forEach(d=>{
            html+=`<div class="heatmap-row"><div class="heatmap-label">${d}</div>`;
            faixasHora.forEach(f=>{
                const val=heatData[d][f];
                const intensidade=val/maxHeat;
                html+=`<div class="heatmap-cell" style="background:rgba(0,212,255,${0.06+intensidade*0.8})" title="${val} atendimentos"></div>`;
            });
            html+='</div>';
        });
        heatEl.innerHTML=html;
    }

    // ══ 4. COMPARATIVO MÊS A MÊS ══
    const mesAnteriorDate=new Date(hoje.getFullYear(),hoje.getMonth()-1,1);
    const mesAnteriorStr=`${mesAnteriorDate.getFullYear()}-${String(mesAnteriorDate.getMonth()+1).padStart(2,'0')}`;
    const concMesAnterior=todos.filter(a=>a.status==='concluido'&&a.data&&a.data.startsWith(mesAnteriorStr));
    const receitaMesAnterior=concMesAnterior.reduce((s,a)=>s+Number(a.preco||0),0);
    const deltaMes=receitaMes-receitaMesAnterior;
    const deltaMesPct=receitaMesAnterior>0?Math.round((deltaMes/receitaMesAnterior)*100):(receitaMes>0?100:0);
    const compEl=document.getElementById('comp-mensal');
    if(compEl){
        const deltaClass=deltaMes>=0?'delta-up':'delta-down';
        const deltaIcon=deltaMes>=0?'▲':'▼';
        const nomesMComp=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        compEl.innerHTML=`
            <div class="compare-col">
                <div class="compare-title">${nomesMComp[hoje.getMonth()]} (atual)</div>
                <div class="compare-val" style="color:var(--green)">R$${receitaMes.toFixed(0)}</div>
                <div class="compare-delta ${deltaClass}">${deltaIcon} ${Math.abs(deltaMesPct)}% vs mês anterior</div>
            </div>
            <div class="compare-col">
                <div class="compare-title">${nomesMComp[mesAnteriorDate.getMonth()]} (anterior)</div>
                <div class="compare-val">R$${receitaMesAnterior.toFixed(0)}</div>
                <div class="compare-delta" style="color:var(--muted)">${concMesAnterior.length} cortes</div>
            </div>`;
    }

    // ══ 5. MARGEM POR TIPO DE CORTE ══
    const cortesConfig=barbeiroData.cortes||[];
    const margemData={};
    concMes.forEach(a=>{
        if(!a.corte)return;
        if(!margemData[a.corte])margemData[a.corte]={qtd:0,total:0};
        margemData[a.corte].qtd++;
        margemData[a.corte].total+=Number(a.preco||0);
    });
    const margemArr=Object.entries(margemData).map(([nome,d])=>{
        const cfg=cortesConfig.find(c=>c.nome===nome);
        const duracaoMin=cfg?.duracao||30;
        const valorPorHora=(d.total/d.qtd)/(duracaoMin/60);
        return {nome,qtd:d.qtd,total:d.total,valorPorHora};
    }).sort((a,b)=>b.valorPorHora-a.valorPorHora);
    const maxValorHora=Math.max(1,...margemArr.map(m=>m.valorPorHora));
    const margemEl=document.getElementById('margem-cortes');
    if(margemEl){
        margemEl.innerHTML=margemArr.length?margemArr.map(m=>{
            const pct=Math.round((m.valorPorHora/maxValorHora)*100);
            const cor=pct>70?'var(--green)':pct>40?'var(--yellow)':'var(--red)';
            return `<div class="margem-item">
                <div class="margem-info">
                    <div class="margem-nome">${m.nome} <span style="font-size:.7rem;color:var(--muted);font-weight:400">(${m.qtd}x este mês)</span></div>
                    <div class="margem-bar-wrap"><div class="margem-bar" style="width:${pct}%;background:${cor}"></div></div>
                </div>
                <div class="margem-val" style="color:${cor}">R$${m.valorPorHora.toFixed(0)}/h</div>
            </div>`;
        }).join(''):'<div class="empty-state" style="padding:1rem">Sem cortes concluídos este mês.</div>';
    }

    // ══ 6. ALERTA DE GASTOS FORA DO PADRÃO ══
    const gastoMesAnteriorCalculado=totalGastosNoMes(mesAnteriorStr);
    const alertaWrap=document.getElementById('alerta-gastos-wrap');
    const alertaMsg=document.getElementById('alerta-gastos-msg');
    if(alertaWrap&&alertaMsg){
        if(gastoMesAnteriorCalculado>0){
            const variacaoPct=Math.round(((totalGastos-gastoMesAnteriorCalculado)/gastoMesAnteriorCalculado)*100);
            if(variacaoPct>=30){
                alertaWrap.style.display='block';
                alertaMsg.textContent=`Seus gastos aumentaram ${variacaoPct}% comparado ao mês anterior (R$${gastoMesAnteriorCalculado.toFixed(0)} → R$${totalGastos.toFixed(0)}).`;
            } else {
                alertaWrap.style.display='none';
            }
        } else {
            alertaWrap.style.display='none';
        }
    }
}
