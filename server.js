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
async function piApiCall(path, method = 'POST', body = null) {
  const res = await fetch(`${PI_PLATFORM_API}${path}`, {
    method,
    headers: {
      'Authorization': `Key ${PI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pi API ${path} a échoué (${res.status}): ${errText}`);
  }
  return res.json();
}

// ============================================================
// ROUTE 1 — APPROUVER LE PAIEMENT
// Appelée par le frontend dès que le SDK Pi déclenche
// onReadyForServerApproval(paymentId)
// ============================================================
app.post('/payments/approve', async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId manquant' });

    console.log('Approbation du paiement :', paymentId);

    // Ici tu peux ajouter ta propre logique de vérification métier
    // (ex: vérifier que l'utilisateur a bien le droit d'acheter ce pack)

    await piApiCall(`/payments/${paymentId}/approve`);

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('Erreur /payments/approve :', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ROUTE 2 — FINALISER LE PAIEMENT
// Appelée par le frontend dès que le SDK Pi déclenche
// onReadyForServerCompletion(paymentId, txid)
// ============================================================
app.post('/payments/complete', async (req, res) => {
  try {
    const { paymentId, txid } = req.body;
    if (!paymentId || !txid) return res.status(400).json({ error: 'paymentId ou txid manquant' });

    console.log('Finalisation du paiement :', paymentId, txid);

    await piApiCall(`/payments/${paymentId}/complete`, 'POST', { txid });

    // Ici, tu peux enregistrer en base de données que cet achat est validé
    // (pour l'instant le frontend crédite les gemmes directement en localStorage)

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('Erreur /payments/complete :', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ROUTE 3 — PAIEMENT INCOMPLET (sécurité)
// Appelée si Pi.authenticate() détecte un paiement resté bloqué
// d'une session précédente (onIncompletePaymentFound côté frontend)
// ============================================================
app.post('/payments/incomplete', async (req, res) => {
  try {
    const { paymentId, txid } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'paymentId manquant' });

    console.log('Nettoyage paiement incomplet :', paymentId);

    if (txid) {
      // Si une transaction existe déjà côté blockchain, on finalise
      await piApiCall(`/payments/${paymentId}/complete`, 'POST', { txid });
    } else {
      // Sinon on annule proprement
      await piApiCall(`/payments/${paymentId}/cancel`, 'POST');
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
