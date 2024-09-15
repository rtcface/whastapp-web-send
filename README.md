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
