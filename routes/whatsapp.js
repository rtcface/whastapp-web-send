// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Variables para tracking de eventos y diagnóstico
let receivedMessages = []; // Arreglo para almacenar los mensajes recibidos
let isClientReady = false; // Flag para verificar si el cliente está listo
let clientEvents = []; // Array para almacenar eventos recibidos para diagnóstico
let readyTimeout = null; // Timeout para detectar si 'ready' nunca se dispara
let authenticatedAt = null; // Timestamp de cuando se autenticó
let authenticatedCount = 0; // Contador de eventos authenticated (para detectar múltiples disparos)
let browserErrors = []; // Errores del navegador
let pageConsoleLogs = []; // Logs de la consola del navegador

// Función para agregar eventos al log de diagnóstico
function logEvent(eventName, data = {}) {
    const eventLog = {
        event: eventName,
        timestamp: new Date().toISOString(),
        data: data
    };
    clientEvents.push(eventLog);
    // Mantener solo los últimos 50 eventos
    if (clientEvents.length > 50) {
        clientEvents.shift();
    }
    console.log(`[EVENT] ${eventName}:`, data);
}

// Variable para controlar modo headless (útil para debugging)
const HEADLESS_MODE = process.env.HEADLESS !== 'false'; // Por defecto true, cambiar a false para ver el navegador

// Inicializar el cliente de WhatsApp con configuración mejorada
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: HEADLESS_MODE,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Importante en Docker/Linux
            '--disable-gpu',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-client-side-phishing-detection',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-sync',
            '--no-default-browser-check',
        ],
        defaultViewport: null,
        // Agregar handlers para capturar errores del navegador
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
    },
    // Agregar webVersionCache para evitar problemas de caché
    webVersionCache: {
        type: 'local',
        path: './.wwebjs_cache/',
    },
});

// Event listeners mejorados con logging detallado

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    logEvent('qr', { message: 'Código QR generado' });
    console.log('Escanea el código QR para autenticarte');
    // Limpiar timeout anterior si existe
    if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeout = null;
    }
});

client.on('authenticated', () => {
    authenticatedCount++;
    const currentTime = new Date();
    
    // Si ya había una autenticación previa, registrar advertencia
    if (authenticatedCount > 1) {
        console.warn(`[ADVERTENCIA] Evento 'authenticated' disparado ${authenticatedCount} veces. Esto no es normal.`);
        logEvent('authenticated_multiple', {
            count: authenticatedCount,
            message: 'Evento authenticated se disparó múltiples veces'
        });
    }
    
    authenticatedAt = currentTime;
    logEvent('authenticated', { 
        timestamp: authenticatedAt.toISOString(),
        message: 'Cliente autenticado exitosamente',
        count: authenticatedCount
    });
    console.log(`Cliente autenticado exitosamente (intento #${authenticatedCount})`);
    
    // Limpiar timeout anterior si existe
    if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeout = null;
    }
    
    // Configurar timeout para detectar si 'ready' nunca se dispara (90 segundos)
    readyTimeout = setTimeout(async () => {
        if (!isClientReady) {
            const timeSinceAuth = Math.floor((new Date() - authenticatedAt) / 1000);
            logEvent('ready_timeout', {
                message: `El evento 'ready' no se disparó después de ${timeSinceAuth} segundos de autenticación`,
                timeSinceAuth: timeSinceAuth,
                authenticatedCount: authenticatedCount
            });
            console.error(`[ERROR] El evento 'ready' no se disparó después de ${timeSinceAuth} segundos de autenticación`);
            console.error('[DIAGNÓSTICO] Esto puede indicar:');
            console.error('  1. Problema conocido: WhatsApp Web cambió y whatsapp-web.js 1.31.0 tiene un bug');
            console.error('  2. Solución: Actualizar a versión más reciente o usar fork con fix');
            console.error('  3. El selector que detecta "ready" ya no funciona en la nueva versión de WhatsApp Web');
            console.error('  4. Intenta: npm install whatsapp-web.js@latest o usar un fork con hotfix');
            console.error('  5. También puedes intentar limpiar la sesión: POST /api/whatsapp/clear-session');
            
            // Intentar obtener información del navegador si es posible
            try {
                // Intentar acceder a la página de diferentes formas
                let page = null;
                if (typeof client.pupPage === 'function') {
                    page = await client.pupPage();
                } else if (client.pup && client.pup.pages) {
                    const pages = await client.pup.pages();
                    page = pages[0];
                }
                
                if (page) {
                    const url = page.url();
                    console.error(`   URL actual del navegador: ${url}`);
                    logEvent('browser_info', { url: url });
                }
            } catch (e) {
                // Ignorar errores al acceder a la página - esto es normal si el cliente no está inicializado
                logEvent('browser_info_error', { error: e.message });
            }
        }
    }, 90000); // 90 segundos
});

client.on('remote_session_saved', () => {
    logEvent('remote_session_saved', { 
        message: 'Sesión remota guardada correctamente'
    });
    console.log('✓ Sesión remota guardada correctamente');
});

client.on('loading_screen', (percent, message) => {
    logEvent('loading_screen', { 
        percent: percent, 
        message: message 
    });
    console.log(`[Loading] ${percent}% - ${message || 'Cargando...'}`);
});

client.on('change_state', state => {
    logEvent('change_state', { state: state });
    console.log(`[Estado] Cambió a: ${state}`);
});

client.on('auth_failure', msg => {
    isClientReady = false;
    if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeout = null;
    }
    logEvent('auth_failure', { message: msg });
    console.error('[ERROR] Authentication failed:', msg);
});

client.on('disconnected', (reason) => {
    isClientReady = false;
    authenticatedAt = null;
    // No resetear authenticatedCount aquí, mantenerlo para diagnóstico
    if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeout = null;
    }
    logEvent('disconnected', { reason: reason });
    console.log('[DISCONNECTED] Client was logged out:', reason);
    
    if (reason === 'LOGOUT') {
        console.log('[INFO] Sesión cerrada desde el dispositivo. Se generará nuevo QR al reiniciar.');
        console.log('[INFO] Para reiniciar: POST /api/whatsapp/restart o reinicia el servidor');
    }
});

// Nuevos eventos críticos para debugging
client.on('message', message => {
    // Este evento se dispara para todos los mensajes (incluidos los propios)
    logEvent('message', {
        from: message.from,
        hasMedia: message.hasMedia,
        type: message.type
    });
});

// Capturar errores de Puppeteer
client.on('error', error => {
    logEvent('error', { 
        message: error.message,
        stack: error.stack,
        name: error.name
    });
    console.error('[ERROR] Error en el cliente:', error.message);
    if (error.stack) {
        console.error('Stack:', error.stack);
    }
});

// Event listener para cuando el cliente esté listo
client.on('ready', async () => {
    // Limpiar timeout si existe
    if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeout = null;
    }
    
    isClientReady = true;
    const timeToReady = authenticatedAt ? Math.floor((new Date() - authenticatedAt) / 1000) : null;
    logEvent('ready', { 
        message: 'Cliente listo y conectado',
        timeToReady: timeToReady ? `${timeToReady}s` : 'N/A',
        authenticatedCount: authenticatedCount
    });
    console.log('✓ Client is ready!');
    if (timeToReady) {
        console.log(`   Tiempo desde autenticación hasta ready: ${timeToReady} segundos`);
    }
    console.log(`   Eventos 'authenticated' recibidos: ${authenticatedCount}`);
});

// Handle protocol errors specifically
process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.message && reason.message.includes('Protocol error')) {
        logEvent('unhandled_rejection', {
            type: 'Protocol error',
            message: reason.message
        });
        console.warn('[WARN] Protocol error detected, this is usually temporary:', reason.message);
        // Don't crash the process for protocol errors
        return;
    }
    logEvent('unhandled_rejection', {
        type: 'Other',
        message: reason?.message || 'Unknown',
        reason: reason
    });
    console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

client.on('message_create', message => {
    logEvent('message_create', {
        from: message.from,
        body: message.body?.substring(0, 50), // Primeros 50 caracteres
        type: message.type,
        timestamp: message.timestamp
    });
    console.log('Mensaje recibido:', message.body);
    console.log('De:', message.from);
    console.log('Tipo de mensaje:', message.type);
    console.log('Timestamp:', message.timestamp);

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

// Función para limpiar la sesión guardada
function clearSession() {
    const authPath = path.join(process.cwd(), '.wwebjs_auth');
    try {
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            // Resetear contadores y estados
            authenticatedCount = 0;
            authenticatedAt = null;
            isClientReady = false;
            if (readyTimeout) {
                clearTimeout(readyTimeout);
                readyTimeout = null;
            }
            logEvent('session_cleared', { message: 'Sesión limpiada exitosamente' });
            console.log('✓ Sesión limpiada exitosamente');
            console.log('  Contadores reseteados. Reinicia el cliente para generar nuevo QR.');
            return true;
        } else {
            console.log('No hay sesión guardada para limpiar');
            return false;
        }
    } catch (error) {
        logEvent('session_clear_error', { error: error.message });
        console.error('Error al limpiar sesión:', error);
        return false;
    }
}

// Función para reiniciar el cliente
async function restartClient() {
    try {
        logEvent('client_restart', { message: 'Reiniciando cliente...' });
        console.log('Reiniciando cliente de WhatsApp...');
        
        // Destruir cliente actual si existe
        if (client) {
            try {
                await client.destroy();
            } catch (e) {
                console.warn('Error al destruir cliente (puede ser normal):', e.message);
            }
        }
        
        // Limpiar estados y resetear contadores
        isClientReady = false;
        authenticatedAt = null;
        authenticatedCount = 0;
        if (readyTimeout) {
            clearTimeout(readyTimeout);
            readyTimeout = null;
        }
        
        // Reinicializar
        await client.initialize();
        
        // Reconfigurar listeners del navegador
        setupBrowserListeners();
        
        logEvent('client_restart', { message: 'Cliente reiniciado exitosamente' });
        console.log('✓ Cliente reiniciado exitosamente');
        return true;
    } catch (error) {
        logEvent('client_restart_error', { error: error.message });
        console.error('Error al reiniciar cliente:', error);
        return false;
    }
}

// Función para configurar listeners del navegador (llamada después de initialize)
async function setupBrowserListeners() {
    try {
        // Esperar un poco para que el cliente se inicialice
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Intentar acceder a la página de diferentes formas
        let page = null;
        try {
            if (typeof client.pupPage === 'function') {
                page = await client.pupPage();
            } else if (client.pup && client.pup.pages) {
                const pages = await client.pup.pages();
                page = pages[0];
            }
        } catch (e) {
            // Si no se puede acceder a la página aún, no es crítico
            return;
        }
        
        if (page) {
            // Capturar errores de la página
            page.on('error', error => {
                browserErrors.push({
                    type: 'page_error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                });
                logEvent('browser_page_error', { message: error.message });
                console.error('[BROWSER ERROR]', error.message);
            });
            
            // Capturar errores de la consola (solo errores y advertencias)
            page.on('console', msg => {
                const text = msg.text();
                const type = msg.type();
                
                // Solo capturar errores, advertencias y mensajes importantes
                if (type === 'error' || type === 'warning' || text.includes('WhatsApp') || text.includes('error')) {
                    pageConsoleLogs.push({
                        type: type,
                        text: text,
                        timestamp: new Date().toISOString()
                    });
                    // Mantener solo los últimos 100 logs
                    if (pageConsoleLogs.length > 100) {
                        pageConsoleLogs.shift();
                    }
                    
                    if (type === 'error' || type === 'warning') {
                        logEvent('browser_console', { type: type, text: text.substring(0, 200) });
                        console.log(`[BROWSER ${type.toUpperCase()}]`, text.substring(0, 200));
                    }
                }
            });
            
            // Capturar errores no manejados
            page.on('pageerror', error => {
                browserErrors.push({
                    type: 'pageerror',
                    message: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                });
                logEvent('browser_pageerror', { 
                    message: error.message,
                    stack: error.stack?.substring(0, 500) 
                });
                console.error('[BROWSER PAGE ERROR]', error.message);
            });
            
            console.log('✓ Listeners de navegador configurados para diagnóstico');
            logEvent('browser_listeners_setup', { message: 'Listeners configurados' });
        }
    } catch (error) {
        // No es crítico si no se pueden configurar los listeners
        console.warn('No se pudo configurar listeners del navegador (esto es normal al inicio):', error.message);
    }
}

// Initialize client with error handling
try {
    console.log('Inicializando cliente de WhatsApp...');
    logEvent('client_init', { message: 'Iniciando cliente...' });
    client.initialize();
    console.log('Cliente inicializado correctamente');
    
    // Configurar listeners del navegador después de un breve delay
    setupBrowserListeners();
} catch (error) {
    logEvent('client_init_error', { error: error.message, stack: error.stack });
    console.error('[ERROR] Error initializing WhatsApp client:', error);
    // No hacer exit(1) para permitir que el servidor siga funcionando
    // process.exit(1);
}

// Función helper para verificar si el cliente está listo
function checkClientReady() {
    if (!isClientReady) {
        throw new Error('WhatsApp client no está listo. Asegúrate de escanear el código QR primero.');
    }
}

// Función para normalizar números de teléfono
function normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
        return null;
    }
    
    // Convertir a string y eliminar espacios, guiones, paréntesis, puntos
    let normalized = String(phoneNumber).replace(/[\s\-\(\)\.]/g, '');
    
    // Eliminar el símbolo + si está al inicio
    if (normalized.startsWith('+')) {
        normalized = normalized.substring(1);
    }
    
    // Eliminar caracteres no numéricos (excepto + al inicio)
    normalized = normalized.replace(/[^\d]/g, '');
    
    return normalized;
}

// Función para obtener el ID del contacto usando getNumberId()
async function getContactId(phoneNumber) {
    try {
        // Normalizar el número
        const normalizedNumber = normalizePhoneNumber(phoneNumber);
        
        if (!normalizedNumber) {
            throw new Error('Número de teléfono inválido');
        }
        
        // Validar que el número tenga al menos 10 dígitos (número mínimo razonable)
        if (normalizedNumber.length < 10) {
            throw new Error('El número de teléfono es demasiado corto. Debe incluir el código de país.');
        }
        
        // Intentar obtener el ID usando getNumberId()
        // Esta función resuelve el LID (Long ID) que WhatsApp requiere
        const numberId = await client.getNumberId(normalizedNumber);
        
        if (!numberId) {
            throw new Error(`No se pudo obtener el ID para el número: ${normalizedNumber}. El número puede no estar registrado en WhatsApp.`);
        }
        
        // Obtener el ID serializado del contacto
        let contactId;
        if (typeof numberId === 'string') {
            contactId = numberId;
        } else if (numberId && numberId._serialized) {
            contactId = numberId._serialized;
        } else if (numberId && numberId.user) {
            contactId = numberId.user;
        } else {
            // Si no podemos obtener el ID serializado, usar el número normalizado
            contactId = `${normalizedNumber}@c.us`;
            console.warn(`[WARN] No se pudo obtener ID serializado para ${normalizedNumber}, usando formato tradicional`);
        }
        
        logEvent('contact_id_resolved', {
            originalNumber: phoneNumber,
            normalizedNumber: normalizedNumber,
            contactId: contactId
        });
        
        return contactId;
    } catch (error) {
        logEvent('contact_id_error', {
            phoneNumber: phoneNumber,
            error: error.message,
            stack: error.stack?.substring(0, 200)
        });
        
        // Si el error es específico de LID, lanzarlo tal cual
        if (error.message && (error.message.includes('LID') || error.message.includes('No LID'))) {
            throw error;
        }
        
        // Para otros errores, crear un error más descriptivo
        throw new Error(`Error al obtener ID del contacto: ${error.message}`);
    }
}

// Función helper para obtener el chatId con fallback
async function getChatId(phoneNumber) {
    try {
        // Intentar obtener el ID usando getNumberId() (método moderno)
        const contactId = await getContactId(phoneNumber);
        return contactId;
    } catch (error) {
        // Si falla, intentar con el formato tradicional
        const normalizedNumber = normalizePhoneNumber(phoneNumber);
        if (!normalizedNumber) {
            throw new Error('Número de teléfono inválido');
        }
        
        // Fallback al formato tradicional @c.us
        const fallbackChatId = `${normalizedNumber}@c.us`;
        logEvent('contact_id_fallback', {
            phoneNumber: phoneNumber,
            fallbackChatId: fallbackChatId,
            error: error.message
        });
        console.warn(`[WARN] No se pudo obtener LID para ${phoneNumber}, usando formato tradicional: ${fallbackChatId}`);
        return fallbackChatId;
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

        // Obtener el ID del contacto usando getChatId() (con fallback)
        const chatId = await getChatId(numeroDestino);
        
        logEvent('send_message', {
            numeroDestino: numeroDestino,
            chatId: chatId,
            messageLength: mensaje.length
        });

        const response = await client.sendMessage(chatId, mensaje);
        res.json({ message: 'Mensaje enviado', response });
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        logEvent('send_message_error', {
            numeroDestino: numeroDestino,
            error: error.message,
            stack: error.stack?.substring(0, 500)
        });
        
        let errorMessage = 'Error al enviar mensaje';
        let statusCode = 500;
        
        if (error.message.includes('no está listo')) {
            errorMessage = error.message;
            statusCode = 503;
        } else if (error.message.includes('Protocol error')) {
            errorMessage = 'Error temporal de conexión. Intenta de nuevo en unos segundos.';
            statusCode = 503;
        } else if (error.message.includes('No LID for user') || error.message.includes('LID')) {
            errorMessage = 'No se pudo obtener el ID del contacto. Verifica que el número sea válido y esté registrado en WhatsApp.';
            statusCode = 400;
        } else if (error.message.includes('Número de teléfono inválido')) {
            errorMessage = 'El número de teléfono proporcionado no es válido. Asegúrate de incluir el código de país.';
            statusCode = 400;
        } else if (error.message.includes('getNumberId')) {
            errorMessage = 'No se pudo obtener el ID del contacto. El número puede no estar registrado en WhatsApp o el formato es incorrecto.';
            statusCode = 400;
        } else {
            errorMessage = error.message || errorMessage;
        }
        
        res.status(statusCode).json({ 
            error: errorMessage, 
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
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

        // Obtener el ID del contacto usando getChatId() (con fallback)
        const chatId = await getChatId(numeroDestino);
        
        logEvent('send_image_message', {
            numeroDestino: numeroDestino,
            chatId: chatId,
            imageUrl: imageUrl,
            messageLength: mensaje.length
        });
        
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
        logEvent('send_image_message_error', {
            numeroDestino: numeroDestino,
            imageUrl: imageUrl,
            error: error.message,
            stack: error.stack?.substring(0, 500)
        });
        
        let errorMessage = 'Error al enviar mensaje con imagen';
        let statusCode = 500;
        
        if (error.message.includes('no está listo')) {
            errorMessage = error.message;
            statusCode = 503;
        } else if (error.message.includes('Protocol error')) {
            errorMessage = 'Error temporal de conexión. Intenta de nuevo en unos segundos.';
            statusCode = 503;
        } else if (error.message.includes('No LID for user') || error.message.includes('LID')) {
            errorMessage = 'No se pudo obtener el ID del contacto. Verifica que el número sea válido y esté registrado en WhatsApp.';
            statusCode = 400;
        } else if (error.message.includes('Número de teléfono inválido')) {
            errorMessage = 'El número de teléfono proporcionado no es válido. Asegúrate de incluir el código de país.';
            statusCode = 400;
        } else if (error.message.includes('getNumberId')) {
            errorMessage = 'No se pudo obtener el ID del contacto. El número puede no estar registrado en WhatsApp o el formato es incorrecto.';
            statusCode = 400;
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = 'Timeout al descargar la imagen';
            statusCode = 408;
        } else if (error.response && error.response.status === 404) {
            errorMessage = 'La URL de la imagen no es válida o no existe';
            statusCode = 404;
        } else if (error.response && error.response.status >= 400) {
            errorMessage = `Error HTTP ${error.response.status} al descargar la imagen`;
            statusCode = 500;
        } else {
            errorMessage = error.message || errorMessage;
        }
        
        res.status(statusCode).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Endpoint para obtener los mensajes recibidos
router.get('/messages', (req, res) => {
    res.json({ messages: receivedMessages });
});

// Endpoint para verificar el estado del cliente
router.get('/status', (req, res) => {
    console.log('Verificando estado del cliente - isClientReady:', isClientReady);
    const timeSinceAuth = authenticatedAt ? Math.floor((new Date() - authenticatedAt) / 1000) : null;
    res.json({
        isReady: isClientReady,
        message: isClientReady ? 'Cliente listo' : 'Cliente no está listo. Escanea el código QR.',
        timestamp: new Date().toISOString(),
        authenticatedAt: authenticatedAt ? authenticatedAt.toISOString() : null,
        timeSinceAuth: timeSinceAuth ? `${timeSinceAuth}s` : null,
        hasReadyTimeout: readyTimeout !== null,
        authenticatedCount: authenticatedCount,
        warning: authenticatedCount > 1 
            ? `Advertencia: Evento 'authenticated' se disparó ${authenticatedCount} veces. Esto puede indicar un problema.`
            : null,
        recommendation: !isClientReady && authenticatedCount > 0 && timeSinceAuth && timeSinceAuth > 90
            ? 'El cliente no está listo después de la autenticación. Revisa /api/whatsapp/diagnostics para más información.'
            : null
    });
});

// Endpoint de diagnóstico detallado
router.get('/diagnostics', (req, res) => {
    const authPath = path.join(process.cwd(), '.wwebjs_auth');
    const sessionExists = fs.existsSync(authPath);
    
    // Contar eventos por tipo
    const eventCounts = {};
    clientEvents.forEach(event => {
        eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
    });
    
    // Obtener últimos eventos
    const recentEvents = clientEvents.slice(-20).reverse();
    
    // Obtener eventos críticos
    const criticalEvents = clientEvents.filter(e => 
        ['ready', 'authenticated', 'auth_failure', 'disconnected', 'ready_timeout', 'error'].includes(e.event)
    ).slice(-10).reverse();
    
    const timeSinceAuth = authenticatedAt ? Math.floor((new Date() - authenticatedAt) / 1000) : null;
    
    res.json({
        client: {
            isReady: isClientReady,
            authenticatedAt: authenticatedAt ? authenticatedAt.toISOString() : null,
            timeSinceAuth: timeSinceAuth ? `${timeSinceAuth}s` : null,
            hasReadyTimeout: readyTimeout !== null,
            readyTimeoutActive: readyTimeout !== null
        },
        session: {
            exists: sessionExists,
            path: authPath,
            canBeCleared: sessionExists
        },
        events: {
            total: clientEvents.length,
            byType: eventCounts,
            recent: recentEvents,
            critical: criticalEvents
        },
        browser: {
            errors: browserErrors.slice(-20).reverse(), // Últimos 20 errores
            consoleLogs: pageConsoleLogs.slice(-20).reverse(), // Últimos 20 logs
            totalErrors: browserErrors.length,
            totalConsoleLogs: pageConsoleLogs.length
        },
        statistics: {
            messagesReceived: receivedMessages.length,
            lastMessageAt: receivedMessages.length > 0 
                ? receivedMessages[receivedMessages.length - 1].timestamp 
                : null,
            authenticatedCount: authenticatedCount
        },
        troubleshooting: {
            multipleAuthenticatedEvents: authenticatedCount > 1,
            recommendation: authenticatedCount > 1 
                ? 'Múltiples eventos authenticated detectados. Esto puede indicar un problema con la sesión.'
                : (isClientReady 
                    ? 'Cliente funcionando correctamente'
                    : 'Cliente no está listo. Verifica los eventos críticos para más información.'),
            suggestedActions: !isClientReady && authenticatedCount > 0
                ? [
                    '1. Verificar si hay errores en browser.errors',
                    '2. Revisar eventos críticos para ver qué está fallando',
                    '3. Intentar limpiar sesión: POST /api/whatsapp/clear-session',
                    '4. Considerar actualizar whatsapp-web.js: npm install whatsapp-web.js@latest',
                    '5. Si el problema persiste, puede ser un bug conocido de la versión 1.31.0'
                  ]
                : []
        },
        timestamp: new Date().toISOString()
    });
});

// Endpoint para limpiar la sesión
router.post('/clear-session', (req, res) => {
    try {
        const cleared = clearSession();
        if (cleared) {
            res.json({ 
                success: true, 
                message: 'Sesión limpiada exitosamente. Reinicia el cliente para generar nuevo QR.',
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({ 
                success: false, 
                message: 'No hay sesión para limpiar o ya fue limpiada.',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Error en clear-session:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al limpiar sesión',
            details: error.message 
        });
    }
});

// Endpoint para reiniciar el cliente
router.post('/restart', async (req, res) => {
    try {
        const restarted = await restartClient();
        if (restarted) {
            res.json({ 
                success: true, 
                message: 'Cliente reiniciado exitosamente',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Error al reiniciar cliente'
            });
        }
    } catch (error) {
        console.error('Error en restart:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al reiniciar cliente',
            details: error.message 
        });
    }
});

// Endpoint para descargar template Excel
router.get('/template-excel', (req, res) => {
    try {
        // Datos de ejemplo para el template
        const exampleData = [
            {
                'Id': '001',
                'Nombre_Completo': 'Juan Pérez García',
                'Puesto': 'Director General',
                'Ente Publico': 'Secretaría de Educación',
                'Telefono': '521234567890',
                'Mensaje': '¡Bienvenido al evento! Este es tu código QR de acceso.'
            },
            {
                'Id': '002',
                'Nombre_Completo': 'María González López',
                'Puesto': 'Subdirectora',
                'Ente Publico': 'Secretaría de Salud',
                'Telefono': '529876543210',
                'Mensaje': '¡Gracias por participar! Tu código QR está listo.'
            }
        ];

        // Crear workbook
        const workbook = XLSX.utils.book_new();
        
        // Crear worksheet desde los datos
        const worksheet = XLSX.utils.json_to_sheet(exampleData);
        
        // Ajustar ancho de columnas
        const columnWidths = [
            { wch: 5 },   // Id
            { wch: 25 },  // Nombre_Completo
            { wch: 20 },  // Puesto
            { wch: 25 },  // Ente Publico
            { wch: 15 },  // Telefono
            { wch: 50 }   // Mensaje
        ];
        worksheet['!cols'] = columnWidths;
        
        // Agregar worksheet al workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
        
        // Generar buffer del archivo Excel
        const excelBuffer = XLSX.write(workbook, { 
            type: 'buffer', 
            bookType: 'xlsx' 
        });
        
        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="template_mensajes_masivos.xlsx"');
        
        // Enviar el archivo
        res.send(excelBuffer);
        
        logEvent('template_excel_downloaded', {
            message: 'Template Excel descargado exitosamente'
        });
    } catch (error) {
        console.error('Error al generar template Excel:', error);
        logEvent('template_excel_error', {
            error: error.message
        });
        res.status(500).json({ 
            error: 'Error al generar template Excel',
            details: error.message 
        });
    }
});

module.exports = router;
