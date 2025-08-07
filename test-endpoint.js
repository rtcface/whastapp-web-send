// test-endpoint.js
const axios = require('axios');

// Configuración
const API_BASE_URL = 'http://localhost:3000/api/whatsapp';

// Función para verificar el estado del cliente
async function checkClientStatus() {
    try {
        console.log('Verificando estado del cliente...');
        const response = await axios.get(`${API_BASE_URL}/status`);
        
        console.log('Estado del cliente:', response.data.message);
        return response.data.isReady;
        
    } catch (error) {
        console.error('❌ Error al verificar estado del cliente:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data.error);
        } else {
            console.error('Error:', error.message);
        }
        return false;
    }
}

// Función para probar el endpoint de envío de mensaje con imagen
async function testSendWithImage() {
    try {
        const testData = {
            numeroDestino: '1234567890', // Reemplaza con un número real
            mensaje: '¡Mira esta imagen de prueba! 🖼️',
            imageUrl: 'https://picsum.photos/400/300' // Imagen de prueba desde Lorem Picsum
        };

        console.log('Enviando mensaje con imagen...');
        console.log('Datos:', testData);

        const response = await axios.post(`${API_BASE_URL}/send-with-image`, testData);
        
        console.log('✅ Respuesta exitosa:');
        console.log('Mensaje:', response.data.message);
        console.log('Información de la imagen:', response.data.imageInfo);
        
    } catch (error) {
        console.error('❌ Error al enviar mensaje con imagen:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data.error);
            if (error.response.data.details) {
                console.error('Detalles:', error.response.data.details);
            }
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Función para probar el endpoint de envío de mensaje de texto
async function testSendText() {
    try {
        const testData = {
            numeroDestino: '1234567890', // Reemplaza con un número real
            mensaje: '¡Hola! Este es un mensaje de prueba desde la API. 📱'
        };

        console.log('Enviando mensaje de texto...');
        console.log('Datos:', testData);

        const response = await axios.post(`${API_BASE_URL}/send`, testData);
        
        console.log('✅ Respuesta exitosa:');
        console.log('Mensaje:', response.data.message);
        
    } catch (error) {
        console.error('❌ Error al enviar mensaje de texto:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data.error);
            if (error.response.data.details) {
                console.error('Detalles:', error.response.data.details);
            }
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Función para obtener mensajes recibidos
async function testGetMessages() {
    try {
        console.log('Obteniendo mensajes recibidos...');

        const response = await axios.get(`${API_BASE_URL}/messages`);
        
        console.log('✅ Mensajes recibidos:');
        console.log('Cantidad:', response.data.messages.length);
        response.data.messages.forEach((msg, index) => {
            console.log(`${index + 1}. De: ${msg.from} - ${msg.body}`);
        });
        
    } catch (error) {
        console.error('❌ Error al obtener mensajes:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Error:', error.response.data.error);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Ejecutar las pruebas
async function runTests() {
    console.log('🚀 Iniciando pruebas de la API de WhatsApp...\n');
    
    // Primero verificar el estado del cliente
    console.log('0️⃣ Verificando estado del cliente:');
    const isReady = await checkClientStatus();
    console.log('\n' + '='.repeat(50) + '\n');
    
    if (!isReady) {
        console.log('⚠️  El cliente no está listo. Asegúrate de:');
        console.log('   1. Haber iniciado el servidor con: npm start');
        console.log('   2. Haber escaneado el código QR en la terminal');
        console.log('   3. Esperar a que aparezca "Client is ready!" en la consola');
        console.log('\n🔄 Ejecuta las pruebas nuevamente cuando el cliente esté listo.');
        return;
    }
    
    console.log('1️⃣ Probando envío de mensaje con imagen:');
    await testSendWithImage();
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('2️⃣ Probando envío de mensaje de texto:');
    await testSendText();
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('3️⃣ Probando obtención de mensajes:');
    await testGetMessages();
    console.log('\n' + '='.repeat(50) + '\n');
    
    console.log('✅ Pruebas completadas!');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runTests();
}

module.exports = {
    checkClientStatus,
    testSendWithImage,
    testSendText,
    testGetMessages
}; 