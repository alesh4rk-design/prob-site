// ══════════════════════════════════════════════════════════
// PERSONALIZAÇÃO VISUAL (TELA DO CLIENTE) — visual.js
//
// Script comum (não é módulo ES). Usa window.$, window.escapeHtml,
// window.toast, window.barbeiroData e as funções do Firestore,
// disponibilizadas pelo módulo principal. As 21 variáveis de
// personalização (visFonte, visBtnCor, etc.) usam getter/setter via
// eval() no módulo principal — testado isoladamente antes de aplicar,
// funciona corretamente mesmo em modo estrito. Ver docs/README.md.
// ══════════════════════════════════════════════════════════

function initVisual(){
    const p=barbeiroData.personalizacao||{};
    visNome=p.nomeCliente||barbeiroData.nome||'';
    visFonte=p.fonte||'';visTamanho=p.tamanho||2.6;
    visIcone=p.icone||'';visPole=p.barberpole||false;
    coresPorLetra=p.coresPorLetra||{};
    visBtnCor=p.btnCor||'#00d4ff';
    visFundo=p.fundo||'foto';
    visFundoCor1=p.fundoCor1||'#0a0e14';
    visFundoGrad1=p.fundoGrad1||'#0a0e14';
    visFundoGrad2=p.fundoGrad2||'#1a2838';
    visMsgBV=p.msgBoasVindas||'';
    visLogo=p.logo||'';

    visTemaCard=p.temaCard||'neon';

    // Tema card buttons
    document.querySelectorAll('.tema-card-btn').forEach(btn=>{
        if(btn.dataset.temaCard===visTemaCard)btn.classList.add('active');
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.tema-card-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            visTemaCard=btn.dataset.temaCard;
        });
    });
    visAnimCor1=p.animCor1||'#00d4ff';
    visAnimCor2=p.animCor2||'#00ff88';
    visAnimacao2=p.animacao2||'nenhuma';
    visAnim2Cor1=p.anim2Cor1||'#00d4ff';
    visAnim2Cor2=p.anim2Cor2||'#00ff88';

    // Animação buttons — dual slot
    function initSlot(slot, animAtual){
        const wrap=document.getElementById(`anim${slot}-cores-wrap`);
        document.querySelectorAll(`.anim-btn[data-slot="${slot}"]`).forEach(btn=>{
            if(btn.dataset.anim===animAtual)btn.classList.add('active');
            btn.addEventListener('click',()=>{
                document.querySelectorAll(`.anim-btn[data-slot="${slot}"]`).forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                if(slot===1) visAnimacao=btn.dataset.anim;
                else visAnimacao2=btn.dataset.anim;
                if(wrap) wrap.style.display=btn.dataset.anim==='nenhuma'?'none':'block';
                if(typeof atualizarPreview==='function') atualizarPreview();
            });
        });
        if(wrap) wrap.style.display=animAtual==='nenhuma'?'none':'block';

        // Color buttons for this slot
        const c1id=`anim${slot}-c1-custom`, c2id=`anim${slot}-c2-custom`;
        const c1el=document.getElementById(c1id), c2el=document.getElementById(c2id);
        const getCor1=()=>slot===1?visAnimCor1:visAnim2Cor1;
        const getCor2=()=>slot===1?visAnimCor2:visAnim2Cor2;
        const setCor1=(v)=>slot===1?(visAnimCor1=v):(visAnim2Cor1=v);
        const setCor2=(v)=>slot===1?(visAnimCor2=v):(visAnim2Cor2=v);

        if(c1el){c1el.value=getCor1();c1el.addEventListener('input',e=>{setCor1(e.target.value);document.querySelectorAll(`.anim-cor-btn[data-slot="${slot}"][data-campo="c1"]`).forEach(b=>b.classList.remove('active'));});}
        if(c2el){c2el.value=getCor2();c2el.addEventListener('input',e=>{setCor2(e.target.value);document.querySelectorAll(`.anim-cor-btn[data-slot="${slot}"][data-campo="c2"]`).forEach(b=>b.classList.remove('active'));});}

        document.querySelectorAll(`.anim-cor-btn[data-slot="${slot}"]`).forEach(btn=>{
            const campo=btn.dataset.campo;
            const cor=campo==='c1'?getCor1():getCor2();
            if(btn.dataset.cor===cor) btn.classList.add('active');
            btn.addEventListener('click',()=>{
                document.querySelectorAll(`.anim-cor-btn[data-slot="${slot}"][data-campo="${campo}"]`).forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
                if(campo==='c1'){setCor1(btn.dataset.cor);if(c1el)c1el.value=btn.dataset.cor;}
                else{setCor2(btn.dataset.cor);if(c2el)c2el.value=btn.dataset.cor;}
            });
        });
    }
    initSlot(1, visAnimacao);
    initSlot(2, visAnimacao2);

    // Animação buttons
    // Animação buttons
    const animCoresWrap=document.getElementById('anim-cores-wrap');
    document.querySelectorAll('.anim-btn').forEach(btn=>{
        if(btn.dataset.anim===visAnimacao)btn.classList.add('active');
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.anim-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            visAnimacao=btn.dataset.anim;
            if(animCoresWrap)animCoresWrap.style.display=visAnimacao==='nenhuma'?'none':'block';
        });
    });
    if(animCoresWrap)animCoresWrap.style.display=visAnimacao==='nenhuma'?'none':'block';

    // Cor 1
    const c1=document.getElementById('anim-cor1-custom');
    if(c1){c1.value=visAnimCor1;c1.addEventListener('input',e=>{visAnimCor1=e.target.value;document.querySelectorAll('.anim-cor-btn[data-campo="anim1"]').forEach(b=>b.classList.remove('active'));});}
    // Cor 2
    const c2=document.getElementById('anim-cor2-custom');
    if(c2){c2.value=visAnimCor2;c2.addEventListener('input',e=>{visAnimCor2=e.target.value;document.querySelectorAll('.anim-cor-btn[data-campo="anim2"]').forEach(b=>b.classList.remove('active'));});}

    document.querySelectorAll('.anim-cor-btn').forEach(btn=>{
        const campo=btn.dataset.campo;
        if((campo==='anim1'&&btn.dataset.cor===visAnimCor1)||(campo==='anim2'&&btn.dataset.cor===visAnimCor2))btn.classList.add('active');
        btn.addEventListener('click',()=>{
            document.querySelectorAll(`.anim-cor-btn[data-campo="${campo}"]`).forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            if(campo==='anim1'){visAnimCor1=btn.dataset.cor;if(c1)c1.value=visAnimCor1;}
            else{visAnimCor2=btn.dataset.cor;if(c2)c2.value=visAnimCor2;}
        });
    });
    const ni=document.getElementById('vis-nome');
    if(ni){ni.value=visNome;ni.addEventListener('input',e=>{visNome=e.target.value;renderLetraEditor();atualizarPreview();});}
    const mi=document.getElementById('vis-msg');
    if(mi){mi.value=visMsgBV;mi.addEventListener('input',e=>{visMsgBV=e.target.value;atualizarPreview();});}
    document.getElementById('vis-fonte').value=visFonte;
    document.getElementById('vis-tamanho').value=visTamanho;
    document.getElementById('vis-tamanho-val').textContent=visTamanho;
    document.getElementById('vis-pole').checked=visPole;

    // Logo file input (removido — opção de logo desativada)

    // Fundo
    atualizarFundoOpts();
    document.querySelectorAll('.fundo-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.fundo-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            visFundo=btn.dataset.fundo;
            atualizarFundoOpts();
            atualizarPreview();
        });
        if(btn.dataset.fundo===visFundo)btn.classList.add('active');
        else btn.classList.remove('active');
    });
    const fc1=document.getElementById('vis-fundo-cor1');
    if(fc1){fc1.value=visFundoCor1;fc1.addEventListener('input',e=>{visFundoCor1=e.target.value;atualizarPreview();});}
    const fg1=document.getElementById('vis-fundo-grad1');
    if(fg1){fg1.value=visFundoGrad1;fg1.addEventListener('input',e=>{visFundoGrad1=e.target.value;atualizarPreview();});}
    const fg2=document.getElementById('vis-fundo-grad2');
    if(fg2){fg2.value=visFundoGrad2;fg2.addEventListener('input',e=>{visFundoGrad2=e.target.value;atualizarPreview();});}

    // Temas
    document.querySelectorAll('.tema-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            const t=TEMAS[btn.dataset.tema];if(!t)return;
            visFonte=t.fonte||'';
            visBtnCor=t.btnCor||'#00d4ff';
            visFundo=t.fundo||'foto';
            visFundoCor1=t.fundoCor1||'#0a0e14';
            visFundoGrad1=t.fundoGrad1||'#0a0e14';
            visFundoGrad2=t.fundoGrad2||'#1a2838';
            coresPorLetra={};
            // Atualiza controles
            document.getElementById('vis-fonte').value=visFonte;
            document.getElementById('btn-cor-custom').value=visBtnCor;
            document.querySelectorAll('.fundo-btn').forEach(b=>b.classList.toggle('active',b.dataset.fundo===visFundo));
            atualizarFundoOpts();
            renderLetraEditor();
            atualizarPreview();
            document.querySelectorAll('.tema-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            toast('Tema aplicado! Personalize à vontade.');
        });
    });

    // Cor do botão
    document.getElementById('btn-cor-custom').value=visBtnCor;
    document.querySelectorAll('.btn-cor-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.btn-cor-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            visBtnCor=btn.dataset.cor;
            document.getElementById('btn-cor-custom').value=visBtnCor;
            atualizarPreview();
        });
        if(btn.dataset.cor===visBtnCor)btn.classList.add('active');
    });
    document.getElementById('btn-cor-custom').addEventListener('input',e=>{
        visBtnCor=e.target.value;
        document.querySelectorAll('.btn-cor-btn').forEach(b=>b.classList.remove('active'));
        atualizarPreview();
    });

    // Emoji
    document.querySelectorAll('.emoji-btn').forEach(btn=>{
        if(btn.dataset.emoji===visIcone)btn.classList.add('active');
        btn.addEventListener('click',()=>{
            document.querySelectorAll('.emoji-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            visIcone=btn.dataset.emoji;
            if(visIcone)visPole=false,document.getElementById('vis-pole').checked=false;
            atualizarPreview();
        });
    });
    document.getElementById('vis-pole').addEventListener('change',e=>{
        visPole=e.target.checked;
        if(visPole){visIcone='';document.querySelectorAll('.emoji-btn').forEach(b=>b.classList.remove('active'));}
        atualizarPreview();
    });
    document.getElementById('vis-fonte').addEventListener('change',e=>{visFonte=e.target.value;atualizarPreview();});
    document.getElementById('vis-tamanho').addEventListener('input',e=>{
        visTamanho=parseFloat(e.target.value);
        document.getElementById('vis-tamanho-val').textContent=visTamanho.toFixed(1);
        atualizarPreview();
    });

    // Cores por letra
    document.querySelectorAll('.letra-cor-btn').forEach(btn=>{
        btn.addEventListener('click',()=>aplicarCorLetra(btn.dataset.cor));
    });
    document.getElementById('letra-cor-custom').addEventListener('input',e=>aplicarCorLetra(e.target.value));

    // Salvar
    document.getElementById('btn-salvar-visual').addEventListener('click',async()=>{
        const personalizacao={
            nomeCliente:visNome,fonte:visFonte,tamanho:visTamanho,
            icone:visIcone,barberpole:visPole,coresPorLetra,
            btnCor:visBtnCor,fundo:visFundo,temaCard:visTemaCard,
            animacao:visAnimacao,animCor1:visAnimCor1,animCor2:visAnimCor2,
            animacao2:visAnimacao2,anim2Cor1:visAnim2Cor1,anim2Cor2:visAnim2Cor2,
            fundoCor1:visFundoCor1,fundoGrad1:visFundoGrad1,fundoGrad2:visFundoGrad2,
            msgBoasVindas:visMsgBV,logo:visLogo
        };
        await updateDoc(doc(db,'barbeiros',barbeiroData.uid),{personalizacao,nome:visNome||barbeiroData.nome});
        barbeiroData.personalizacao=personalizacao;
        toast('✓ Visual salvo! Clientes já veem as mudanças.');
    });

    renderLetraEditor();
    atualizarPreview();
}

function atualizarFundoOpts(){
    const cor=document.getElementById('fundo-cor-opts');
    const grad=document.getElementById('fundo-grad-opts');
    if(cor)cor.style.display=visFundo==='cor'?'block':'none';
    if(grad)grad.style.display=visFundo==='gradiente'?'block':'none';
}

function renderLetraEditor(){
    const editor=document.getElementById('letra-editor');
    if(!editor)return;
    const nome=(visNome||'NOME').toUpperCase();
    editor.innerHTML='';
    [...nome].forEach((ch,i)=>{
        if(ch===' '){const sp=document.createElement('div');sp.style.width='10px';editor.appendChild(sp);return;}
        const btn=document.createElement('div');
        btn.className='letra-chip'+(letraSelecionada===i?' selected':'');
        btn.textContent=ch;
        const cor=coresPorLetra[i]||COR_PADRAO;
        btn.style.color=cor;btn.style.textShadow=`0 0 10px ${cor}88`;
        if(visFonte)btn.style.fontFamily=`'${visFonte}',sans-serif`;
        btn.dataset.idx=i;
        btn.addEventListener('click',()=>{
            letraSelecionada=letraSelecionada===i?null:i;
            document.getElementById('letra-sel-info').textContent=letraSelecionada!==null?`"${ch}" (posição ${i+1})`:'nenhuma';
            renderLetraEditor();
        });
        editor.appendChild(btn);
    });
}

function aplicarCorLetra(cor){
    if(letraSelecionada===null){toast('Selecione uma letra primeiro','var(--yellow)');return;}
    coresPorLetra[letraSelecionada]=cor;
    renderLetraEditor();atualizarPreview();
}

function atualizarPreview(){
    // Phone BG
    const bg=document.getElementById('phone-bg');
    const ov=document.getElementById('phone-overlay');
    const GRADIENTE_PADRAO_PREV='radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,180,255,0.18) 0%, transparent 55%),radial-gradient(ellipse 60% 40% at 15% 85%, rgba(0,212,255,0.12) 0%, transparent 60%),radial-gradient(ellipse 60% 40% at 85% 85%, rgba(0,150,220,0.10) 0%, transparent 60%),linear-gradient(180deg, #060a12 0%, #0a1018 25%, #0d1622 50%, #081018 75%, #04070c 100%)';
    if(bg&&ov){
        if(visFundo==='foto'){bg.style.backgroundImage='none';bg.style.background=GRADIENTE_PADRAO_PREV;}
        else if(visFundo==='cor'){bg.style.backgroundImage='none';bg.style.background=visFundoCor1;}
        else{bg.style.backgroundImage='none';bg.style.background=`linear-gradient(135deg,${visFundoGrad1},${visFundoGrad2})`;}
    }

    // Phone nome
    const ph=document.getElementById('ph-nome');
    if(ph){
        const nome=(visNome||barbeiroData.nome||'BARBEARIA').toUpperCase();
        ph.innerHTML=[...nome].map((ch,i)=>{
            if(ch===' ')return '<span style="display:inline-block;width:.3em"> </span>';
            const cor=coresPorLetra[i]||COR_PADRAO;
            return `<span style="color:${cor};text-shadow:0 0 8px ${cor}88">${ch}</span>`;
        }).join('');
        ph.style.fontSize=Math.min(visTamanho*0.38,1.1)+'rem';
        if(visFonte){
            const lk=document.getElementById('font-ph-lk')||document.createElement('link');
            lk.id='font-ph-lk';lk.rel='stylesheet';
            lk.href=`https://fonts.googleapis.com/css2?family=${visFonte.replace(/ /g,'+')}:wght@700;900&display=swap`;
            document.head.appendChild(lk);
            ph.style.fontFamily=`'${visFonte}',sans-serif`;
        } else ph.style.fontFamily='';
    }

    // Msg
    const msg=document.getElementById('ph-msg');
    if(msg){msg.textContent=visMsgBV;msg.style.display=visMsgBV?'block':'none';}

    // Btn preview
    const btn=document.getElementById('ph-btn');
    if(btn){btn.style.borderColor=visBtnCor;btn.style.color=visBtnCor;}
    const btnSample=document.getElementById('prev-btn-sample');
    if(btnSample){btnSample.style.borderColor=visBtnCor;btnSample.style.color=visBtnCor;}

    // Pole/icon/logo
    const phPole=document.getElementById('ph-pole');
    const phIcon=document.getElementById('ph-icone');
    if(phPole)phPole.style.display=visPole?'block':'none';
    if(phIcon){
        if(visLogo){phIcon.innerHTML=`<img src="${visLogo}" style="width:36px;height:36px;object-fit:cover;border-radius:6px">`;phIcon.style.display='block';}
        else{phIcon.textContent=visIcone;phIcon.style.display=visIcone?'block':'none';}
    }

    // Badge de efeito no preview
    const badge=document.getElementById('ph-efeito-badge');
    const phoneBg=document.getElementById('phone-bg');
    const phoneScreen=document.getElementById('phone-screen');
    const EFMAP={
        'nenhuma':     {label:'',     bg:''},
        'particulas':  {label:'✨ Partículas',   bg:'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,180,255,0.35) 0%, transparent 55%),linear-gradient(180deg,#060a12,#0d1622)'},
        'onda_plasma': {label:'🌊 Onda de Plasma', bg:'linear-gradient(135deg,rgba(0,212,255,.3),rgba(0,255,136,.2),rgba(0,212,255,.3))'},
        'hexagonal':   {label:'🔲 Matrix Hexagonal',bg:'repeating-linear-gradient(60deg,rgba(0,212,255,.07) 0,rgba(0,212,255,.07) 1px,transparent 0,transparent 50%),repeating-linear-gradient(120deg,rgba(0,212,255,.07) 0,rgba(0,212,255,.07) 1px,transparent 0,transparent 50%)'},
        'constelacao': {label:'💫 Constelação',  bg:'radial-gradient(circle at 20% 30%,rgba(0,212,255,.25) 0,transparent 40%),radial-gradient(circle at 80% 70%,rgba(0,255,136,.2) 0,transparent 40%),linear-gradient(180deg,#060a12,#0d1622)'},
        'chamas':      {label:'🔥 Chamas Neon',  bg:'linear-gradient(to top,rgba(255,75,43,.4) 0%,rgba(245,166,35,.2) 40%,transparent 70%)'},
        'raios':       {label:'⚡ Raios',         bg:'linear-gradient(135deg,rgba(0,212,255,.15) 0%,rgba(255,255,255,.05) 50%,rgba(0,212,255,.15) 100%)'},
        'galaxia':     {label:'🌌 Galáxia',      bg:'radial-gradient(ellipse at center,rgba(168,85,247,.3) 0%,rgba(0,0,0,0) 60%),radial-gradient(ellipse 60% 40% at 80% 20%,rgba(0,212,255,.2) 0%,transparent 50%),linear-gradient(180deg,#060a12,#0d1622)'},
        'barberpole_rain':{label:'💈 Barberpole Rain',bg:'repeating-linear-gradient(-45deg,rgba(204,0,0,.2) 0,rgba(204,0,0,.2) 4px,rgba(255,255,255,.1) 4px,rgba(255,255,255,.1) 8px,rgba(0,68,204,.2) 8px,rgba(0,68,204,.2) 12px,rgba(255,255,255,.1) 12px,rgba(255,255,255,.1) 16px)'},
    };
    const ef1=EFMAP[visAnimacao]||EFMAP['nenhuma'];
    const ef2=EFMAP[visAnimacao2]||EFMAP['nenhuma'];
    const efLabel=[ef1.label,ef2.label&&ef2.label!==ef1.label?ef2.label:''].filter(Boolean).join(' + ');
    if(badge){badge.textContent=efLabel;badge.style.display=efLabel?'block':'none';}
    // Aplica overlay de efeito no bg do phone
    if(phoneBg){
        let bgExtra='';
        if(ef1.bg) bgExtra=ef1.bg;
        if(ef2.bg&&ef2.bg!==ef1.bg) bgExtra=bgExtra?(bgExtra+','+ef2.bg):ef2.bg;
        const BASE_BG='radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,180,255,0.18) 0%, transparent 55%),linear-gradient(180deg, #060a12 0%, #0d1622 50%, #04070c 100%)';
        if(visFundo==='foto'){phoneBg.style.background=(bgExtra?bgExtra+',':'')+BASE_BG;}
        else if(visFundo==='cor'){phoneBg.style.background=(bgExtra?bgExtra+',':'')+visFundoCor1;}
        else{phoneBg.style.background=(bgExtra?bgExtra+',':'')+`linear-gradient(135deg,${visFundoGrad1},${visFundoGrad2})`;}
    }

    // Prev do editor de letras também
    const prev=document.getElementById('prev-nome');
    if(prev){
        const nome=(visNome||barbeiroData.nome||'NOME').toUpperCase();
        prev.innerHTML=[...nome].map((ch,i)=>{
            if(ch===' ')return '<span style="display:inline-block;width:.35em"> </span>';
            const cor=coresPorLetra[i]||COR_PADRAO;
            return `<span style="color:${cor};text-shadow:0 0 12px ${cor}88">${ch}</span>`;
        }).join('');
    }
}
