// The Diensten phone block (rotary phone): one script for every page that carries it (/ai-marketing-bureau, the 404 page).
// Pick a service on the dial (hover and click, or tap and tap again); ringing the phone asks for the demo, e-mail first, then the
// booking. It never starts a call and reads no cookie choice. Styles: /assets/css/phone-block.css.
(function(){
  var block=document.querySelector('[data-phone-block]');
  if(!block)return;
  var d={
    seo:{t:'SEO & VINDBAARHEID',d:'Gevonden worden op Google en in ChatGPT',n:'SEO'},
    chatbot:{t:'AI CHATBOT',d:'24/7 leadopvang op je website',n:'AI chatbot'},
    voice:{t:'VOICE AI',d:'AI telefonist die elk gesprek opneemt',n:'Voice AI'},
    reviews:{t:'REVIEW MANAGEMENT',d:'5-sterren reviews op autopilot',n:'review management'},
    auto:{t:'AUTOMATISERING',d:'N8N workflows en AI-systemen',n:'automatisering'},
    website:{t:'WEBSITE LATEN MAKEN',d:'SEO-geoptimaliseerd, live in 2 weken',n:'een nieuwe website'},
    herinner:{t:'HERINNERINGEN',d:'50-70% minder no-shows',n:'herinneringen'}
  };
  var $=function(id){return document.getElementById(id);};
  var overlay=block.querySelector('.game-overlay'),gT=$('gT'),gD=$('gD'),gGo=$('gGo'),form=$('demoAsk'),book=$('demoBook'),hang=$('demoHangup'),err=$('demoError');
  var plate=$('plate'),wrap=$('wrap'),phone=$('phoneBody'),video=$('phoneVideo');
  var picked=null,calling=false,touch=false;
  // What the bubble says at rest is the page's own text: it is read from the markup once and put back after every pick.
  var restT=gT.textContent.trim(),restD=gD.textContent.trim();

  function humanType(el,text,onDone){
    if(el._t){clearTimeout(el._t);el._t=null;}
    var out='',pos=0,mistakes=0,typos=el===gT;
    function step(){
      if(pos>=text.length&&mistakes<=0){el.innerHTML=out+(typos?'<span class="cur"></span>':'');if(onDone)onDone();return;}
      if(mistakes>0){out=out.slice(0,-1);mistakes--;el.innerHTML=out+'<span class="cur"></span>';el._t=setTimeout(step,55);return;}
      if(typos&&pos>2&&Math.random()<0.15){var wrong='QWRTYPSDFJKLZXCVBN';var n=1+Math.floor(Math.random()*2);for(var t=0;t<n;t++)out+=wrong[Math.floor(Math.random()*wrong.length)];mistakes=n;el.innerHTML=out+'<span class="cur"></span>';el._t=setTimeout(step,300);return;}
      out+=text[pos];pos++;el.innerHTML=out+'<span class="cur"></span>';
      var delay=(typos?35:18)+Math.random()*(typos?45:22);if(text[pos-1]===' ')delay+=typos?40:10;
      el._t=setTimeout(step,delay);
    }
    el.innerHTML='<span class="cur"></span>';el._t=setTimeout(step,100);
  }
  function stopTyping(){[gT,gD].forEach(function(el){if(el._t){clearTimeout(el._t);el._t=null;}});}
  function hideActions(){gGo.style.display='none';form.style.display='none';book.style.display='none';hang.style.display='none';err.textContent='';}

  // The dial: drag or let it turn slowly
  var a=0,drag=false,sA=0,sM=0,v=0,lA=0,raf,spin;
  function ma(e){var p=plate.getBoundingClientRect();var cx=p.left+p.width/2,cy=p.top+p.height/2;var x=(e.touches?e.touches[0].clientX:e.clientX)-cx;var y=(e.touches?e.touches[0].clientY:e.clientY)-cy;return Math.atan2(y,x)*180/Math.PI;}
  function turn(){plate.style.transform='translate(-50%,-50%) rotate('+a+'deg)';}
  function dn(e){if(e.target.closest('.rz')||e.target.closest('.l-hub'))return;drag=true;plate.classList.add('grabbing');sM=ma(e);sA=a;v=0;if(raf)cancelAnimationFrame(raf);stopSpin();e.preventDefault();}
  function mv(e){if(!drag)return;var m=ma(e);a=sA+(m-sM);v=a-lA;lA=a;turn();e.preventDefault();}
  function up(){if(!drag)return;drag=false;plate.classList.remove('grabbing');(function c(){if(Math.abs(v)<0.05){startSpin();return;}v*=0.97;a+=v;turn();raf=requestAnimationFrame(c);})();}
  plate.addEventListener('mousedown',dn);plate.addEventListener('touchstart',dn,{passive:false});
  window.addEventListener('mousemove',mv);window.addEventListener('touchmove',mv,{passive:false});
  window.addEventListener('mouseup',up);window.addEventListener('touchend',up);
  function startSpin(){if(spin||calling)return;spin=setInterval(function(){if(drag)return;a+=0.15;turn();},16);}
  function stopSpin(){clearInterval(spin);spin=null;}

  function restoreDefault(){
    if(calling)return;
    stopTyping();hideActions();
    block.querySelectorAll('.rz.on').forEach(function(z){z.classList.remove('on');});
    overlay.classList.add('visible');
    gT.innerHTML=restT+'<span class="cur"></span>';
    gD.textContent=restD;
    picked=null;startSpin();
  }
  // On a phone the bubble stands under the telephone: whatever it says after a tap is brought into view, never left below the screen.
  function reveal(){
    if(window.innerWidth>768)return;
    setTimeout(function(){
      var r=overlay.getBoundingClientRect(),vh=window.innerHeight;
      if(r.bottom>vh-8||r.top<64){
        var y=window.scrollY+(r.bottom>vh-8?r.bottom-vh+16:r.top-80);
        try{window.scrollTo({top:y,behavior:'smooth'});}catch(e){window.scrollTo(0,y);}
      }
    },60);
  }
  function show(z,withLink){
    if(calling)return;
    stopSpin();var t=d[z.dataset.t];if(!t)return;
    picked=z.dataset.t;hideActions();
    block.querySelectorAll('.rz.on').forEach(function(o){if(o!==z)o.classList.remove('on');});z.classList.add('on');
    overlay.classList.add('visible');humanType(gT,t.t);gD.textContent=t.d;
    if(withLink){gGo.href=z.getAttribute('href');gGo.textContent='Bekijk '+t.n;gGo.style.display='inline-block';}
    if(touch||withLink)reveal();
  }

  // Pick a service: hover or focus shows it and a click opens it; a tap shows it with its link, a second tap opens it.
  block.querySelectorAll('.rz').forEach(function(z){
    z.addEventListener('pointerdown',function(e){touch=e.pointerType==='touch'||e.pointerType==='pen';});
    z.addEventListener('mouseenter',function(){if(!touch)show(z,false);});
    z.addEventListener('mouseleave',function(){if(!touch)restoreDefault();});
    z.addEventListener('focus',function(){if(z.matches(':focus-visible'))show(z,true);});
    z.addEventListener('click',function(e){
      e.stopPropagation();
      if(calling){e.preventDefault();return;}
      if(touch&&picked!==z.dataset.t){e.preventDefault();show(z,true);}
    });
  });
  block.addEventListener('pointermove',function(e){if(e.pointerType==='mouse')touch=false;});
  var hub=block.querySelector('.l-hub');
  hub.addEventListener('mouseenter',function(){if(calling)return;stopSpin();hideActions();overlay.classList.add('visible');humanType(gT,hub.dataset.t||'STUDIOLEE HOME');gD.textContent=hub.dataset.d||'Terug naar de homepage';});
  hub.addEventListener('mouseleave',restoreDefault);

  // Ring the phone: it rings, the AI assistant answers and asks for the demo. E-mail first, then the booking; it never starts a call.
  function ring(){
    if(calling){hangUp();return;}
    var service=picked&&d[picked];
    calling=true;stopSpin();stopTyping();hideActions();
    if(video){video.style.display='block';var p=video.play();if(p&&p.catch)p.catch(function(){});}
    phone.classList.add('ringing');overlay.classList.add('visible');gD.textContent='';reveal();
    humanType(gT,'TUUT.. TUUT..',function(){
      setTimeout(function(){humanType(gD,'De telefoon gaat over...',function(){
        setTimeout(function(){
          phone.classList.remove('ringing');if(video){video.pause();video.style.display='none';}
          humanType(gT,'*KLIK* HOI!',function(){
            var line='Bedankt voor het bellen met StudioLee! Lee is er nu even niet. Ik ben zijn AI-assistent: laat je e-mailadres achter, dan plannen we '+(service?'een demo van '+service.n:'een demo')+' voor je in.';
            humanType(gD,line,function(){form.style.display='flex';hang.style.display='block';block.dataset.demoAsked=service?picked:'any';reveal();});
          });
        },900);
      });},500);
    });
  }
  function hangUp(){calling=false;phone.classList.remove('ringing');if(video){video.pause();video.style.display='none';}restoreDefault();}
  phone.addEventListener('click',function(e){e.stopPropagation();ring();});
  phone.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();ring();}});
  hang.addEventListener('click',function(e){e.stopPropagation();hangUp();});

  // The demo ask: only the live site sends it to the demo lead route; a preview never writes a real lead.
  var LIVE=/^(www\.)?studiolee\.nl$/.test(location.hostname);
  form.addEventListener('submit',function(e){
    e.preventDefault();err.textContent='';
    var email=form.email.value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){err.textContent='Vul een geldig e-mailadres in.';return;}
    if(!form.consent_contact.checked){err.textContent='Zet het vinkje, dan mogen we je over de demo mailen.';return;}
    var btn=form.querySelector('button');btn.disabled=true;btn.textContent='Even geduld...';
    var lead={email:email,site:'studiolee.nl',niche:'studiolee',source:'studiolee_phone_block',page:location.pathname,service:picked||'',
      website:form.website.value,consent_contact:true,consent_promotion:false,
      consent_text:'Ja, StudioLee mag me mailen over deze demo.',consent_version:'studiolee-phone-block-2026-11-13'};
    // After the e-mail the visitor plans the demo at once: the booking opens with the address already filled in.
    function done(note){
      form.style.display='none';
      try{var u=new URL(book.getAttribute('href'),location.href);u.searchParams.set('email',email);if(picked&&d[picked])u.searchParams.set('notes','Demo van '+d[picked].n);book.setAttribute('href',u.href);}catch(x){}
      humanType(gT,'TOP, GENOTEERD!');
      gD.textContent='Kies hieronder een moment voor je demo, je e-mailadres staat al ingevuld. Lukt dat nu niet? Dan mailen we je.'+(note||'');
      book.textContent='Plan mijn demo';
      book.style.display='inline-block';reveal();
    }
    if(!LIVE){done(' (Voorbeeld: niets verstuurd.)');return;}
    fetch('https://n8n.aireclamestudio.nl/webhook/eigen-site-demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lead)})
      .then(function(r){if(!r.ok)throw new Error();done('');})
      .catch(function(){btn.disabled=false;btn.textContent='Plan mijn demo';err.textContent='Versturen lukte niet. Probeer het opnieuw of kies hieronder direct een moment.';book.style.display='inline-block';});
  });

  startSpin();
})();
