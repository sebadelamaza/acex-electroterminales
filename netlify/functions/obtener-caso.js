// netlify/functions/obtener-caso.js
// ─────────────────────────────────────────────────────────────────────────
// Recibe ticket + token, busca el caso en Airtable y lo devuelve
// Solo devuelve el caso si el token coincide — seguridad para contratistas
// ─────────────────────────────────────────────────────────────────────────

exports.handler = async function(event) {

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE  = 'appmEbDwIFMLp0W3I';
  const AIRTABLE_TABLE = 'Casos';

  if (!AIRTABLE_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Token no configurado' }) };
  }

  const { ticket, token } = event.queryStringParameters || {};

  if (!ticket || !token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan parámetros ticket o token' }) };
  }

  try {
    // Buscar el caso por número de ticket
    const formula = encodeURIComponent(`{Ticket} = "${ticket}"`);
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}?filterByFormula=${formula}`;

    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
    });

    const data = await resp.json();

    if (!resp.ok || !data.records?.length) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Caso no encontrado' }) };
    }

    const caso = data.records[0];

    // Verificar que el token coincide
    if (caso.fields['Token caso'] !== token) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Token inválido' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        id:     caso.id,
        fields: caso.fields
      }),
    };

  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
