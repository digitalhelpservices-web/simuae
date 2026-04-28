export const config = {
  api: { bodyParser: false },
};
// api/stripe-webhook.js
// Webhook Stripe → Brevo pour SimuAE
// Déployer sur Vercel : ce fichier dans /api/ = endpoint automatique
// URL finale : https://simuae.fr/api/stripe-webhook

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Map produit Stripe → liste Brevo + séquence email
const PRODUCT_CONFIG = {
  // Remplace par tes vrais price IDs Stripe
  'price_rapport_9eur': {
    brevoListId: 3,           // ID liste "Acheteurs Rapport 9€" dans Brevo
    brevoTemplateId: 1,       // ID template email de bienvenue
    tag: 'rapport-9',
    productName: 'Rapport Complet 9€',
  },
  'price_pack_complet_19eur': {
    brevoListId: 4,           // ID liste "Acheteurs Pack 19,99€" dans Brevo
    brevoTemplateId: 2,       // ID template email de bienvenue pack
    tag: 'pack-complet',
    productName: 'Pack Complet 19,99€',
  },
};

// Ajoute le contact à Brevo + déclenche la séquence
async function addContactToBrevo(email, firstName, config, paymentIntent) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  // 1. Créer/mettre à jour le contact
  const contactResponse = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      updateEnabled: true,  // Met à jour si le contact existe déjà
      attributes: {
        PRENOM: firstName || '',
        PRODUIT_ACHETE: config.productName,
        DATE_ACHAT: new Date().toISOString().split('T')[0],
        STRIPE_PAYMENT_ID: paymentIntent,
      },
      listIds: [config.brevoListId],
    }),
  });

  if (!contactResponse.ok) {
    const error = await contactResponse.json();
    throw new Error(`Brevo contact error: ${JSON.stringify(error)}`);
  }

  // 2. Envoyer l'email transactionnel de confirmation
  const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      templateId: config.brevoTemplateId,
      to: [{ email, name: firstName || email }],
      params: {
        PRENOM: firstName || 'cher auto-entrepreneur',
        PRODUIT: config.productName,
      },
    }),
  });

  if (!emailResponse.ok) {
    const error = await emailResponse.json();
    throw new Error(`Brevo email error: ${JSON.stringify(error)}`);
  }

  return { contact: await contactResponse.json(), email: await emailResponse.json() };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vérification signature Stripe (CRITIQUE pour la sécurité)
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    // Vercel : le body brut est dans req.body si bodyParser est désactivé
    const rawBody = req.body;
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Seul événement qui nous intéresse : paiement réussi
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Récupérer les détails complets de la session avec les line items
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items', 'customer_details'],
    });

    const email = fullSession.customer_details?.email;
    const firstName = fullSession.customer_details?.name?.split(' ')[0] || '';
    const paymentIntent = fullSession.payment_intent;

    if (!email) {
      console.error('No email found in session:', session.id);
      return res.status(200).json({ received: true, warning: 'No email' });
    }

    // Trouver la config pour ce produit
    const lineItem = fullSession.line_items?.data?.[0];
    const priceId = lineItem?.price?.id;
    const config = PRODUCT_CONFIG[priceId];

    if (!config) {
      console.log(`Prix non configuré: ${priceId} — aucune action Brevo`);
      return res.status(200).json({ received: true, info: 'Price not configured' });
    }

    try {
      await addContactToBrevo(email, firstName, config, paymentIntent);
      console.log(`✅ ${email} ajouté à Brevo (${config.productName})`);
      return res.status(200).json({ received: true, success: true });
    } catch (err) {
      console.error('Erreur Brevo:', err.message);
      // On retourne 200 à Stripe pour éviter les retry, mais on log l'erreur
      return res.status(200).json({ received: true, brevoError: err.message });
    }
  }

  // Tous les autres événements → on répond OK sans action
  return res.status(200).json({ received: true });
}
