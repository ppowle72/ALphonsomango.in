const Anthropic = require('@anthropic-ai/sdk');
exports.handler = async function (event, context) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  try {
    const body = JSON.parse(event.body || '{}');
    const { question, platformData, analysisType } = body;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sh = platformData?.shopify || {};
    const meta = platformData?.meta || {};
    const gads = platformData?.googleAds || {};
    const gsc = platformData?.gsc || {};
    const cf = platformData?.cloudflare || {};
    const psi = platformData?.pagespeed || {};

    const systemPrompt = `You are the Claude AI Chief Marketing Officer for AlphonsoMango.in — India's #1 premium Alphonso mango brand.

BRAND: alphonsomango.in | ratnagirialphonso.myshopify.com | Season: Apr-Jun | AOV: Rs2,000-5,000 | India only
CUSTOMERS: ${sh.total_customers || '42,794'} total | ~34,000 DORMANT (90d+) — massive win-back opportunity

REVENUE TARGET: Rs5 CRORE 2026 SEASON
- Google Ads Rs20L budget → Rs2.3Cr (11.5x ROAS)
- CRM + WhatsApp + AI calling → Rs2.7Cr (10,800 orders)
- CAC target: Rs100 or below | ROAS target: 20x on optimised campaigns

CRITICAL AUDIT FINDINGS (from previous deep analysis):

CLICK FRAUD CRISIS — 23.8% INVALID CLICKS (industry normal 3.5%):
- Retarget-April/2024: 23-26% invalid rate → PAUSE IMMEDIATELY
- Feed Only campaign: 19.06% invalid on Rs98,728 spend → PAUSE
- 3,415 placements with CTR >8% and ZERO conversions (bots: gaming apps, Ludo, Quora, Calculator apps)
- Estimated Rs4-6L stolen per season by click fraud
- FIX: Add all 3,415 to global placement exclusion list + enable Invalid Click Protection in Google Ads settings

TABLET OPPORTUNITY — BIGGEST UNTAPPED WIN:
- Tablet ROAS: 12.74x CONFIRMED | Only Rs6,175 EVER spent total (CRIMINAL underinvestment)
- Allocate Rs2L to tablet campaigns → Expected Rs25.5L return at 12.74x
- Create separate tablet campaign with MCV bidding + tablet-optimised landing pages

DESKTOP MCV DEPLOYED? NO — AND IT'S 28.4x ROAS:
- Desktop Maximise Conversion Value: CAC Rs88, ROAS 28.4x — SITTING IDLE
- Switch all desktop campaigns to MCV bid strategy NOW
- This single change could add Rs50L+ to revenue

INDIA TARGETING LEAK:
- Non-India IPs clicking ads — geo leak confirmed
- Cities with zero delivery capability still receiving ad traffic
- FIX: Google Ads → Location Options → "People IN targeted locations" (NOT "searching for or interested in")
- FIX: Cloudflare WAF block non-IN IPs on /products/*, /cart, /checkout

QUALITY SCORE CRISIS:
- Top keywords paying 30-100% CPC premium (QS below 7/10)
- "alphonso mango", "buy alphonso mango online" — should be QS 9-10
- FIX: Exact match ad groups, dedicated landing pages per keyword, improve ad relevance

WHAT'S WORKING (DO MORE):
- Mobile: 11.74x ROAS (only 43% budget — should be 65%)
- Tablet: 12.74x ROAS (essentially Rs0 spent — allocate Rs2L NOW)
- Desktop MCV: 28.4x ROAS (not deployed — deploy NOW)
- Ratnagiri Alphonso: Top revenue product

BUDGET REALLOCATION (Rs20L):
Mobile MCV: Rs8L (40%) | Tablet MCV new: Rs2L (10%) | Desktop MCV: Rs4L (20%)
Retargeting clean: Rs3L (15%) | Brand exact match: Rs2L (10%) | Discovery: Rs1L (5%)

CRM WIN-BACK (Rs2.7Cr):
34,000 dormant users → WhatsApp Day1 → Email Day3 → AI call Day7 → Final WhatsApp Day10
Champions (3+ orders): VIP early access + free gift
At-risk (90d): 15% discount + urgency
High-AOV (Rs5K+): Personal AI call

WEBSITE SPEED — FREE REVENUE:
Every 100ms LCP improvement = 1% more conversions
At Rs2000 AOV x 20,000 orders: each 100ms = Rs4L revenue
PageSpeed current: avg score ${psi.summary?.avg_performance_score || 'unknown'}/100
Worst LCP: ${psi.summary?.worst_lcp_ms || 'unknown'}ms on ${psi.summary?.worst_lcp_page || 'unknown'}
Cloudflare fixes: Polish (lossy), Image Resizing→WebP, Rocket Loader, Minify, Cache TTL 1yr, HTTP/3

LIVE DATA NOW:
Shopify: Revenue Rs${sh.today_revenue||0} | Orders ${sh.today_orders||0} | Customers ${sh.total_customers||0}
Meta: Spend Rs${meta.today?.spend||0} | ROAS ${meta.today?.roas||'—'}
Google Ads: Spend Rs${gads.today?.spend||0} | ROAS ${gads.today?.roas||'—'} | Clicks ${gads.today?.clicks||0}
GSC: Position ${gsc.site_avg_position||'—'} | Clicks ${gsc.total_clicks||0} | Impr ${gsc.total_impressions||0}
Cloudflare: Requests ${cf.requests_total||0} | Threats ${cf.threats_total||0} | WAF rules ${cf.active_waf_rules||9}
Google Ads 30d campaigns: ${JSON.stringify(gads.last_30_days?.campaigns?.slice(0,5)||[])}
GSC top keywords: ${JSON.stringify(gsc.top_keywords?.slice(0,5)||[])}

RULES: Use Rs amounts. Prioritise by revenue impact. Give exact steps. Reference campaign names. Connect to Rs5Cr target. Be direct and specific.`;

    const prompts = {
      full: 'Run complete Rs5Cr Revenue Battle Plan. Structure: 1)Performance vs Rs5Cr target 2)CRITICAL ALERTS — money being lost NOW 3)Click Fraud Report with Rs amounts 4)Device Strategy: tablet 12.74x/mobile 11.74x/desktop MCV 28.4x 5)India targeting status 6)Website speed revenue impact 7)CRM+WhatsApp Rs2.7Cr plan 8)Budget reallocation exact Rs split 9)This week ACTION LIST ranked by Rs impact 10)Path to ROAS 20x and CAC Rs100',
      'google-ads-audit': 'Google Ads full audit: 1)Click fraud — which campaigns to PAUSE now with Rs impact 2)Tablet 12.74x — scale to Rs2L campaign plan 3)Desktop MCV 28.4x — step by step to deploy today 4)3415 bad placements — bulk exclusion method 5)QS crisis fix — exact keyword and ad copy changes 6)India location settings — exact Google Ads steps 7)Budget reallocation across Rs20L exact amounts 8)Negative keyword list from GSC data 9)Expected ROAS after all fixes',
      'cloudflare-audit': 'Cloudflare audit: 1)India WAF rule status on ad landing pages 2)Speed: Polish/Image Resizing/Rocket Loader — what to enable now 3)Cache rules for /cdn/shop/* — copy-paste rule configs 4)LCP impact with Rs revenue calculation 5)Cache hit rate and TTFB improvement 6)HTTP/3 and Early Hints setup 7)Click fraud bot blocking at WAF level 8)Exact Cloudflare dashboard steps',
      'pagespeed-audit': 'PageSpeed LCP Revenue Analysis: 1)Current LCP mobile and desktop vs 2.5s target 2)Revenue calculation: each 100ms = Rs4L at our order volume 3)Top 5 fixes by conversion impact 4)Cloudflare settings to improve LCP today 5)Product image optimisation — WebP, compression 6)JavaScript render blocking — Rocket Loader impact 7)TTFB — server response time fix via Cloudflare 8)Expected performance score after all fixes',
      'crm-strategy': 'CRM+WhatsApp Rs2.7Cr plan: 1)34,000 dormant users — full segmentation 2)Champions VIP sequence with templates 3)At-risk win-back with 15% discount messages 4)High-AOV AI call script 5)Season countdown calendar: March 1 → April → May → June 6)Revenue projection per segment 7)WhatsApp+Email+AI call coordination 8)ConvertWay integration plan',
    };

    const userMessage = (analysisType && prompts[analysisType]) ? prompts[analysisType] : (question || 'What are the top 5 actions to take this week to move toward Rs5Cr revenue and CAC Rs100?');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    return { statusCode: 200, headers, body: JSON.stringify({ response: response.content[0]?.text || 'No response', tokens_used: response.usage?.output_tokens || 0, analysis_type: analysisType || 'custom', timestamp: new Date().toISOString() }) };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message, response: 'Analysis error: ' + err.message }) };
  }
};
