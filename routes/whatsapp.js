// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Inicializar el cliente de WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // <- this one doesn't work in Windows
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-client-side-phishing-detection'
        ],
        defaultViewport: null,
    },
});

let receivedMessages = []; // Arreglo para almacenar los mensajes recibidos
let isClientReady = false; // Flag para verificar si el cliente está listo

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea el código QR para autenticarte');
});

client.on('ready', () => {
    console.log('Client is ready!');
    isClientReady = true;
});

// Add error handling for client
client.on('auth_failure', msg => {
    console.error('Authentication failed:', msg);
    isClientReady = false;
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out:', reason);
    isClientReady = false;
});

// Handle protocol errors specifically
process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && reason.message.includes('Protocol error')) {
        console.warn('Protocol error detected, this is usually temporary:', reason.message);
        // Don't crash the process for protocol errors
        return;
    }
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

client.on('message_create', message => {
    console.log('Mensaje recibido:', message.body);

    // Guardar los mensajes entrantes
    receivedMessages.push({
        id: message.id._serialized,
        from: message.from,
        body: message.body,
        timestamp: message.timestamp,
    });

    // Ejemplo de respuesta a un comando específico
    if (message.body === '!ping') {
        message.reply('pong');
    }
});

// Initialize client with error handling
try {
    client.initialize();
} catch (error) {
    console.error('Error initializing WhatsApp client:', error);
    process.exit(1);
}

// Función helper para verificar si el cliente está listo
function checkClientReady() {
    if (!isClientReady) {
        throw new Error('WhatsApp client no está listo. Asegúrate de escanear el código QR primero.');
    }
}

// Endpoint para enviar un mensaje
router.post('/send', async (req, res) => {
    const { numeroDestino, mensaje } = req.body;

    if (!numeroDestino || !mensaje) {
        return res.status(400).json({ error: 'Número de destino y mensaje son requeridos' });
    }

    try {
        // Verificar que el cliente esté listo
        checkClientReady();

        const chatId = `${numeroDestino}@c.us`;
        const response = await client.sendMessage(chatId, mensaje);
        res.json({ message: 'Mensaje enviado', response });
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        
        let errorMessage = 'Error al enviar mensaje';
        if (error.message.includes('no está listo')) {
            errorMessage = error.message;
            res.status(503).json({ error: errorMessage });
        } else if (error.message.includes('Protocol error')) {
            errorMessage = 'Error temporal de conexión. Intenta de nuevo en unos segundos.';
            res.status(503).json({ error: errorMessage });
        } else {
            res.status(500).json({ error: errorMessage, details: error.message });
        }
    }
});

// Endpoint para enviar un mensaje con imagen desde URL
router.post('/send-with-image', async (req, res) => {
    const { numeroDestino, mensaje, imageUrl } = req.body;

    if (!numeroDestino || !mensaje || !imageUrl) {
        return res.status(400).json({ 
            error: 'Número de destino, mensaje e imageUrl son requeridos' 
        });
    }

    try {
        // Verificar que el cliente esté listo
        checkClientReady();

        const chatId = `${numeroDestino}@c.us`;
        
        // Descargar la imagen desde la URL
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000, // 10 segundos de timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        // Detectar el tipo MIME de la imagen
        const contentType = imageResponse.headers['content-type'];
        let mimeType = 'image/jpeg'; // default
        let filename = 'image.jpg'; // default
        
        if (contentType) {
            if (contentType.includes('png')) {
                mimeType = 'image/png';
                filename = 'image.png';
            } else if (contentType.includes('gif')) {
                mimeType = 'image/gif';
                filename = 'image.gif';
            } else if (contentType.includes('webp')) {
                mimeType = 'image/webp';
                filename = 'image.webp';
            } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                mimeType = 'image/jpeg';
                filename = 'image.jpg';
            }
        }
        
        // Crear el objeto MessageMedia
        const media = new MessageMedia(
            mimeType,
            Buffer.from(imageResponse.data).toString('base64'),
            filename
        );

        // Enviar la imagen con el mensaje como caption
        const imageMessage = await client.sendMessage(chatId, media, {
            caption: mensaje
        });

        res.json({ 
            message: 'Mensaje con imagen enviado exitosamente', 
            response: imageMessage,
            imageInfo: {
                mimeType,
                filename,
                size: imageResponse.data.length
            }
        });
    } catch (error) {
        console.error('Error al enviar mensaje con imagen:', error);
        
        let errorMessage = 'Error al enviar mensaje con imagen';
        if (error.message.includes('no está listo')) {
            errorMessage = error.message;
            res.status(503).json({ error: errorMessage });
        } else if (error.message.includes('Protocol error')) {
            errorMessage = 'Error temporal de conexión. Intenta de nuevo en unos segundos.';
            res.status(503).json({ error: errorMessage });
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = 'Timeout al descargar la imagen';
            res.status(408).json({ error: errorMessage });
        } else if (error.response && error.response.status === 404) {
            errorMessage = 'La URL de la imagen no es válida o no existe';
            res.status(404).json({ error: errorMessage });
        } else if (error.response && error.response.status >= 400) {
            errorMessage = `Error HTTP ${error.response.status} al descargar la imagen`;
            res.status(500).json({ error: errorMessage });
        } else {
            res.status(500).json({ 
                error: errorMessage,
                details: error.message 
            });
        }
    }
});

// Endpoint para obtener los mensajes recibidos
router.get('/messages', (req, res) => {
    res.json({ messages: receivedMessages });
});

// Endpoint para verificar el estado del cliente
router.get('/status', (req, res) => {
    res.json({ 
        isReady: isClientReady,
        message: isClientReady ? 'Cliente listo' : 'Cliente no está listo. Escanea el código QR.'
    });
});

module.exports = router;
