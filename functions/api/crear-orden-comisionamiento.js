// functions/api/crear-orden-comisionamiento.js — Cloudflare Pages Function
// Operador crea una orden de comisionamiento: genera token y envía link al comisionador.

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
    clienteNombre, terminalNombre, terminalDireccion, numCargadores,
    empresaComision, asignadoNombre, asignadoEmail, fechaProgramada,
  } = body;

  if (!clienteNombre || !terminalNombre || !numCargadores || !asignadoNombre || !asignadoEmail?.includes('@')) {
    return new Response(JSON.stringify({ error: 'Faltan campos: clienteNombre, terminalNombre, numCargadores, asignadoNombre, asignadoEmail' }), { status: 400, headers: HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const fecha    = getFecha();
  const token    = genToken();

  const prefijo = `COM-${fecha}-`;
  const { count } = await supabase
    .from('comisionamientos')
    .select('id', { count: 'exact', head: true })
    .like('ticket', `${prefijo}%`);

  const seq    = String((count || 0) + 1).padStart(3, '0');
  const ticket = `${prefijo}${seq}`;

  const { data, error } = await supabase
    .from('comisionamientos')
    .insert({
      ticket,
      token,
      cliente_nombre:      clienteNombre,
      terminal_nombre:     terminalNombre,
      terminal_direccion:  terminalDireccion || null,
      num_cargadores:      Number(numCargadores),
      empresa_comision:    empresaComision    || null,
      asignado_nombre:     asignadoNombre,
      asignado_email:      asignadoEmail,
      tecnico:             asignadoNombre,
      estado:              'Asignado',
    })
    .select('id, ticket, token')
    .single();

  if (error) {
    console.error('crear-orden-comisionamiento error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: HEADERS });
  }

  // Enviar email al comisionador
  const BASE_URL   = 'https://acex-electroterminales.pages.dev';
  const linkForm   = `${BASE_URL}/comisionamiento.html?token=${token}`;
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
.header{background:#6C3EC7;padding:20px 28px}
.header-logo{font-size:22px;font-weight:700;color:#fff}
.body{padding:28px}
.ticket-badge{display:inline-block;background:#F0EAFB;border:1px solid #C4A8F0;color:#6C3EC7;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;margin-bottom:16px;font-family:monospace}
h2{font-size:18px;font-weight:700;margin:0 0 8px}
.subtitle{font-size:14px;color:#637181;margin:0 0 20px;line-height:1.5}
.data-table{background:#F5F7FA;border-radius:8px;padding:16px;margin:20px 0}
.data-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #EBF0F7}
.data-row:last-child{border-bottom:none}
.dk{color:#637181;font-size:12px;font-weight:500}
.dv{color:#1A1F2B;font-size:13px;font-weight:600}
.btn-wrap{margin:24px 0}
.btn{display:inline-block;background:#6C3EC7;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:8px}
.footer{background:#F5F7FA;border-top:1px solid #EBF0F7;padding:16px 28px;font-size:11px;color:#9BAAB8;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="header-logo">ACEX · Comisionamiento</div></div>
  <div class="body">
    <div class="ticket-badge">⚡ ${ticket}</div>
    <h2>Orden de comisionamiento asignada</h2>
    <p class="subtitle">Hola <strong>${asignadoNombre}</strong>, se te ha asignado un comisionamiento de terminal de carga. Completa el formulario técnico al realizar la visita.</p>
    <div class="data-table">
      <div class="data-row"><span class="dk">Cliente</span><span class="dv">${clienteNombre}</span></div>
      <div class="data-row"><span class="dk">Terminal</span><span class="dv">${terminalNombre}</span></div>
      ${terminalDireccion ? `<div class="data-row"><span class="dk">Dirección</span><span class="dv">${terminalDireccion}</span></div>` : ''}
      <div class="data-row"><span class="dk">N° cargadores</span><span class="dv">${numCargadores}</span></div>
      ${empresaComision ? `<div class="data-row"><span class="dk">Empresa</span><span class="dv">${empresaComision}</span></div>` : ''}
      ${fechaProgramada ? `<div class="data-row"><span class="dk">Fecha</span><span class="dv">${fechaProgramada}</span></div>` : ''}
    </div>
    <div class="btn-wrap"><a href="${linkForm}" class="btn">⚡ Abrir formulario de comisionamiento →</a></div>
    <p style="font-size:12px;color:#637181">Si el botón no funciona, copia este link:<br/>
    <span style="font-family:monospace;font-size:11px;color:#6C3EC7;word-break:break-all">${linkForm}</span></p>
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
        subject:     `[ACEX] Comisionamiento asignado — ${ticket}`,
        htmlContent: htmlBody,
      }),
    }).catch(e => console.warn('Email comisionador falló:', e));
  }

  return new Response(JSON.stringify({ ok: true, ticket, token, linkFormulario: linkForm }), { status: 200, headers: HEADERS });
}
