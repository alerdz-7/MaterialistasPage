const functions = require("firebase-functions");
const admin = require("firebase-admin");
const ExcelJS = require("exceljs");
const { v4: uuidv4 } = require("uuid");

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

exports.export311ToXlsx = functions.https.onCall(async (data, context) => {
  const kb   = data?.kb   || "HA";
  const line = data?.line || "L17";

  // 1) Leer la 311 actual desde Firestore
  const docRef = db.doc(`KB/${kb}/lines/${line}/mp311/current`);
  const snap = await docRef.get();
  const items = snap.exists ? (snap.data().items || {}) : {};

  // Nada para exportar
  if (!Object.keys(items).length) {
    return { ok: true, inserted: 0, url: null, message: "Sin materiales" };
  }

  // 2) Crear workbook
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("311");

  // Encabezados
  ws.columns = [
    { header: "NumeroParte", key: "NumeroParte", width: 30 },
    { header: "Cantidad",    key: "Cantidad",    width: 14 },
    { header: "FechaISO",    key: "FechaISO",    width: 25 },
    { header: "KB",          key: "KB",          width: 10 },
    { header: "Linea",       key: "Linea",       width: 10 }
  ];

  const nowISO = new Date().toISOString();

  // 3) Agregar filas
  Object.entries(items)
    .sort((a,b)=> a[0].localeCompare(b[0]))
    .forEach(([num, qty]) => {
      ws.addRow({
        NumeroParte: num,
        Cantidad: Number(qty) || 0,
        FechaISO: nowISO,
        KB: kb,
        Linea: line
      });
    });

  // Formato sencillo de header
  ws.getRow(1).font = { bold: true };

  // 4) Guardar en Storage (con token de descarga)
  const fileName = `exports/311/${kb}/${line}/311_${kb}_${line}_${Date.now()}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();

  const token = uuidv4();
  await bucket.file(fileName).save(buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    metadata: {
      cacheControl: "no-cache",
      metadata: { firebaseStorageDownloadTokens: token }
    }
  });

  // 5) Crear URL de descarga pública (firmada con token)
  const encoded = encodeURIComponent(fileName);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;

  return { ok: true, inserted: Object.keys(items).length, url };
});
