# WhatsApp Web API

Este proyecto es una API para interactuar con WhatsApp utilizando `whatsapp-web.js` y `express`. Permite enviar y recibir mensajes a través de WhatsApp.

## Características

- Generación de código QR para la autenticación de WhatsApp Web.
- Recepción y almacenamiento de mensajes entrantes.
- Respuesta automática a comandos específicos.
- Envío de mensajes a números de WhatsApp.

## Requisitos

- Node.js
- npm

## Instalación

1. Clona este repositorio:
    ```bash
    git clone https://github.com/tu-usuario/tu-repositorio.git
    ```
2. Navega al directorio del proyecto:
    ```bash
    cd tu-repositorio
    ```
3. Instala las dependencias:
    ```bash
    npm install
    ```

## Uso

1. Inicia el servidor:
    ```bash
    node routes/whatsapp.js
    ```
2. Escanea el código QR que se genera en la terminal con tu aplicación de WhatsApp.

### Endpoints

- **Enviar un mensaje**
    ```http
    POST /send
    ```
    - **Parámetros del cuerpo:**
        - `numeroDestino`: Número de WhatsApp del destinatario (ej. `1234567890`).
        - `mensaje`: Texto del mensaje a enviar.

- **Obtener mensajes recibidos**
    ```http
    GET /messages
    ```

## Ejemplo de Código

```javascript
const express = require('express');
const router = express.Router();
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Inicializar el cliente de WhatsApp
const client = new Client({
    puppeteer: {
        headless: true,
    },
});

let receivedMessages = []; // Arreglo para almacenar los mensajes recibidos

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
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

client.initialize();

// Endpoint para enviar un mensaje
router.post('/send', async (req, res) => {
    const { numeroDestino, mensaje } = req.body;

    if (!numeroDestino || !mensaje) {
        return res.status(400).json({ error: 'Número de destino y mensaje son requeridos' });
    }

    try {
        const chatId = `${numeroDestino}@c.us`;
        const response = await client.sendMessage(chatId, mensaje);
        res.json({ message: 'Mensaje enviado', response });
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});

// Endpoint para obtener los mensajes recibidos
router.get('/messages', (req, res) => {
    res.json({ messages: receivedMessages });
});

module.exports = router;
