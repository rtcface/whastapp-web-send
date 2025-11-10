# Guía de Solución de Problemas - WhatsApp Web.js

## Problema: Evento 'ready' no se dispara después de la autenticación

### Síntomas
- El evento `authenticated` se dispara correctamente
- El evento `ready` nunca se dispara
- El evento `authenticated` se dispara múltiples veces (2-3 veces)
- Después de 90 segundos aparece el timeout de `ready`
- El cliente se desconecta con razón `LOGOUT`

### Causa
Este es un **problema conocido** con `whatsapp-web.js` versión 1.31.0. WhatsApp Web cambió su interfaz y el selector que usa la librería para detectar que está completamente cargado ya no funciona.

### Soluciones

#### Solución 1: Actualizar la librería (Recomendado)
```bash
npm install whatsapp-web.js@latest
```

Si la versión más reciente no está disponible o tiene el mismo problema, intenta instalar una versión específica con fix:
```bash
npm install whatsapp-web.js@1.23.0
```

#### Solución 2: Usar un fork con hotfix
Algunos desarrolladores han creado forks con fixes para este problema:
```bash
npm install https://github.com/pedroslopez/whatsapp-web.js.git
```

#### Solución 3: Modificar el código fuente (Temporal)
Si necesitas una solución inmediata, puedes modificar el archivo en `node_modules`:

1. Abre: `node_modules/whatsapp-web.js/src/Client.js`
2. Busca la línea con `INTRO_IMG_SELECTOR` (alrededor de la línea 175)
3. Cámbiala a:
   ```javascript
   const INTRO_IMG_SELECTOR = 'div[role=\'textbox\']';
   ```

**Nota:** Esta solución se perderá al reinstalar las dependencias.

#### Solución 4: Limpiar la sesión y reiniciar
1. Limpia la sesión guardada:
   ```bash
   POST /api/whatsapp/clear-session
   ```
2. Reinicia el cliente:
   ```bash
   POST /api/whatsapp/restart
   ```
3. Escanea el nuevo código QR

#### Solución 5: Ejecutar en modo no-headless para debugging
Para ver qué está pasando en el navegador:
```bash
HEADLESS=false npm start
```

Esto abrirá una ventana del navegador donde puedes ver si WhatsApp Web está cargado correctamente.

### Diagnóstico

#### Usar el endpoint de diagnóstico
```bash
GET /api/whatsapp/diagnostics
```

Este endpoint proporciona:
- Eventos recibidos y su orden
- Errores del navegador
- Logs de la consola del navegador
- Contador de eventos `authenticated`
- Recomendaciones de solución

#### Verificar el estado
```bash
GET /api/whatsapp/status
```

Muestra:
- Si el cliente está listo
- Cuántas veces se disparó `authenticated`
- Tiempo desde la autenticación
- Advertencias si hay problemas

### Verificación del problema

Si ves en los logs:
- `[ADVERTENCIA] Evento 'authenticated' disparado X veces` → Problema confirmado
- `[ERROR] El evento 'ready' no se disparó después de 90 segundos` → Problema confirmado
- Múltiples eventos `authenticated` en `/api/whatsapp/diagnostics` → Problema confirmado

### Prevención

1. Mantén la librería actualizada
2. Revisa los issues en GitHub: https://github.com/pedroslopez/whatsapp-web.js/issues
3. Usa el endpoint de diagnóstico regularmente
4. Monitorea los logs para detectar el problema temprano

### Recursos

- Repositorio oficial: https://github.com/pedroslopez/whatsapp-web.js
- Issues conocidos: https://github.com/pedroslopez/whatsapp-web.js/issues
- Documentación: https://wwebjs.dev/

### Notas Importantes

- **No uses esta librería en producción** sin tener un plan de contingencia
- WhatsApp puede bloquear tu número si detecta uso automatizado
- Considera usar la API oficial de WhatsApp Business para producción
- Esta librería es para uso personal/educacional

