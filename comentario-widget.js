// comentario-widget.js  – Widget de comentarios con historial (últimos 10)
// Usa Firebase v9 modular y NO depende de Font Awesome.

// ---- Imports ----
import { db } from "./firebase-config.js";
import {
  doc, setDoc, onSnapshot, addDoc, collection, query, orderBy, limit,
  getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ---- Parámetros kb / línea desde la URL ----
const p   = new URLSearchParams(location.search);
const KB  = p.get("kb")   || "HA";
const LINE= p.get("line") || "L17";

// ---- Estilos inyectados ----
const css = document.createElement("style");
css.textContent = `
  .chat-fab{position:fixed;left:26px;bottom:26px;z-index:900;display:flex;align-items:center}
  .chat-btn{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;
            background:#0d8e8a;color:#fff;border:none;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:26px;cursor:pointer}
  .chat-badge{position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#ff5a5a;border-radius:50%;
              border:2px solid #07212f;display:none}
  .chat-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:1000}
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
  /* Historial */
  .hist-modal{position:fixed;inset:0;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;z-index:1001}
  .hist-card{width:min(820px,94vw);max-height:84vh;overflow:auto;background:#0f2533;border-radius:14px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
  .hist-list{display:flex;flex-direction:column;gap:10px}
  .hist-item{background:#0b1d2a;border-radius:10px;padding:10px}
  .hist-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px}
  .copy{background:#213444;color:#fff;border:none;border-radius:10px;padding:6px 10px;cursor:pointer}
`;
document.head.appendChild(css);

// ---- UI: botón flotante ----
const fab = document.createElement("div");
fab.className = "chat-fab";
fab.innerHTML = `
  <button class="chat-btn" id="cmtBtn" title="Comentario">💬
    <span class="chat-badge" id="cmtBadge"></span>
  </button>
`;
document.body.appendChild(fab);

// ---- UI: modal principal ----
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

// ---- UI: modal historial ----
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

// ---- Firestore refs ----
const base = ["KB", KB, "lines", LINE];
const stateRef    = doc(db, ...base, "comment", "state");
const historyColl = collection(db, ...base, "comment_history");

// ---- Elements ----
const badge = document.getElementById("cmtBadge");
const txt   = document.getElementById("cmtText");
const time  = document.getElementById("cmtTime");

// ---- Snapshot en vivo del comentario actual ----
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

// ---- Abrir/cerrar ----
document.getElementById("cmtBtn").onclick   = ()=> modal.style.display = "flex";
document.getElementById("cmtClose").onclick = ()=> modal.style.display = "none";
modal.addEventListener("click", e=>{ if(e.target===modal) modal.style.display = "none"; });

// ---- Guardar (y registrar en historial) ----
document.getElementById("cmtSave").onclick = async ()=>{
  const text = (txt.value||"").trim();
  await setDoc(stateRef, { text, updatedAt: serverTimestamp() }, { merge:true });
  await addDoc(historyColl, { text, createdAt: serverTimestamp(), action: "saved" });
  modal.style.display = "none";
};

// ---- Borrar (y registrar en historial) ----
document.getElementById("cmtDelete").onclick = async ()=>{
  await setDoc(stateRef, { text:"", updatedAt: serverTimestamp() }, { merge:true });
  await addDoc(historyColl, { text:"", createdAt: serverTimestamp(), action: "deleted" });
  modal.style.display = "none";
};

// ---- Historial (últimos 10) ----
const histList = document.getElementById("histList");
const histClose= document.getElementById("histClose");
document.getElementById("cmtHist").onclick = async ()=>{
  const q = query(historyColl, orderBy("createdAt","desc"), limit(10));
  const snap = await getDocs(q);
  histList.innerHTML = "";
  snap.forEach(s=>{
    const d  = s.data() || {};
    const ts = d.createdAt?.toDate?.();
    const when = ts
      ? `${ts.toLocaleDateString("es-MX")} — ${ts.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit",hour12:true})}`
      : "(sin fecha)";
    const text = (d.text||"").trim();
    const label = d.action==="deleted" && !text ? "(borrado)" : text || "(vacío)";
    const item = document.createElement("div");
    item.className = "hist-item";
    item.innerHTML = `
      <div class="hist-head">
        <div class="tiny" style="margin:0">${when}</div>
        <button class="copy">Copiar</button>
      </div>
      <pre style="margin:0;color:#bfe9e3;white-space:pre-wrap">${label}</pre>
    `;
    item.querySelector(".copy").onclick = async ()=>{
      try{ await navigator.clipboard.writeText(label); alert("Copiado."); }catch(e){ alert("No se pudo copiar"); }
    };
    histList.appendChild(item);
  });
  hmodal.style.display="flex";
};
histClose.onclick = ()=> hmodal.style.display="none";
hmodal.addEventListener("click", e=>{ if(e.target===hmodal) hmodal.style.display="none"; });
