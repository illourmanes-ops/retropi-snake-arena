// ============================================================
// SERVEUR BACKEND — SNAKE ARENA — Pi Payments
// ============================================================
// Ce serveur gère l'approbation et la finalisation des paiements Pi.
// Variables d'environnement nécessaires sur Render :
//   PI_API_KEY = ta clé API Pi Network (Developer Portal)
//   PORT       = fournie automatiquement par Render
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Sert le jeu (snake_V8_AVEC_PI.html) et tout autre fichier statique du dossier
app.use(express.static(__dirname));

const PI_API_KEY = process.env.PI_API_KEY;
const PI_PLATFORM_API = 'https://api.minepi.com/v2';

if (!PI_API_KEY) {
  console.warn('⚠️  ATTENTION : la variable PI_API_KEY n\'est pas définie. Configure-la dans Render → Environment.');
}

// Petit helper pour appeler l'API Pi Platform
async function piApiCall(pathUrl, method = 'POST', body = null) {
  const url = `${PI_PLATFORM_API}${pathUrl}`;
  const options = {
    method,
    headers: {
      'Authorization': `Key ${PI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  };

  const res = await fetch(url, options);
  
  // On retourne l'objet response pour pouvoir intercepter le 404 dans les routes si besoin
  return res;
}

// ============================================================
// ROUTE 1 — APPROUVER LE PAIEMENT (Corrigée 404)
// ============================================================
app.post('/payments/approve', async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId manquant' });

    console.log('Approbation du paiement :', paymentId);

    const resPi = await piApiCall(`/payments/${paymentId}/approve`, 'POST');

    // CORRECTION : Si le paiement est expiré ou introuvable, on ignore la 404 sans faire planter l'app
    if (resPi.status === 404) {
      console.log('Paiement déjà traité ou expiré (404), ignoré côté serveur.');
      return res.status(200).json({ success: true, ignored: true });
    }

    if (!resPi.ok) {
      const errText = await resPi.text();
      throw new Error(`Pi API a échoué (${resPi.status}): ${errText}`);
    }

    const data = await resPi.json();
    res.status(200).json({ success: true, data });
  } catch (e) {
    console.error('Erreur /payments/approve :', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ROUTE 2 — FINALISER LE PAIEMENT
// ============================================================
app.post('/payments/complete', async (req, res) => {
  try {
    const { paymentId, txid } = req.body;
    if (!paymentId || !txid) return res.status(400).json({ error: 'paymentId ou txid manquant' });

    console.log('Finalisation du paiement :', paymentId, txid);

    const resPi = await piApiCall(`/payments/${paymentId}/complete`, 'POST', { txid });

    if (!resPi.ok) {
      const errText = await resPi.text();
      throw new Error(`Pi API complete a échoué (${resPi.status}): ${errText}`);
    }

    const data = await resPi.json();
    res.status(200).json({ success: true, data });
  } catch (e) {
    console.error('Erreur /payments/complete :', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ROUTE 3 — PAIEMENT INCOMPLET (sécurité)
// ============================================================
app.post('/payments/incomplete', async (req, res) => {
  try {
    const { paymentId, txid } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId manquant' });

    console.log('Nettoyage paiement incomplet :', paymentId);

    let resPi;
    if (txid) {
      // Si une transaction existe déjà côté blockchain, on finalise
      resPi = await piApiCall(`/payments/${paymentId}/complete`, 'POST', { txid });
    } else {
      // Sinon on annule proprement
      resPi = await piApiCall(`/payments/${paymentId}/cancel`, 'POST');
    }

    if (resPi && !resPi.ok) {
      const errText = await resPi.text();
      throw new Error(`Pi API incomplete a échoué (${resPi.status}): ${errText}`);
    }

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('Erreur /payments/incomplete :', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Route de santé + page d'accueil = le jeu lui-même
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'snake_V8_AVEC_PI.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));
