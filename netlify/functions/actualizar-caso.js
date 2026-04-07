// netlify/functions/actualizar-caso.js
// ─────────────────────────────────────────────────────────────────────────
// Recibe el record ID de Airtable y los campos a actualizar
// Verifica el token antes de permitir cualquier modificación
// ─────────────────────────────────────────────────────────────────────────

exports.handler = async function(event) {

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE  = 'appmEbDwIFMLp0W3I';
  const AIRTABLE_TABLE = 'Casos';

  if (!AIRTABLE_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Token no configurado' }) };
  }

  try {
    const { recordId, token, campos } = JSON.parse(event.body);

    if (!recordId || !token || !campos) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan parámetros' }) };
    }

    // Verificar token obteniendo el registro actual
    const getUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}/${recordId}`;
    const getResp = await fetch(getUrl, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });
    const getData = await getResp.json();

    if (!getResp.ok) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Registro no encontrado' }) };
    }

    if (getData.fields['Token caso'] !== token) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Token inválido' }) };
    }

    // Actualizar el registro
    const patchResp = await fetch(getUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ fields: campos }),
    });

    const patchData = await patchResp.json();

    if (!patchResp.ok) {
      return { statusCode: patchResp.status, body: JSON.stringify({ error: patchData }) };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true }),
    };

  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
