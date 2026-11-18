(async()=>{const O="https://aeroubg.com/";try{if(!document.querySelector("base")){const b=document.createElement("base");b.href=O;document.head.appendChild(b)}
history.replaceState(null,"","#/");const d=new DOMParser().parseFromString(await (await fetch(O,{cache:"no-store"})).text(),"text/html");
d.head.querySelectorAll('link[rel="stylesheet"],link[rel="modulepreload"],style,meta[name="viewport"]').forEach(e=>document.head.appendChild(e.cloneNode(true)));
document.body.innerHTML=d.body.innerHTML.replace(/<script[\s\S]*?<\/script>/gi,"");
for(const s of d.querySelectorAll("script")){const n=document.createElement("script");for(const a of s.attributes)n.setAttribute(a.name,a.value);if(!s.src)n.textContent=s.textContent;document.body.appendChild(n);await new Promise(r=>s.src&&s.type!=="module"?(n.onload=n.onerror=r):r())}}
catch(e){document.body.textContent="Couldn't reach aero. Check your connection."}})();
