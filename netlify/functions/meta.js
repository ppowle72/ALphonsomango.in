exports.handler = async function(event, context) {
  const META_TOKEN = process.env.META_TOKEN;
  const META_AD_ACCOUNT = process.env.META_AD_ACCOUNT;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];

    // Account insights today
    const insightsRes = await fetch(
      `https://graph.facebook.com/v18.0/act_${META_AD_ACCOUNT}/insights?` +
      `fields=spend,impressions,clicks,actions,action_values,ctr,cpc,cpp,reach,frequency` +
      `&date_preset=today` +
      `&access_token=${META_TOKEN}`
    );
    const insightsData = await insightsRes.json();
    const todayInsights = insightsData.data?.[0] || {};

    // Last 30 days insights
    const insights30Res = await fetch(
      `https://graph.facebook.com/v18.0/act_${META_AD_ACCOUNT}/insights?` +
      `fields=spend,impressions,clicks,actions,action_values,ctr,cpc,reach` +
      `&time_range={"since":"${thirtyDaysAgo}","until":"${today}"}` +
      `&access_token=${META_TOKEN}`
    );
    const insights30Data = await insights30Res.json();
    const insights30 = insights30Data.data?.[0] || {};

    // Active campaigns
    const campaignsRes = await fetch(
      `https://graph.facebook.com/v18.0/act_${META_AD_ACCOUNT}/campaigns?` +
      `fields=name,status,daily_budget,lifetime_budget,objective` +
      `&effective_status=["ACTIVE"]` +
      `&access_token=${META_TOKEN}`
    );
    const campaignsData = await campaignsRes.json();
    const campaigns = (campaignsData.data || []).map(c => ({
      name: c.name,
      status: c.status,
      daily_budget: c.daily_budget ? (parseInt(c.daily_budget) / 100).toFixed(2) : null,
      objective: c.objective
    }));

    // Calculate ROAS
    const spend = parseFloat(todayInsights.spend || 0);
    const purchases = (todayInsights.actions || []).find(a => a.action_type === 'purchase');
    const purchaseValue = (todayInsights.action_values || []).find(a => a.action_type === 'purchase');
    const revenue = parseFloat(purchaseValue?.value || 0);
    const roas = spend > 0 ? (revenue / spend).toFixed(2) : null;

    // 30 day ROAS
    const spend30 = parseFloat(insights30.spend || 0);
    const purchaseValue30 = (insights30.action_values || []).find(a => a.action_type === 'purchase');
    const revenue30 = parseFloat(purchaseValue30?.value || 0);
    const roas30 = spend30 > 0 ? (revenue30 / spend30).toFixed(2) : null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        today: {
          spend: spend.toFixed(2),
          impressions: todayInsights.impressions || 0,
          clicks: todayInsights.clicks || 0,
          ctr: parseFloat(todayInsights.ctr || 0).toFixed(2),
          cpc: parseFloat(todayInsights.cpc || 0).toFixed(2),
          reach: todayInsights.reach || 0,
          revenue: revenue.toFixed(2),
          roas: roas
        },
        last_30_days: {
          spend: spend30.toFixed(2),
          revenue: revenue30.toFixed(2),
          roas: roas30,
          impressions: insights30.impressions || 0,
          clicks: insights30.clicks || 0
        },
        active_campaigns: campaigns,
        campaign_count: campaigns.length,
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
