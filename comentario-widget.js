// comentario-widget.js – Comentarios por KB/Línea (con historial)
import { db } from "./firebase-config.js";
import {
  doc, setDoc, onSnapshot, addDoc, collection, query, orderBy, limit,
  getDocs, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const p    = new URLSearchParams(location.search);
const KB   = (p.get("kb")   || "HA").trim();
const LINE = (p.get("line") || "L17").trim();

/* === Estilos (💬 siempre por ENCIMA del widget de cajas, con separación) === */
const css = document.createElement("style");
css.textContent = `
  :root{ --boxes-h:140px; --boxes-gap:18px; } /* altura estimada + separación */

  .chat-fab{
    position:fixed; left:16px;
    bottom: calc(16px + var(--boxes-h) + var(--boxes-gap)); /* SIEMPRE arriba del widget de cajas */
    z-index:1000; display:flex; align-items:center;
  }
  .chat-btn{position:relative;width:56px;height:56px;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            background:#0d8e8a;color:#fff;border:2px solid rgba(255,255,255,.9);
            box-shadow:0 10px 26px rgba(0,0,0,.28);font-size:26px;cursor:pointer}
  .chat-badge{position:absolute;top:-2px;right:-2px;width:12px;height:12px;background:#ff5a5a;border-radius:50%;
              border:2px solid #07212f;display:none}

  .chat-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:1001}
  .chat-card{width:min(720px,94vw);background:#0f2533;border-radius:14px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
  .chat-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px}
  .chat-h1{margin:0;color:#25b7a7}
  .chat-close{background:#213444;color:#fff;border:none;border-radius:10px;padding:8px 10px;cursor:pointer}
  .chat-text{width:100%;min-height:140px;border:none;outline:none;border-radius:10px;padding:12px;resize:vertical;font-size:1rem;background:#0b1d2a;color:#fff}
  .tiny{font-size:.9rem;opacity:.85;color:#9dd6cf;margin-top:6px}
  .chat-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}
  .btn{background:#0d8e8a;color:#fff;border:none;border-radius:10px;padding:10px 14px;cursor:pointer}
  .btn-danger{background:#c8463b}
  .btn-ghost{background:#213444}

  .hist-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:1002}
  .hist-card{width:min(820px,94vw);max-height:84vh;overflow:auto;background:#0f2533;border-radius:14px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
  .hist-list{display:flex;flex-direction:column;gap:10px}
  .hist-item{background:#0b1d2a;border-radius:10px;padding:10px}
  .hist-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}
  .copy{background:#213444;color:#fff;border:none;border-radius:10px;padding:6px 10px;cursor:pointer}
`;
document.head.appendChild(css);

/* === UI === */
const fab = document.createElement("div");
fab.className = "chat-fab";
fab.innerHTML = `
  <button class="chat-btn" id="cmtBtn" title="Comentario">💬
    <span class="chat-badge" id="cmtBadge"></span>
  </button>
`;
document.body.appendChild(fab);

const modal = document.createElement("div");
modal.className = "chat-modal";
modal.innerHTML = `
  <div class="chat-card">
    <div class="chat-head">
      <h3 class="chat-h1">Escribe un comentario en ${LINE}</h3>
      <button class="chat-close" id="cmtClose">Cerrar</button>
    </div>
    <textarea id="cmtText" class="chat-text" placeholder="Escribe un comentario para el siguiente turno..."></textarea>
    <div class="tiny" id="cmtTime"></div>
    <div class="chat-actions">
      <button class="btn btn-ghost" id="cmtHist">Historial</button>
      <button class="btn btn-danger" id="cmtDelete">Borrar</button>
      <button class="btn" id="cmtSave">Guardar</button>
    </div>
  </div>
`;
document.body.appendChild(modal);

const hmodal = document.createElement("div");
hmodal.className = "hist-modal";
hmodal.innerHTML = `
  <div class="hist-card">
    <div class="chat-head">
      <h3 class="chat-h1" style="margin:0">Historial de comentarios (últimos 10)</h3>
      <button class="chat-close" id="histClose">Cerrar</button>
    </div>
    <div class="hist-list" id="histList"></div>
  </div>
`;
document.body.appendChild(hmodal);

/* === Ajuste dinámico: tomamos la ALTURA real del widget de cajas para separar el 💬 */
function setBoxesHeight(px){
  const h = Math.max(0, Math.round(px || 140));
  document.documentElement.style.setProperty("--boxes-h", h + "px");
}
window.addEventListener("boxes:ready",  e=> setBoxesHeight(e.detail?.height));
window.addEventListener("boxes:resize", e=> setBoxesHeight(e.detail?.height));

/* === Firestore === */
const base = ["KB", KB, "lines", LINE];
const stateRef    = doc(db, ...base, "comment", "state");
const historyColl = collection(db, ...base, "comment_history");

const badge = document.getElementById("cmtBadge");
const txt   = document.getElementById("cmtText");
const time  = document.getElementById("cmtTime");

onSnapshot(stateRef, snap=>{
  const d = snap.data() || {};
  const text = d.text || "";
  const ts   = d.updatedAt?.toDate?.();
  badge.style.display = text ? "block" : "none";
  txt.value = text;
  time.textContent = ts
    ? `Actualizado el ${ts.toLocaleDateString("es-MX")} a las ${ts.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit",hour12:true})}`
    : "";
});

document.getElementById("cmtBtn").onclick   = ()=> modal.style.display = "flex";
document.getElementById("cmtClose").onclick = ()=> modal.style.display = "none";
modal.addEventListener("click", e=>{ if(e.target===modal) modal.style.display = "none"; });

document.getElementById("cmtSave").onclick = async ()=>{
  const text = (txt.value||"").trim();
  await setDoc(stateRef, { text, updatedAt: serverTimestamp() }, { merge:true });
  if (text){ await addDoc(historyColl, { text, createdAt: serverTimestamp() }); }
};

document.getElementById("cmtDelete").onclick = async ()=>{
  await setDoc(stateRef, { text:"", updatedAt: serverTimestamp() }, { merge:true });
};

const openHistory = async ()=>{
  const qy = query(historyColl, orderBy("createdAt","desc"), limit(10));
  const snap = await getDocs(qy);
  const items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  const list = document.getElementById("histList");
  if (!items.length){
    list.innerHTML = `<div class="tiny" style="opacity:.8;text-align:center">Sin registros todavía</div>`;
  } else {
    list.innerHTML = items.map(it=>{
      const when = it.createdAt?.toDate?.()?.toLocaleString?.("es-MX",{hour12:true}) || "";
      const body = (it.text||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      return `
        <div class="hist-item">
          <div class="hist-head">
            <div class="tiny">${when}</div>
            <button class="copy" data-id="${it.id}">Copiar</button>
          </div>
          <div>${body}</div>
        </div>
      `;
    }).join("");
  }
  hmodal.style.display = "flex";
};
document.getElementById("cmtHist").onclick  = openHistory;
document.getElementById("histClose").onclick= ()=> hmodal.style.display="none";
hmodal.addEventListener("click", e=>{ if(e.target===hmodal) hmodal.style.display="none"; });
