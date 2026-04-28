// api/stripe-webhook.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRODUCT_CONFIG = {
  'price_1TNtZdGpRgeiMMckpmc9KJie': {
    brevoListId: 9,
    brevoTemplateId: 1,
    productName: 'Rapport Complet 9€',
  },
  'price_1TNtcvGpRgeiMMckY8SzzQUz': {
    brevoListId: 8,
    brevoTemplateId: 1,
    productName: 'Pack Complet 19,99€',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Signature invalide:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
    expand: ['line_items', 'customer_details'],
  });

  const email = session.customer_details?.email;
  const firstName = session.customer_details?.name?.split(' ')[0] || '';
  const priceId = session.line_items?.data?.[0]?.price?.id;
  const config = PRODUCT_CONFIG[priceId];

  if (!email) {
    console.error('Pas d\'email dans la session:', session.id);
    return res.status(200).json({ received: true });
  }

  if (!config) {
    console.log(`Price ID non configuré: ${priceId}`);
    return res.status(200).json({ received: true });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  try {
    // 1. Créer/mettre à jour le contact Brevo
    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        updateEnabled: true,
        attributes: {
          PRENOM: firstName,
          PRODUIT_ACHETE: config.productName,
          DATE_ACHAT: new Date().toISOString().split('T')[0],
        },
        listIds: [config.brevoListId],
      }),
    });
    if (!contactRes.ok) {
      const err = await contactRes.json();
      throw new Error(`Brevo contact: ${JSON.stringify(err)}`);
    }

    // 2. Envoyer l'email de confirmation
    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId: config.brevoTemplateId,
        to: [{ email, name: firstName || email }],
        params: {
          PRENOM: firstName || 'cher auto-entrepreneur',
          PRODUIT: config.productName,
        },
      }),
    });
    if (!emailRes.ok) {
      const err = await emailRes.json();
      throw new Error(`Brevo email: ${JSON.stringify(err)}`);
    }

    console.log(`✅ ${email} ajouté à Brevo (${config.productName})`);
    return res.status(200).json({ received: true, success: true });

  } catch (err) {
    console.error('Erreur Brevo:', err.message);
    return res.status(200).json({ received: true, brevoError: err.message });
  }
}
