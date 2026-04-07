// netlify/functions/guardar-caso.js
// ─────────────────────────────────────────────────────────────────────────
// Función serverless que recibe los datos del formulario y los guarda
// en Airtable usando el token almacenado como variable de entorno.
// El token NUNCA está expuesto en el código del formulario.
// ─────────────────────────────────────────────────────────────────────────

exports.handler = async function(event) {

  // Solo aceptar POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  // Leer el token desde variables de entorno de Netlify
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE  = 'appmEbDwIFMLp0W3I';
  const AIRTABLE_TABLE = 'Casos';
  const AIRTABLE_URL   = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(AIRTABLE_TABLE)}`;

  if (!AIRTABLE_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Token de Airtable no configurado' })
    };
  }

  try {
    const datos = JSON.parse(event.body);

    const respuesta = await fetch(AIRTABLE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ fields: datos }),
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      return {
        statusCode: respuesta.status,
        body: JSON.stringify({ error: resultado }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true, id: resultado.id }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
