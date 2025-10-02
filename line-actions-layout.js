// line-actions-layout.js — pone RETORNO / 311 / AGREGAR MODELO en columna fija derecha
(function(){
  // 1) localizar botones por texto
  const all = Array.from(document.querySelectorAll("button, a"));
  const byText = (re) => all.find(el => re.test((el.textContent||"").trim().toUpperCase()));
  const btnRet   = byText(/^RETORNO$/);
  const btn311   = byText(/^311$/);
  const btnAdd   = all.find(el => /AGREGAR\s+MODELO/i.test(el.textContent||""));

  if (!btnRet && !btn311 && !btnAdd) return;

  // 2) crear la columna fija
  const stack = document.createElement("div");
  stack.className = "tools-stack";
  if (btnRet) stack.appendChild(btnRet);
  if (btn311) stack.appendChild(btn311);
  if (btnAdd) stack.appendChild(btnAdd);
  document.body.appendChild(stack);

  // 3) Estilos y "zona segura" para que los modelos no queden debajo
  const css = document.createElement("style");
  css.textContent = `
    .tools-stack{
      position: fixed; right: 10px; top: 110px;
      display: flex; flex-direction: column; gap: 12px; z-index: 700;
    }
    /* en móviles, bajamos un poco y pegamos al borde */
    @media (max-width: 840px){
      .tools-stack{ right: 8px; top: 96px; gap: 10px; }
    }
  `;
  document.head.appendChild(css);

  // deja espacio a la derecha del contenido para que no lo tapen
  const pad = () => {
    const pr = (window.innerWidth > 840) ? 150 : 120;
    ["main",".wrap",".container",".content"].forEach(sel=>{
      const el = document.querySelector(sel);
      if (el) el.style.paddingRight = pr + "px";
    });
  };
  pad();
  window.addEventListener("resize", pad);
})();
