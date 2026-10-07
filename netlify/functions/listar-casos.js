// netlify/functions/listar-casos.js
// ─────────────────────────────────────────────────────────────────────────
// Devuelve todos los casos de Airtable para el dashboard supervisor.
// Protegido por PIN de supervisor (variable de entorno DASHBOARD_PIN).
// Si DASHBOARD_PIN no está configurado, acepta el PIN "acex2024" por defecto.
// ─────────────────────────────────────────────────────────────────────────

exports.handler = async function(event) {

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const DASHBOARD_PIN  = process.env.DASHBOARD_PIN || 'acex2024';
  const AIRTABLE_BASE  = 'appmEbDwIFMLp0W3I';
  const AIRTABLE_TABLE = 'Casos';

  if (!AIRTABLE_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Token no configurado' }) };
  }

  // Verificar PIN
  const { pin, estado, cliente, desde, hasta } = event.queryStringParameters || {};

  if (!pin || pin !== DASHBOARD_PIN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'PIN incorrecto' }) };
  }

  try {
    // Construir filtro opcional por estado
    let formula = '';
    const filtros = [];
    if (estado && estado !== 'todos') filtros.push(`{Estado} = "${estado}"`);
    if (cliente) filtros.push(`FIND("${cliente}", {Cliente nombre})`);
    if (desde)   filtros.push(`IS_AFTER({Fecha apertura}, "${desde}")`);
    if (hasta)   filtros.push(`IS_BEFORE({Fecha apertura}, "${hasta}")`);
    if (filtros.length === 1) formula = filtros[0];
    if (filtros.length > 1)  formula = `AND(${filtros.join(',')})`;

    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`;
    url += `?sort[0][field]=Fecha apertura&sort[0][direction]=desc`;
    url += `&pageSize=100`;
    if (formula) url += `&filterByFormula=${encodeURIComponent(formula)}`;

    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });

    const data = await resp.json();

    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: data }) };
    }

    // Devolver solo los campos necesarios para el dashboard (sin token de seguridad)
    const casos = (data.records || []).map(r => ({
      id:      r.id,
      ticket:  r.fields['Ticket'],
      estado:  r.fields['Estado'],
      cliente: r.fields['Cliente nombre'],
      terminal:r.fields['Terminal nombre'],
      falla:   r.fields['Tipo falla'],
      urgencia:r.fields['Urgencia'],
      garantia:r.fields['Resultado garantia'],
      tecnico: r.fields['Tecnico nombre'] || r.fields['Contratista nombre'],
      apertura:r.fields['Fecha apertura'],
      cierre:  r.fields['Fecha cierre'],
      hhTotal: r.fields['HH total'],
      tokenCaso: r.fields['Token caso'], // necesario para generar links
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ok: true, total: casos.length, casos }),
    };

  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
