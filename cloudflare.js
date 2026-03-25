exports.handler = async function(event, context) {
  const CF_TOKEN = process.env.CF_TOKEN;
  const CF_ZONE_ID = process.env.CF_ZONE_ID;
  const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const cfHeaders = {
      'Authorization': `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json'
    };

    // Zone analytics (last 24 hours)
    const since = new Date(Date.now() - 24*60*60*1000).toISOString();
    const until = new Date().toISOString();

    const analyticsRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/analytics/dashboard?since=${since}&until=${until}&continuous=true`,
      { headers: cfHeaders }
    );
    const analyticsData = await analyticsRes.json();
    const totals = analyticsData.result?.totals || {};

    // Firewall events (threats)
    const firewallRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/firewall/events?per_page=25`,
      { headers: cfHeaders }
    );
    const firewallData = await firewallRes.json();
    const threats = (firewallData.result || []).slice(0, 10).map(e => ({
      action: e.action,
      ip: e.clientIP,
      country: e.clientCountryName,
      rule: e.ruleId || 'WAF',
      time: e.occurredAt
    }));

    // WAF rules
    const wafRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/firewall/rules?per_page=10`,
      { headers: cfHeaders }
    );
    const wafData = await wafRes.json();
    const activeRules = (wafData.result || []).filter(r => !r.paused).length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        requests_total: totals.requests?.all || 0,
        requests_cached: totals.requests?.cached || 0,
        threats_total: totals.threats?.all || 0,
        bandwidth_gb: ((totals.bandwidth?.all || 0) / 1024 / 1024 / 1024).toFixed(2),
        unique_visitors: totals.uniques?.all || 0,
        recent_threats: threats,
        active_waf_rules: activeRules,
        last_updated: new Date().toISOString()
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
