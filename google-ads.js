const { google } = require('googleapis');

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
    const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || customerId).replace(/-/g, '');

    if (!serviceAccountJson || !developerToken || !customerId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          error: 'Missing Google Ads credentials. Need: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID',
          today: { spend: '0.00', impressions: 0, clicks: 0, conversions: 0, conversion_value: '0.00', roas: null },
          last_30_days: { spend: '0.00', roas: null, campaigns: [] },
        }),
      };
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    // Auth with service account
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/adwords'],
    });
    const client = await auth.getClient();
    const accessToken = (await client.getAccessToken()).token;

    const adsApiBase = `https://googleads.googleapis.com/v17/customers/${customerId}`;

    const adsHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
      ...(loginCustomerId && loginCustomerId !== customerId
        ? { 'login-customer-id': loginCustomerId }
        : {}),
    };

    // Helper: run GAQL query
    async function runQuery(gaql) {
      const res = await fetch(`${adsApiBase}/googleAds:searchStream`, {
        method: 'POST',
        headers: adsHeaders,
        body: JSON.stringify({ query: gaql }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Ads API error: ${res.status} — ${errText.slice(0, 300)}`);
      }
      const lines = await res.text();
      // searchStream returns newline-delimited JSON objects
      const results = [];
      for (const line of lines.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '[' || trimmed === ']') continue;
        try {
          const obj = JSON.parse(trimmed.replace(/,$/, ''));
          if (obj.results) results.push(...obj.results);
        } catch (_) {}
      }
      return results;
    }

    // --- TODAY metrics ---
    const todayStr = new Date().toISOString().split('T')[0];

    const todayRows = await runQuery(`
      SELECT
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      WHERE segments.date = '${todayStr}'
    `);

    const todayMetrics = todayRows[0]?.metrics || {};
    const todaySpend = (parseInt(todayMetrics.costMicros || 0) / 1e6).toFixed(2);
    const todayRevenue = parseFloat(todayMetrics.conversionsValue || 0).toFixed(2);
    const todayROAS =
      parseFloat(todaySpend) > 0
        ? (parseFloat(todayRevenue) / parseFloat(todaySpend)).toFixed(2)
        : null;

    // --- LAST 30 DAYS campaigns ---
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const campaignRows = await runQuery(`
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.bidding_strategy_type,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 10
    `);

    const campaigns = campaignRows.map((row) => {
      const m = row.metrics || {};
      const spend = parseInt(m.costMicros || 0) / 1e6;
      const revenue = parseFloat(m.conversionsValue || 0);
      const roas = spend > 0 ? (revenue / spend).toFixed(2) : null;
      return {
        id: row.campaign?.id,
        name: row.campaign?.name || 'Unknown Campaign',
        status: row.campaign?.status || 'UNKNOWN',
        spend: spend.toFixed(2),
        impressions: parseInt(m.impressions || 0),
        clicks: parseInt(m.clicks || 0),
        conversions: parseFloat(m.conversions || 0).toFixed(1),
        conversion_value: revenue.toFixed(2),
        roas: roas,
        avg_cpc: (parseInt(m.averageCpc || 0) / 1e6).toFixed(2),
      };
    });

    // Aggregate 30-day totals
    const totalSpend30 = campaigns.reduce((s, c) => s + parseFloat(c.spend), 0);
    const totalRevenue30 = campaigns.reduce((s, c) => s + parseFloat(c.conversion_value), 0);
    const roas30 = totalSpend30 > 0 ? (totalRevenue30 / totalSpend30).toFixed(2) : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        today: {
          spend: todaySpend,
          impressions: parseInt(todayMetrics.impressions || 0),
          clicks: parseInt(todayMetrics.clicks || 0),
          conversions: parseFloat(todayMetrics.conversions || 0).toFixed(1),
          conversion_value: todayRevenue,
          roas: todayROAS,
        },
        last_30_days: {
          spend: totalSpend30.toFixed(2),
          revenue: totalRevenue30.toFixed(2),
          roas: roas30,
          campaign_count: campaigns.length,
          campaigns: campaigns,
        },
        last_updated: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error('Google Ads error:', err.message);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        error: err.message,
        today: { spend: '0.00', impressions: 0, clicks: 0, conversions: '0.0', conversion_value: '0.00', roas: null },
        last_30_days: { spend: '0.00', roas: null, campaigns: [] },
      }),
    };
  }
};
