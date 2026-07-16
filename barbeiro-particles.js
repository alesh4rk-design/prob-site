(function(){
    const cv=document.getElementById('particles-canvas');
    if(!cv)return;
    const ctx=cv.getContext('2d');
    let W,H;
    function resize(){W=cv.width=window.innerWidth;H=cv.height=window.innerHeight;}
    window.addEventListener('resize',resize);resize();

    let particlesAtivas=true;
    window.setParticlesVisible=(v)=>{
        particlesAtivas=v;
        cv.style.display=v?'block':'none';
    };

    const particles=Array.from({length:55},()=>({
        x:Math.random()*W,y:Math.random()*H,
        vx:(Math.random()-.5)*0.3,vy:-Math.random()*0.5-0.1,
        r:Math.random()*1.8+0.4,
        alpha:Math.random()*0.5+0.1,
        col:Math.random()>0.7?'0,255,136':'0,212,255',
        life:Math.random()
    }));
    const lines=Array.from({length:8},()=>({
        x:Math.random()*W,y:Math.random()*H,
        len:Math.random()*80+40,
        angle:Math.floor(Math.random()*3)*(Math.PI/3),
        alpha:Math.random()*0.18+0.04,
        speed:Math.random()*0.003+0.001
    }));
    function draw(){
        if(!particlesAtivas){requestAnimationFrame(draw);return;}
        ctx.clearRect(0,0,W,H);
        lines.forEach(l=>{
            l.angle+=l.speed;
            ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.angle);
            ctx.strokeStyle=`rgba(0,212,255,${l.alpha})`;ctx.lineWidth=0.8;
            ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(l.len,0);ctx.stroke();
            ctx.beginPath();ctx.moveTo(l.len,0);ctx.lineTo(l.len,l.len*0.4);ctx.stroke();
            ctx.beginPath();ctx.arc(l.len,0,1.5,0,Math.PI*2);
            ctx.fillStyle=`rgba(0,212,255,${l.alpha*2})`;ctx.fill();
            ctx.restore();
        });
        particles.forEach(p=>{
            p.x+=p.vx;p.y+=p.vy;p.life+=0.005;
            if(p.y<-5||p.life>1){p.x=Math.random()*W;p.y=H+5;p.life=0;p.alpha=Math.random()*0.5+0.1;}
            const a=p.alpha*(1-p.life*0.5);
            ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
            ctx.fillStyle=`rgba(${p.col},${a})`;
            ctx.shadowColor=`rgba(${p.col},0.8)`;ctx.shadowBlur=4;
            ctx.fill();ctx.shadowBlur=0;
        });
        if(Math.random()<0.003){
            ctx.beginPath();ctx.moveTo(0,Math.random()*H*0.6);ctx.lineTo(W,Math.random()*H*0.6);
            ctx.strokeStyle='rgba(0,212,255,0.1)';ctx.lineWidth=1;ctx.stroke();
        }
        requestAnimationFrame(draw);
    }
    draw();
})();
