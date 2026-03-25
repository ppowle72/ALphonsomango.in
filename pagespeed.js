exports.handler = async function (event, context) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const PSI_KEY = process.env.PAGESPEED_API_KEY;
  const BASE_URL = 'https://alphonsomango.in';
  const STRATEGY = event.queryStringParameters?.strategy || 'mobile';

  const PAGES = [
    { name: 'Homepage', url: BASE_URL + '/', priority: 'critical' },
    { name: 'Ratnagiri Alphonso', url: BASE_URL + '/collections/alphonso-mango', priority: 'critical' },
  ];

  function getMetric(lhr, id) {
    const item = lhr?.audits?.[id];
    return { value: item?.numericValue || null, display: item?.displayValue || '—', score: item?.score !== null ? Math.round((item?.score || 0) * 100) : null };
  }

  function scoreColor(s) { return s >= 90 ? 'green' : s >= 50 ? 'orange' : 'red'; }
  function lcpStatus(ms) {
    if (!ms) return { label: 'No data', color: 'gray', fix: null };
    if (ms <= 2500) return { label: 'Good ✅', color: 'green', fix: null };
    if (ms <= 4000) return { label: 'Needs Work ⚠️', color: 'orange', fix: 'Enable Cloudflare Polish + Image Resizing' };
    return { label: 'POOR ❌ — losing conversions', color: 'red', fix: 'URGENT: Compress hero image, enable Cloudflare cache rules, reduce TTFB' };
  }

  try {
    const results = [];
    await Promise.all(PAGES.map(async (page) => {
      try {
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(page.url)}&strategy=${STRATEGY}${PSI_KEY ? '&key=' + PSI_KEY : ''}`;
        const res = await fetch(apiUrl);
        const data = await res.json();
        const lhr = data.lighthouseResult;
        const lcp = getMetric(lhr, 'largest-contentful-paint');
        const cls = getMetric(lhr, 'cumulative-layout-shift');
        const tbt = getMetric(lhr, 'total-blocking-time');
        const fcp = getMetric(lhr, 'first-contentful-paint');
        const tti = getMetric(lhr, 'interactive');
        const si  = getMetric(lhr, 'speed-index');
        const perfScore = Math.round((lhr?.categories?.performance?.score || 0) * 100);
        const lcpStat = lcpStatus(lcp.value);
        const convLift = Math.max(0, ((lcp.value || 0) - 2500) / 100 * 1).toFixed(1);

        const opps = [];
        const oppKeys = ['render-blocking-resources','unused-css-rules','unused-javascript','uses-optimized-images','uses-webp-images','server-response-time','uses-long-cache-ttl','efficiently-encode-images'];
        oppKeys.forEach(k => {
          const a = lhr?.audits?.[k];
          if (a && a.score !== null && a.score < 0.9 && a.displayValue) {
            opps.push({ title: a.title, display: a.displayValue, score: Math.round((a.score||0)*100), impact: a.score < 0.5 ? 'HIGH' : 'MED' });
          }
        });

        results.push({
          page: page.name, url: page.url, strategy: STRATEGY,
          performance_score: perfScore, score_color: scoreColor(perfScore),
          lcp: { ms: Math.round(lcp.value || 0), display: lcp.display, status: lcpStat },
          cls: { value: cls.value?.toFixed(3), display: cls.display },
          tbt: { ms: Math.round(tbt.value || 0), display: tbt.display },
          fcp: { ms: Math.round(fcp.value || 0), display: fcp.display },
          tti: { ms: Math.round(tti.value || 0), display: tti.display },
          speed_index: { display: si.display },
          opportunities: opps.sort((a,b) => a.score - b.score).slice(0, 5),
          conversion_lift_if_fixed: convLift + '%',
          lcp_fix_needed_ms: Math.max(0, Math.round((lcp.value || 0) - 2500)),
        });
      } catch(e) { results.push({ page: page.name, url: page.url, error: e.message, performance_score: null }); }
    }));

    const valid = results.filter(r => r.performance_score !== null);
    const avgScore = valid.length ? Math.round(valid.reduce((s,r) => s + r.performance_score, 0) / valid.length) : null;
    const worstLCP = valid.sort((a,b) => (b.lcp?.ms||0) - (a.lcp?.ms||0))[0];

    const cfActions = [];
    if (worstLCP?.lcp?.ms > 2500) {
      cfActions.push({ priority: 'HIGH', action: 'Enable Cloudflare Polish (Lossy) — auto-compress all product images' });
      cfActions.push({ priority: 'HIGH', action: 'Create Cache Rule: Cache /cdn/shop/* for 1 year (Browser TTL)' });
      cfActions.push({ priority: 'HIGH', action: 'Enable Cloudflare Image Resizing — serve WebP to all browsers' });
    }
    cfActions.push({ priority: 'MED', action: 'Enable Rocket Loader — defer all JavaScript' });
    cfActions.push({ priority: 'MED', action: 'Enable Auto Minify: HTML + CSS + JS' });
    cfActions.push({ priority: 'MED', action: 'Set Edge Cache TTL to 1 month for static assets' });
    cfActions.push({ priority: 'MED', action: 'Enable HTTP/3 + Early Hints in Cloudflare Speed settings' });
    cfActions.push({ priority: 'LOW', action: 'Enable Cloudflare Fonts — self-host Google Fonts via Cloudflare' });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        summary: { avg_performance_score: avgScore, strategy: STRATEGY, pages_tested: results.length, worst_lcp_page: worstLCP?.page, worst_lcp_ms: worstLCP?.lcp?.ms },
        cloudflare_speed_actions: cfActions,
        pages: results,
        last_updated: new Date().toISOString(),
      }),
    };
  } catch(err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message, summary: { avg_performance_score: null }, pages: [] }) };
  }
};
