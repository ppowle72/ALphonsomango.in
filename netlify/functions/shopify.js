exports.handler = async function(event, context) {
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const ordersRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?created_at_min=${todayISO}&status=any&limit=250`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    );
    const ordersData = await ordersRes.json();
    const orders = ordersData.orders || [];

    // Calculate today's revenue
    const todayRevenue = orders
      .filter(o => o.financial_status !== 'voided' && o.financial_status !== 'refunded')
      .reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);

    // Get total customers
    const custRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/customers/count.json`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    );
    const custData = await custRes.json();

    // Get abandoned checkouts
    const abanRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/checkouts.json?created_at_min=${todayISO}&limit=50`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    );
    const abanData = await abanRes.json();
    const abandonedCount = (abanData.checkouts || []).length;

    // Get top products (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString();
    const prodRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2024-01/orders.json?created_at_min=${thirtyDaysAgo}&status=any&limit=250&fields=line_items`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
    );
    const prodData = await prodRes.json();

    // Aggregate product sales
    const productSales = {};
    (prodData.orders || []).forEach(order => {
      (order.line_items || []).forEach(item => {
        if (!productSales[item.title]) {
          productSales[item.title] = { units: 0, revenue: 0 };
        }
        productSales[item.title].units += item.quantity;
        productSales[item.title].revenue += parseFloat(item.price) * item.quantity;
      });
    });

    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, data]) => ({ name, ...data }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        today_orders: orders.length,
        today_revenue: todayRevenue.toFixed(2),
        total_customers: custData.count || 0,
        abandoned_today: abandonedCount,
        top_products: topProducts,
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
