// functions/api/crear-orden-mantencion.js — Cloudflare Pages Function
// Operador crea una orden de mantención preventiva: genera token y envía link al técnico.
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_KEY, BREVO_API_KEY, EMAIL_FROM

import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function genToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function getFecha() {
  const d = new Date();
  return d.getFullYear().toString()
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: HEADERS });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: HEADERS });
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ error: 'Variables de entorno no configuradas' }), { status: 500, headers: HEADERS });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: HEADERS }); }

  const {
    terminalId, terminalNombre, clienteId, clienteNombre,
    asignadoNombre, asignadoEmail, fechaProgramada,
  } = body;

  if (!terminalNombre || !asignadoNombre || !asignadoEmail || !asignadoEmail.includes('@')) {
    return new Response(JSON.stringify({ error: 'Faltan campos: terminalNombre, asignadoNombre, asignadoEmail' }), { status: 400, headers: HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const fecha    = getFecha();
  const token    = genToken();

  // Contar órdenes del día para este terminal
  const prefijo = `MNT-${fecha}-`;
  const { count } = await supabase
    .from('mantenimientos')
    .select('id', { count: 'exact', head: true })
    .like('ticket', `${prefijo}%`);

  const seq    = String((count || 0) + 1).padStart(3, '0');
  const ticket = `${prefijo}${seq}`;

  const { data, error } = await supabase
    .from('mantenimientos')
    .insert({
      ticket,
      token,
      terminal:        terminalNombre,
      terminal_id:     terminalId     || null,
      cliente:         clienteNombre  || null,
      cliente_id:      clienteId      || null,
      asignado_nombre: asignadoNombre,
      asignado_email:  asignadoEmail,
      fecha_visita:    fechaProgramada || null,
      tecnico:         asignadoNombre,
      estado:          'Asignado',
    })
    .select('id, ticket, token')
    .single();

  if (error) {
    console.error('crear-orden-mantencion error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
  }

  // Enviar email al técnico
  const BASE_URL  = 'https://acex-electroterminales.pages.dev';
  const linkForm  = `${BASE_URL}/mantencion.html?token=${token}`;
  const EMAIL_FROM = env.EMAIL_FROM || '';
  const BREVO_KEY  = env.BREVO_API_KEY;

  if (BREVO_KEY && EMAIL_FROM) {
    const fromMatch = EMAIL_FROM.match(/^(.*?)\s*<(.+?)>$/);
    const fromEmail = fromMatch ? fromMatch[2].trim() : EMAIL_FROM.trim();
    const fromName  = fromMatch ? fromMatch[1].trim() : 'ACEX';

    const htmlBody = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>
body{margin:0;padding:0;background:#F5F7FA;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1A1F2B}
.wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
.header{background:#1D6FD1;padding:20px 28px}
.header-logo{font-size:22px;font-weight:700;color:#fff}
.body{padding:28px}
.ticket-badge{display:inline-block;background:#EBF3FD;border:1px solid #B3D4F5;color:#1D6FD1;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;margin-bottom:16px;letter-spacing:.5px;font-family:monospace}
h2{font-size:18px;font-weight:700;margin:0 0 8px}
.subtitle{font-size:14px;color:#637181;margin:0 0 20px;line-height:1.5}
.data-table{background:#F5F7FA;border-radius:8px;padding:16px;margin:20px 0}
.data-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #EBF0F7}
.data-row:last-child{border-bottom:none}
.dk{color:#637181;font-size:12px;font-weight:500}
.dv{color:#1A1F2B;font-size:13px;font-weight:600}
.btn-wrap{margin:24px 0}
.btn{display:inline-block;background:#1D6FD1;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:8px}
.footer{background:#F5F7FA;border-top:1px solid #EBF0F7;padding:16px 28px;font-size:11px;color:#9BAAB8;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="header-logo">ACEX · Mantención Preventiva</div></div>
  <div class="body">
    <div class="ticket-badge">🔩 ${ticket}</div>
    <h2>Orden de mantención asignada</h2>
    <p class="subtitle">Hola <strong>${asignadoNombre}</strong>, se te ha asignado una orden de mantención preventiva. Por favor completa el formulario al realizar la visita.</p>
    <div class="data-table">
      <div class="data-row"><span class="dk">Terminal</span><span class="dv">${terminalNombre}</span></div>
      <div class="data-row"><span class="dk">Cliente</span><span class="dv">${clienteNombre || '—'}</span></div>
      ${fechaProgramada ? `<div class="data-row"><span class="dk">Fecha programada</span><span class="dv">${fechaProgramada}</span></div>` : ''}
    </div>
    <div class="btn-wrap"><a href="${linkForm}" class="btn">🔩 Abrir formulario de mantención →</a></div>
    <p style="font-size:12px;color:#637181">Si el botón no funciona, copia este link:<br/>
    <span style="font-family:monospace;font-size:11px;color:#1D6FD1;word-break:break-all">${linkForm}</span></p>
  </div>
  <div class="footer">Mensaje generado automáticamente por ACEX · No responder este correo.</div>
</div></body></html>`;

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: fromName, email: fromEmail },
        to:          [{ email: asignadoEmail, name: asignadoNombre }],
        cc:          [
          { email: 'sergio.espinozafb@enel.com', name: 'Sergio Espinoza' },
          { email: 'delamazasebastian@gmail.com', name: 'Sebastián De la Maza' },
        ],
        subject:     `[ACEX] Mantención asignada — ${ticket}`,
        htmlContent: htmlBody,
      }),
    }).catch(e => console.warn('Email técnico mantencion falló:', e));
  }

  return new Response(JSON.stringify({ ok: true, ticket, token, linkFormulario: linkForm }), { status: 200, headers: HEADERS });
}
