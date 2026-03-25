const { google } = require('googleapis');

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Parse service account from Netlify env
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'No service account configured' }) };
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const GSC_SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:alphonsomango.in';

    // Authenticate with service account
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // Date range: last 28 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 28);

    const fmt = (d) => d.toISOString().split('T')[0];

    // Query 1: Overall site metrics
    const siteRes = await searchconsole.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: [],
        rowLimit: 1,
      },
    });

    const siteData = siteRes.data.rows?.[0] || {};

    // Query 2: Top keywords by impressions
    const kwRes = await searchconsole.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query'],
        orderBy: [{ fieldName: 'impressions', sortOrder: 'DESCENDING' }],
        rowLimit: 10,
      },
    });

    const keywords = (kwRes.data.rows || []).map((row) => ({
      keyword: row.keys[0],
      clicks: Math.round(row.clicks),
      impressions: Math.round(row.impressions),
      ctr: (row.ctr * 100).toFixed(1),
      position: row.position.toFixed(1),
    }));

    // Query 3: Top pages
    const pageRes = await searchconsole.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['page'],
        orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
        rowLimit: 5,
      },
    });

    const top_pages = (pageRes.data.rows || []).map((row) => ({
      page: row.keys[0].replace('https://alphonsomango.in', ''),
      clicks: Math.round(row.clicks),
      impressions: Math.round(row.impressions),
      position: row.position.toFixed(1),
    }));

    // Avg position across top 10 keywords
    const avgPosition =
      keywords.length > 0
        ? (keywords.reduce((s, k) => s + parseFloat(k.position), 0) / keywords.length).toFixed(1)
        : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        avg_position: avgPosition,
        total_clicks: Math.round(siteData.clicks || 0),
        total_impressions: Math.round(siteData.impressions || 0),
        avg_ctr: siteData.ctr ? (siteData.ctr * 100).toFixed(1) : '0.0',
        site_avg_position: siteData.position ? siteData.position.toFixed(1) : null,
        top_keywords: keywords,
        top_pages: top_pages,
        date_range: `${fmt(startDate)} to ${fmt(endDate)}`,
        last_updated: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error('GSC error:', err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        error: err.message,
        avg_position: null,
        total_clicks: 0,
        total_impressions: 0,
        top_keywords: [],
        top_pages: [],
      }),
    };
  }
};
