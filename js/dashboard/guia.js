// ══════════════════════════════════════════════════════════
// PRIMEIROS PASSOS — guia de configuração para quem acabou de chegar.
// Cada passo se marca sozinho olhando os dados de verdade (serviços
// cadastrados, horário salvo, WhatsApp preenchido...). Aparece numa janela
// de boas-vindas no primeiro acesso (logo depois do tour) e num cartão no
// topo da aba Agendamentos até tudo ficar pronto. "Não mostrar mais" fica
// guardado neste aparelho. Só para o dono (funcionário e recepcionista não veem).
// Script comum (não módulo): usa barbeiroData, $, ultimaListaAppts...
// ══════════════════════════════════════════════════════════

function chaveGuiaProb(k){ return 'prob_guia_'+k+'_'+((window.barbeiroData&&barbeiroData.uid)||''); }
function lerGuia(k){ try{ return localStorage.getItem(chaveGuiaProb(k)); }catch(e){ return null; } }
function marcarGuia(k){ try{ localStorage.setItem(chaveGuiaProb(k),'1'); }catch(e){} }

function passosGuiaProb(){
    const b=window.barbeiroData||{};
    const equipe=(b.equipe||[]).filter(x=>!x.independente);
    const agendouPeloLink=(typeof ultimaListaAppts!=='undefined'?ultimaListaAppts:[]).some(a=>!a.origem);
    return [
        { id:'perfil', tit:'Dados da barbearia', desc:'Nome e WhatsApp (é nele que você recebe o aviso de cada agendamento). Endereço e PIX são opcionais.',
          feito:!!(b.nome && b.whatsapp), aba:'perfil' },
        { id:'modo', tit:'Como você atende', desc:'Só com hora marcada, só por fila de espera ou os dois. Em Configurações.',
          feito:!!b.modoAtendimento || !!lerGuia('modo'), aba:'perfil' },
        { id:'horarios', tit:'Horário de funcionamento', desc:'Dias e horários em que a barbearia abre — só esses horários aparecem pro cliente.',
          feito:!!window.__funcionamentoConfigurado, aba:'horarios' },
        { id:'servicos', tit:'Cadastrar os serviços', desc:'Nome, preço e duração de cada serviço (corte, barba...). A duração define quanto tempo cada horário ocupa.',
          feito:(b.cortes||[]).length>0, aba:'cortes' },
        { id:'equipe', tit:'Equipe (se tiver)', desc:'Cadastre seus barbeiros e você mesmo como "Eu (dono)" se também corta. Trabalha sozinho? Pode marcar como feito.',
          feito:equipe.length>0 || !!lerGuia('sozinho'), aba:'equipe', alternativa:{rotulo:'Trabalho sozinho', marca:'sozinho'} },
        { id:'visual', tit:'Personalizar a tela do cliente (opcional)', desc:'Cores, nome e foto da sua barbearia na página de agendamento.',
          feito:!!b.personalizacao || !!lerGuia('visual'), aba:'visual' },
        { id:'link', tit:'Enviar o link para os clientes', desc:'Copie o link, mande no WhatsApp ou imprima o QR Code pra deixar no balcão.',
          feito:agendouPeloLink || !!lerGuia('link'), aba:'clientes' }
    ];
}

function htmlPassosGuia(passos){
    return passos.map((p,i)=>`
        <div style="display:flex;align-items:flex-start;gap:.7rem;padding:.65rem 0;${i?'border-top:1px solid var(--border)':''};${p.feito?'opacity:.65':''}">
            <div style="flex-shrink:0;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;${p.feito?'background:rgba(0,255,136,.15);color:var(--green);border:1.5px solid var(--green)':'background:var(--card);color:var(--blue);border:1.5px solid var(--blue)'}">${p.feito?'✓':i+1}</div>
            <div style="flex:1;min-width:0">
                <div style="font-size:.86rem;font-weight:700;${p.feito?'text-decoration:line-through':''}">${p.tit}</div>
                <div style="font-size:.74rem;color:var(--muted);line-height:1.4;margin-top:.1rem">${p.desc}</div>
            </div>
            ${p.feito
                ? '<span style="font-size:.72rem;color:var(--green);font-weight:700;flex-shrink:0">Feito</span>'
                : `<div style="display:flex;flex-direction:column;gap:.3rem;flex-shrink:0">
                    <button type="button" data-guia-ir="${p.aba}" style="padding:.35rem .65rem;background:rgba(0,212,255,.1);border:1.5px solid var(--blue);border-radius:8px;color:var(--blue);font-size:.72rem;font-weight:700;cursor:pointer;white-space:nowrap">Fazer agora</button>
                    ${p.alternativa?`<button type="button" data-guia-marca="${p.alternativa.marca}" style="padding:.3rem .55rem;background:transparent;border:1px solid var(--border);border-radius:8px;color:var(--muted);font-size:.68rem;cursor:pointer;white-space:nowrap">${p.alternativa.rotulo}</button>`:''}
                   </div>`}
        </div>`).join('');
}

function ligarAcoesGuia(raiz){
    raiz.querySelectorAll('[data-guia-ir]').forEach(btn=>btn.addEventListener('click',()=>{
        fecharGuiaProb();
        document.querySelector(`.tab[data-tab="${btn.dataset.guiaIr}"]`)?.click();
    }));
    raiz.querySelectorAll('[data-guia-marca]').forEach(btn=>btn.addEventListener('click',()=>{
        marcarGuia(btn.dataset.guiaMarca); atualizarGuiaProb();
    }));
}

let __guiaModalAbertoNestaSessao=false;
function atualizarGuiaProb(){
    if(window.__funcionarioMode || window.__recepcionista) return;
    const card=document.getElementById('guia-card');
    if(!card || !window.barbeiroData || !barbeiroData.uid) return;
    const passos=passosGuiaProb();
    const feitos=passos.filter(p=>p.feito).length;
    const completo=feitos===passos.length;
    if(lerGuia('dispensado') || completo){ card.style.display='none'; }
    else {
        card.style.display='block';
        document.getElementById('guia-progresso').textContent=`${feitos}/${passos.length}`;
        document.getElementById('guia-barra').style.width=Math.round(feitos/passos.length*100)+'%';
        const lista=document.getElementById('guia-lista-card');
        lista.innerHTML=htmlPassosGuia(passos);
        ligarAcoesGuia(lista);
    }
    const modal=document.getElementById('modal-guia');
    if(modal && modal.style.display==='flex'){
        const l=document.getElementById('guia-lista-modal'); l.innerHTML=htmlPassosGuia(passos); ligarAcoesGuia(l);
        document.getElementById('guia-progresso-modal').textContent=`${feitos} de ${passos.length} prontos`;
    }
}

function abrirGuiaProb(){
    const modal=document.getElementById('modal-guia');
    if(!modal) return;
    const passos=passosGuiaProb();
    const l=document.getElementById('guia-lista-modal'); l.innerHTML=htmlPassosGuia(passos); ligarAcoesGuia(l);
    document.getElementById('guia-progresso-modal').textContent=`${passos.filter(p=>p.feito).length} de ${passos.length} prontos`;
    modal.style.display='flex';
}
function fecharGuiaProb(){
    const modal=document.getElementById('modal-guia');
    if(modal) modal.style.display='none';
    marcarGuia('visto');
}

// Primeiro acesso: abre a janela uma vez, depois do tour (se o tour estiver
// rodando, espera ele terminar).
function abrirGuiaPrimeiroAcesso(){
    if(window.__funcionarioMode || window.__recepcionista) return;
    if(__guiaModalAbertoNestaSessao || lerGuia('visto') || lerGuia('dispensado')) return;
    const passos=passosGuiaProb();
    if(passos.every(p=>p.feito)) return;
    if(typeof tourAtivo!=='undefined' && tourAtivo){ setTimeout(abrirGuiaPrimeiroAcesso,1500); return; }
    __guiaModalAbertoNestaSessao=true;
    abrirGuiaProb();
}

function initGuia(){
    if(window.__guiaLigado) return;
    window.__guiaLigado=true;
    document.getElementById('btn-fechar-guia')?.addEventListener('click',fecharGuiaProb);
    document.getElementById('btn-entendi-guia')?.addEventListener('click',fecharGuiaProb);
    document.getElementById('btn-dispensar-guia')?.addEventListener('click',()=>{ marcarGuia('dispensado'); fecharGuiaProb(); atualizarGuiaProb(); });
    document.getElementById('btn-dispensar-guia-card')?.addEventListener('click',()=>{ marcarGuia('dispensado'); atualizarGuiaProb(); });
    document.getElementById('btn-abrir-guia')?.addEventListener('click',()=>{ document.getElementById('ajuda-menu').style.display='none'; abrirGuiaProb(); });
    document.getElementById('modal-guia')?.addEventListener('click',e=>{ if(e.target.id==='modal-guia') fecharGuiaProb(); });
    // Passos que dependem de ação (não de dado salvo): marca quando a pessoa faz
    ['btn-copy-link','btn-enviar-link-cliente-whatsapp','btn-gerar-qr-cliente'].forEach(id=>{
        document.getElementById(id)?.addEventListener('click',()=>{ marcarGuia('link'); atualizarGuiaProb(); });
    });
    document.querySelectorAll('.tab[data-tab="visual"]').forEach(t=>t.addEventListener('click',()=>{ marcarGuia('visual'); setTimeout(atualizarGuiaProb,300); }));
    atualizarGuiaProb();
    setTimeout(abrirGuiaPrimeiroAcesso,2500);
}

window.initGuia=initGuia;
window.atualizarGuiaProb=atualizarGuiaProb;
window.abrirGuiaProb=abrirGuiaProb;
