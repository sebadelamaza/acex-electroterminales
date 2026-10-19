// functions/api/enviar-notificacion.js — Cloudflare Pages Function
// Envía notificaciones de email vía Brevo (Sendinblue) API v3.
// Variables de entorno: BREVO_API_KEY, EMAIL_FROM

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 200, headers: HEADERS });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: HEADERS });
  }

  const BREVO_API_KEY = env.BREVO_API_KEY;
  const EMAIL_FROM    = env.EMAIL_FROM || '';

  if (!BREVO_API_KEY) {
    return new Response(JSON.stringify({ error: 'BREVO_API_KEY no configurado' }), { status: 500, headers: HEADERS });
  }
  if (!EMAIL_FROM) {
    return new Response(JSON.stringify({ error: 'EMAIL_FROM no configurado' }), { status: 500, headers: HEADERS });
  }

  const fromMatch = EMAIL_FROM.match(/^(.*?)\s*<(.+?)>$/);
  const fromEmail = fromMatch ? fromMatch[2].trim() : EMAIL_FROM.trim();
  const fromName  = fromMatch ? fromMatch[1].trim() : 'ACEX';

  let payload;
  try { payload = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: HEADERS }); }

  const {
    tipo, ticket, destinatarioNombre, destinatarioEmail,
    terminalNombre, clienteNombre, tipoFalla, urgencia, garantia,
    linkFormulario, tecnicoNombre,
  } = payload;

  if (!tipo || !destinatarioEmail || !ticket) {
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos: tipo, destinatarioEmail, ticket' }), { status: 400, headers: HEADERS });
  }
  if (!destinatarioEmail.includes('@')) {
    return new Response(JSON.stringify({ error: 'Email inválido' }), { status: 400, headers: HEADERS });
  }

  let subject, htmlBody;

  if (tipo === 'apertura') {
    subject  = `[ACEX] Asistencia asignada — ${ticket}`;
    htmlBody = templateApertura({ ticket, destinatarioNombre, terminalNombre, clienteNombre, tipoFalla, urgencia, garantia, linkFormulario });
  } else if (tipo === 'informe') {
    subject  = `[ACEX] Informe de terreno listo — ${ticket}`;
    htmlBody = templateInforme({ ticket, destinatarioNombre, terminalNombre, clienteNombre, tecnicoNombre, linkFormulario });
  } else if (tipo === 'reporte') {
    subject  = `[ACEX] Reporte técnico disponible — ${ticket}`;
    htmlBody = templateReporte({ ticket, destinatarioNombre, terminalNombre, clienteNombre, tecnicoNombre, linkFormulario });
  } else {
    return new Response(JSON.stringify({ error: `Tipo desconocido: ${tipo}` }), { status: 400, headers: HEADERS });
  }

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key':      BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender:      { name: fromName, email: fromEmail },
        to:          [{ email: destinatarioEmail, name: destinatarioNombre || destinatarioEmail }],
        cc:          [{ email: 'sergio.espinozafb@enel.com', name: 'Sergio Espinoza' }],
        subject,
        htmlContent: htmlBody,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Brevo error:', data);
      return new Response(JSON.stringify({ error: data }), { status: resp.status, headers: HEADERS });
    }

    return new Response(JSON.stringify({ ok: true, messageId: data.messageId }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error('Error de red:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
}

// ─── EMAIL TEMPLATES ────────────────────────────────────────────────────────

function baseTemplate(contenido) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  body{margin:0;padding:0;background:#F5F7FA;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1A1F2B}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .header{background:#1D6FD1;padding:20px 28px;display:flex;align-items:center;gap:12px}
  .header-logo{font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px}
  .header-divider{width:1px;height:20px;background:rgba(255,255,255,.3)}
  .header-sub{font-size:12px;font-weight:600;color:rgba(255,255,255,.8);letter-spacing:.5px}
  .body{padding:28px}
  .ticket-badge{display:inline-block;background:#EBF3FD;border:1px solid #B3D4F5;color:#1D6FD1;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;margin-bottom:16px;letter-spacing:.5px;font-family:monospace}
  h2{font-size:18px;font-weight:700;color:#1A1F2B;margin:0 0 8px}
  .subtitle{font-size:14px;color:#637181;margin:0 0 20px;line-height:1.5}
  .data-table{background:#F5F7FA;border-radius:8px;padding:16px;margin:20px 0}
  .data-row{display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px solid #EBF0F7}
  .data-row:last-child{border-bottom:none}
  .dk{color:#637181;font-size:12px;font-weight:500}
  .dv{color:#1A1F2B;font-size:13px;font-weight:600;text-align:right}
  .btn-wrap{margin:24px 0}
  .btn{display:inline-block;background:#1D6FD1;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:8px;letter-spacing:.2px}
  .footer{background:#F5F7FA;border-top:1px solid #EBF0F7;padding:16px 28px;font-size:11px;color:#9BAAB8;text-align:center;line-height:1.6}
  .urgencia-alta{color:#C96D00;font-weight:700}
  .garantia-vigente{color:#007140;font-weight:700}
  .garantia-expirada{color:#C0392B;font-weight:700}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="header-logo">enel</div>
    <div class="header-divider"></div>
    <div class="header-sub">ACEX · Asistencias Electroterminales</div>
  </div>
  <div class="body">${contenido}</div>
  <div class="footer">
    Este mensaje fue generado automáticamente por ACEX.<br/>
    Sistema de gestión de asistencias 24/7 — Enel X Chile<br/>
    No responda este correo directamente.
  </div>
</div>
</body>
</html>`;
}

function templateApertura({ ticket, destinatarioNombre, terminalNombre, clienteNombre, tipoFalla, urgencia, garantia, linkFormulario }) {
  const garantiaClass = garantia?.includes('VIGENTE') ? 'garantia-vigente' : garantia?.includes('EXPIRADA') ? 'garantia-expirada' : '';
  const urgenciaClass = urgencia === 'Crítica' || urgencia === 'Alta' ? 'urgencia-alta' : '';
  return baseTemplate(`
    <div class="ticket-badge">🎫 ${ticket}</div>
    <h2>Asistencia asignada</h2>
    <p class="subtitle">Hola <strong>${destinatarioNombre || 'técnico/a'}</strong>, se te ha asignado la siguiente intervención. Por favor completa el formulario de terreno al llegar.</p>
    <div class="data-table">
      <div class="data-row"><span class="dk">Cliente</span><span class="dv">${clienteNombre || '—'}</span></div>
      <div class="data-row"><span class="dk">Terminal</span><span class="dv">${terminalNombre || '—'}</span></div>
      <div class="data-row"><span class="dk">Falla reportada</span><span class="dv">${tipoFalla || '—'}</span></div>
      <div class="data-row"><span class="dk">Urgencia</span><span class="dv ${urgenciaClass}">${urgencia || '—'}</span></div>
      <div class="data-row"><span class="dk">Garantía</span><span class="dv ${garantiaClass}">${garantia || '—'}</span></div>
    </div>
    <div class="btn-wrap"><a href="${linkFormulario}" class="btn">📋 Abrir formulario de terreno →</a></div>
    <p style="font-size:12px;color:#637181;margin-top:8px">Si el botón no funciona, copia este link en tu navegador:<br/>
    <span style="font-family:monospace;font-size:11px;color:#1D6FD1;word-break:break-all">${linkFormulario}</span></p>
  `);
}

function templateInforme({ ticket, destinatarioNombre, terminalNombre, clienteNombre, tecnicoNombre, linkFormulario }) {
  return baseTemplate(`
    <div class="ticket-badge">📋 ${ticket}</div>
    <h2>Informe de terreno disponible</h2>
    <p class="subtitle">Hola <strong>${destinatarioNombre || 'supervisor/a'}</strong>, el técnico ha completado el informe de intervención. Está pendiente tu revisión y aprobación.</p>
    <div class="data-table">
      <div class="data-row"><span class="dk">Cliente</span><span class="dv">${clienteNombre || '—'}</span></div>
      <div class="data-row"><span class="dk">Terminal</span><span class="dv">${terminalNombre || '—'}</span></div>
      <div class="data-row"><span class="dk">Técnico</span><span class="dv">${tecnicoNombre || '—'}</span></div>
    </div>
    <div class="btn-wrap"><a href="${linkFormulario}" class="btn">✅ Revisar y aprobar →</a></div>
    <p style="font-size:12px;color:#637181;margin-top:8px">Si el botón no funciona, copia este link en tu navegador:<br/>
    <span style="font-family:monospace;font-size:11px;color:#1D6FD1;word-break:break-all">${linkFormulario}</span></p>
  `);
}

function templateReporte({ ticket, destinatarioNombre, terminalNombre, clienteNombre, tecnicoNombre, linkFormulario }) {
  return baseTemplate(`
    <div class="ticket-badge">📄 ${ticket}</div>
    <h2>Reporte técnico disponible</h2>
    <p class="subtitle">Estimado/a <strong>${destinatarioNombre || 'cliente'}</strong>, el reporte técnico de la intervención en su terminal está disponible para revisión.</p>
    <div class="data-table">
      <div class="data-row"><span class="dk">Terminal</span><span class="dv">${terminalNombre || '—'}</span></div>
      <div class="data-row"><span class="dk">Técnico</span><span class="dv">${tecnicoNombre || '—'}</span></div>
    </div>
    <div class="btn-wrap"><a href="${linkFormulario}" class="btn">📄 Ver reporte completo →</a></div>
    <p style="font-size:12px;color:#637181;margin-top:8px">Si el botón no funciona, copia este link en tu navegador:<br/>
    <span style="font-family:monospace;font-size:11px;color:#1D6FD1;word-break:break-all">${linkFormulario}</span></p>
  `);
}
