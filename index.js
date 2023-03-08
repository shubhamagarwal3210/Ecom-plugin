const express = require('express');
const corsModule = require('cors');
const app = express();
const cron = require('node-cron');
const PORT = process.env.PORT || 4000;

const ecomPlugin = require('./src/ecomPlugin/ecomPluginController');
const ecomPluginService = require('./src/ecomPlugin/ecomPluginService');

app.use(express.json());
app.use(corsModule({ origin: true }));
app.use('/ecomPlugin', ecomPlugin);

cron.schedule('*/5 * * * * *', () => {
    ecomPluginService.sendNotification()
});

app.get("/", (req, res) => {
    res.status(200).send("Welcome to the Ecom Plugins!!");
});

app.listen(PORT, () => {
    console.log(`listening to port ${PORT}`);
})