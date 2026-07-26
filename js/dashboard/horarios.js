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
let linkClienteAtual = '';
function initLinkCliente(){
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const baseUrl = isLocal
        ? window.location.origin + '/'
        : 'https://alesh4rk-design.github.io/prob-site/';
    const link = baseUrl + 'cliente.html?b=' + barbeiroData.uid;
    linkClienteAtual = link;
    const linkEl=$('link-cliente');
    if(linkEl) linkEl.textContent=link;
    const btnCopy=$('btn-copy-link');
    if(btnCopy && !btnCopy.dataset.bound){
        btnCopy.dataset.bound='1';
        btnCopy.addEventListener('click',()=>{navigator.clipboard.writeText(link).then(()=>toast('Link copiado!'));});
    }

    const btnGerarQr=$('btn-gerar-qr-cliente');
    if(btnGerarQr && !btnGerarQr.dataset.bound){
        btnGerarQr.dataset.bound='1';
        btnGerarQr.addEventListener('click', gerarQrCliente);
    }
    const btnBaixarQrPdf=$('btn-baixar-qr-pdf');
    if(btnBaixarQrPdf && !btnBaixarQrPdf.dataset.bound){
        btnBaixarQrPdf.dataset.bound='1';
        btnBaixarQrPdf.addEventListener('click', baixarQrClientePdf);
    }
}

// ── QR Code do link de agendamento ──
// Gera a imagem via API pública (api.qrserver.com) em vez de carregar uma
// lib de terceiro por <script> — em alguns celulares (bloqueador de
// anúncios, DNS da operadora, navegador com bloqueio de rastreadores) o
// carregamento do script externo era bloqueado silenciosamente e o botão
// parecia não fazer nada. Uma tag <img> comum é muito mais confiável.
function gerarQrCliente(){
    if(!linkClienteAtual){ toast('Link ainda não disponível.','var(--red)'); return; }
    const container=$('qr-cliente-container');
    container.innerHTML='';
    const img=document.createElement('img');
    img.crossOrigin='anonymous';
    img.width=220; img.height=220;
    img.alt='QR Code de agendamento';
    img.src='https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(linkClienteAtual);
    img.onload=()=>{
        $('qr-cliente-wrap').style.display='block';
        $('btn-baixar-qr-pdf').style.display='inline-block';
    };
    img.onerror=()=> toast('Não deu para gerar o QR Code. Confira sua internet.','var(--red)');
    container.appendChild(img);
}

function obterQrClienteDataUrl(){
    const container=$('qr-cliente-container');
    const img=container.querySelector('img');
    if(!img || !img.complete || !img.naturalWidth) return null;
    // Converte a <img> (carregada com CORS liberado pela api.qrserver.com)
    // num data URL via canvas, que é o formato que o jsPDF precisa.
    try{
        const canvas=document.createElement('canvas');
        canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
        canvas.getContext('2d').drawImage(img,0,0);
        return canvas.toDataURL('image/png');
    }catch(e){
        console.error('Erro ao converter QR Code para PDF:',e);
        return null;
    }
}

// Logo "PRO'B" grande — o mesmo usado na topbar e no relatório financeiro
// (PRO em azul neon + 'B em branco), só que em fonte bem maior aqui.
function montarLogoProB(doc, cx, y, fontSize){
    const AZUL=[0,212,255], BRANCO=[255,255,255];
    doc.setFont('helvetica','bold');
    doc.setFontSize(fontSize);
    const larguraPro = doc.getTextWidth('PRO');
    const larguraApo = doc.getTextWidth("'B");
    const larguraTotal = larguraPro + larguraApo;
    const xInicio = cx - larguraTotal / 2;
    doc.setTextColor(...AZUL);
    doc.text('PRO', xInicio, y);
    doc.setTextColor(...BRANCO);
    doc.text("'B", xInicio + larguraPro, y);
}

// ── Cartaz do QR Code (uma página, pra imprimir e deixar no balcão) ──
function baixarQrClientePdf(){
    const dataUrl = obterQrClienteDataUrl();
    if(!dataUrl){ toast('Gere o QR Code primeiro.','var(--red)'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const W=210, H=297;
    const nomeBarbearia = barbeiroData.nome || "Pro'B";
    const link = linkClienteAtual;

    const bg=[7,11,18], azul=[0,212,255], vermelho=[255,75,43], branco=[255,255,255], cinza=[150,165,180];

    // Fundo escuro de ponta a ponta + moldura azul neon dupla
    doc.setFillColor(...bg);
    doc.rect(0,0,W,H,'F');
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.8);
    doc.rect(8,8,W-16,H-16);
    doc.setLineWidth(0.3);
    doc.rect(11,11,W-22,H-22);

    // Logo "PRO'B" grande no topo
    montarLogoProB(doc, W/2, 48, 44);

    // Nome da barbearia sempre numa linha só — encolhe a fonte conforme
    // necessário em vez de quebrar linha
    doc.setFont('helvetica','bold');
    let fonteTitulo=30;
    doc.setFontSize(fonteTitulo);
    const larguraMaxTitulo=W-60;
    while(fonteTitulo>13 && (doc.getStringUnitWidth(nomeBarbearia)*fonteTitulo/doc.internal.scaleFactor)>larguraMaxTitulo){
        fonteTitulo-=1;
        doc.setFontSize(fonteTitulo);
    }
    doc.setTextColor(...branco);
    doc.text(nomeBarbearia, W/2, 78, { align:'center' });

    doc.setFont('helvetica','normal');
    doc.setFontSize(14);
    doc.setTextColor(...cinza);
    doc.text('Agende seu horário em segundos', W/2, 88, { align:'center' });

    doc.setDrawColor(...azul);
    doc.setLineWidth(0.5);
    doc.line(55,95,W-55,95);

    // Tudo daqui pra baixo flui de cima pra baixo a partir de um único
    // cursor "y" — nada é ancorado no rodapé, então não tem como um nome
    // de barbearia comprido ou um link comprido fazer um elemento
    // atropelar o outro, não importa o tamanho de cada um.
    let y=108;

    // QR Code num cartão branco arredondado (fundo branco garante boa
    // leitura da câmera, mesmo com o resto do cartaz escuro)
    const qrTam=78;
    const cartaoTam=qrTam+14;
    const cartaoX=(W-cartaoTam)/2;
    doc.setFillColor(255,255,255);
    doc.roundedRect(cartaoX,y,cartaoTam,cartaoTam,4,4,'F');
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.6);
    doc.roundedRect(cartaoX,y,cartaoTam,cartaoTam,4,4);
    doc.addImage(dataUrl,'PNG',cartaoX+7,y+7,qrTam,qrTam);
    y+=cartaoTam+14;

    // Passo a passo
    const passos=[
        'Aponte a câmera do celular pro código acima',
        'Toque no link que aparecer na tela',
        'Escolha o serviço e o horário — pronto!'
    ];
    passos.forEach((texto,i)=>{
        doc.setFillColor(...vermelho);
        doc.circle(W/2-62, y-2, 5, 'F');
        doc.setFont('helvetica','bold');
        doc.setFontSize(11);
        doc.setTextColor(...bg);
        doc.text(String(i+1), W/2-62, y+0.8, { align:'center' });
        doc.setFont('helvetica','normal');
        doc.setFontSize(12.5);
        doc.setTextColor(...branco);
        doc.text(texto, W/2-52, y+1, { align:'left' });
        y+=11;
    });
    y+=6;

    // Rodapé com o link por extenso (caso a câmera falhe) + marca
    doc.setDrawColor(...azul);
    doc.setLineWidth(0.3);
    doc.line(30,y,W-30,y);
    y+=6;
    doc.setFont('helvetica','normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...cinza);
    doc.text('Ou acesse diretamente:', W/2, y, { align:'center' });
    y+=5;
    doc.setTextColor(...azul);
    const linkLinhas=doc.splitTextToSize(link, W-40);
    doc.text(linkLinhas, W/2, y, { align:'center', lineHeightFactor:1.3 });
    y+=linkLinhas.length*4.2+5;
    doc.setFontSize(7.5);
    doc.setTextColor(...cinza);
    doc.text("Agendamento rápido e gratuito — feito com Pro'B", W/2, y, { align:'center' });
    y+=5;
    doc.setFontSize(6.5);
    doc.setTextColor(90,105,120);
    doc.text('Desenvolvido por Alexandre Lima', W/2, y, { align:'center' });

    doc.save(`qrcode-agendamento-${nomeBarbearia.replace(/\s+/g,'-')}.pdf`);
}
