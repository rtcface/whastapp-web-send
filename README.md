# 📱 WhatsApp Web API

Este proyecto es una API para interactuar con WhatsApp utilizando `whatsapp-web.js` y `express`. Permite enviar y recibir mensajes a través de WhatsApp.

## 🚀 Características

- 📷 Generación de código QR para la autenticación de WhatsApp Web.
- 📥 Recepción y almacenamiento de mensajes entrantes.
- 🤖 Respuesta automática a comandos específicos.
- ✉️ Envío de mensajes de texto a números de WhatsApp.
- 🖼️ Envío de mensajes con imágenes desde URLs.
- 🔍 Verificación del estado del cliente de WhatsApp.

## 📋 Requisitos

- 🟢 Node.js
- 📦 npm

## 🛠️ Instalación

1. Clona este repositorio:
   ```bash
   git clone https://github.com/ramiroec/whatsapp-web-api.git
   ```
2. Navega al directorio del proyecto:
   ```bash
   cd whatsapp-web-api
   ```
3. Instala las dependencias:
   ```bash
   npm install
   ```

## 🚀 Uso

1. Inicia el servidor:
   ```bash
   npm start
   ```
2. Escanea el código QR que se genera en la terminal con tu aplicación de WhatsApp.
3. Espera a que aparezca "Client is ready!" en la consola.

### 📡 Endpoints

#### Verificar estado del cliente

```http
GET /api/whatsapp/status
```

**Respuesta:**

```json
{
  "isReady": true,
  "message": "Cliente listo"
}
```

#### Enviar un mensaje de texto

```http
POST /api/whatsapp/send
```

**Parámetros del cuerpo:**

- `numeroDestino`: Número de WhatsApp del destinatario (ej. `1234567890`).
- `mensaje`: Texto del mensaje a enviar.

**Ejemplo:**

```json
{
  "numeroDestino": "1234567890",
  "mensaje": "¡Hola! Este es un mensaje de prueba."
}
```

#### Enviar un mensaje con imagen desde URL

```http
POST /api/whatsapp/send-with-image
```

**Parámetros del cuerpo:**

- `numeroDestino`: Número de WhatsApp del destinatario (ej. `1234567890`).
- `mensaje`: Texto del mensaje que aparecerá como caption de la imagen.
- `imageUrl`: URL de la imagen a enviar.

**Ejemplo:**

```json
{
  "numeroDestino": "1234567890",
  "mensaje": "¡Mira esta imagen!",
  "imageUrl": "https://ejemplo.com/imagen.jpg"
}
```

**Formatos de imagen soportados:**

- JPEG/JPG
- PNG
- GIF
- WebP

#### Obtener mensajes recibidos

```http
GET /api/whatsapp/messages
```

## 🧪 Pruebas

Para probar los endpoints, puedes usar el script incluido:

```bash
npm run test-endpoint
```

Este script verificará automáticamente el estado del cliente antes de ejecutar las pruebas.

## 🔧 Solución de Problemas

### Error: "WhatsApp client no está listo"

**Causa:** El cliente de WhatsApp no se ha autenticado correctamente.

**Solución:**

1. Asegúrate de que el servidor esté ejecutándose: `npm start`
2. Escanea el código QR que aparece en la terminal
3. Espera a que aparezca "Client is ready!" en la consola
4. Verifica el estado con: `GET /api/whatsapp/status`

### Error: "Protocol error"

**Causa:** Error temporal de conexión con WhatsApp Web.

**Solución:**

1. Espera unos segundos y vuelve a intentar
2. Si persiste, reinicia el servidor
3. Verifica tu conexión a internet

### Error: "Cannot read properties of undefined (reading 'getChat')"

**Causa:** El cliente intenta enviar mensajes antes de estar completamente inicializado.

**Solución:**

1. Verifica que el cliente esté listo con el endpoint `/status`
2. Asegúrate de haber escaneado el código QR
3. Espera a que aparezca "Client is ready!" antes de enviar mensajes

## 📜 Licencia

<p>Este proyecto se encuentra bajo la licencia MIT.</p>

## 🤝 Contribuciones

<p>Si deseas contribuir a este proyecto, por favor, crea un pull request con tus cambios.</p>

## 🌟 Créditos

Proyecto desarrollado con ❤️ por [Ramiro Estigarribia Canese](https://github.com/ramiroec).
