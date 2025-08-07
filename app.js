// app.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

// Importar rutas
const whatsappRoutes = require('./routes/whatsapp');

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Usar rutas
app.use('/api/whatsapp', whatsappRoutes);

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit if it's a protocol error
    if (!error.message || !error.message.includes('Protocol error')) {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit if it's a protocol error
    if (!reason || !reason.message || !reason.message.includes('Protocol error')) {
        process.exit(1);
    }
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
