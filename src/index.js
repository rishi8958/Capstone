require('dotenv').config();
const express = require('express');
const campaignRoutes = require('./routes/campaigns');
const webhookRoutes = require('./routes/webhook');

const app = express();

// Webhook route must be mounted BEFORE express.json() so it receives the raw Buffer
app.use('/webhook', webhookRoutes);

app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/campaigns', campaignRoutes);

app.use((_, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Social Studio API running on :${PORT}`));

module.exports = app;
