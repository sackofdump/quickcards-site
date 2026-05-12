const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const FREE_SHIPPING_COUPON = (process.env.FREE_SHIPPING_COUPON || 'QCESHIPFREE').toUpperCase();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Accept either the legacy raw-array shape or { items, coupon }
  const items = Array.isArray(payload) ? payload : payload && payload.items;
  const couponRaw = Array.isArray(payload) ? '' : (payload && payload.coupon) || '';
  const couponValid = String(couponRaw).trim().toUpperCase() === FREE_SHIPPING_COUPON;

  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, body: 'Cart is empty' };
  }

  const origin = event.headers.origin || event.headers.referer?.replace(/\/$/, '') || 'https://quickcards.shop';

  const subtotal = items.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0);

  const line_items = items.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name,
        ...(item.image ? { images: [item.image] } : {}),
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity || 1,
  }));

  const shipping_options = (couponValid || subtotal >= 25)
    ? [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'Free Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 5 },
            },
          },
        },
      ]
    : [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 500, currency: 'usd' },
            display_name: 'Ground Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 5 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 1200, currency: 'usd' },
            display_name: 'Priority Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 1 },
              maximum: { unit: 'business_day', value: 3 },
            },
          },
        },
      ];

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      shipping_address_collection: { allowed_countries: ['US'] },
      shipping_options,
      success_url: `${origin}/success.html`,
      cancel_url: `${origin}/#products`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
