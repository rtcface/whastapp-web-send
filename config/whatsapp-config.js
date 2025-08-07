// config/whatsapp-config.js
const { Client, LocalAuth } = require('whatsapp-web.js');

/**
 * Enhanced WhatsApp client configuration to handle protocol errors
 */
const createWhatsAppClient = () => {
    return new Client({
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
                '--single-process', // Note: this doesn't work in Windows
                '--disable-gpu',
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
                '--no-first-run'
            ],
            defaultViewport: null,
            executablePath: undefined, // Let Puppeteer find Chrome automatically
        },
    });
};

/**
 * Initialize WhatsApp client with retry logic
 */
const initializeClientWithRetry = async (client, maxRetries = 3) => {
    let retries = 0;
    
    while (retries < maxRetries) {
        try {
            await client.initialize();
            console.log('WhatsApp client initialized successfully');
            return true;
        } catch (error) {
            retries++;
            console.error(`Initialization attempt ${retries} failed:`, error.message);
            
            if (retries < maxRetries) {
                console.log(`Retrying in 5 seconds... (${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    
    console.error(`Failed to initialize WhatsApp client after ${maxRetries} attempts`);
    return false;
};

module.exports = {
    createWhatsAppClient,
    initializeClientWithRetry
};
