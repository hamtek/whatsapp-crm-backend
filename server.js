require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Tes clés API
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

// URL de base WhatsApp API
const WHATSAPP_API_URL = `https://graph.instagram.com/v18.0/${PHONE_NUMBER_ID}`;

// ===== MIDDLEWARE : Vérifier la clé API pour Lovable =====
function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== LOVABLE_API_KEY) {
    return res.status(401).json({ error: 'Invalid API Key' });
  }
  
  next();
}

// ===== WEBHOOK : Reçoit les messages de WhatsApp =====
app.post('/webhook', (req, res) => {
  const { entry } = req.body;

  if (entry) {
    entry.forEach((item) => {
      const changes = item.changes[0];
      const messageData = changes.value.messages?.[0];

      if (messageData) {
        const from = messageData.from;
        const text = messageData.text?.body || '';
        const timestamp = messageData.timestamp;

        console.log(`📨 Message reçu de ${from}: ${text}`);
        logMessageToServer(from, text, timestamp);
      }
    });
  }

  res.status(200).send('EVENT_RECEIVED');
});

// ===== VÉRIFICATION WEBHOOK (Meta demande ça) =====
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log('✅ Webhook vérifié');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ===== ENVOYER UN MESSAGE (Sécurisé avec clé API) =====
app.post('/send-message', verifyApiKey, async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Missing "to" or "message"' });
    }

    const response = await axios.post(
      `${WHATSAPP_API_URL}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Message envoyé à ${to}`);
    res.json({ success: true, messageId: response.data.messages[0].id });
  } catch (error) {
    console.error('❌ Erreur envoi:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== TEST API =====
app.get('/test', (req, res) => {
  res.json({ status: 'Backend fonctionne ✅' });
});

// ===== DÉMARRER LE SERVEUR =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});

// Fonction simple pour logger
function logMessageToServer(from, text, timestamp) {
  console.log(`[${new Date(timestamp * 1000).toISOString()}] ${from}: ${text}`);
}
