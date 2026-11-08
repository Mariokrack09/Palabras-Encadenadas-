# Palabras encadenadas — multijugador (Android + iPhone)

Estructura:
- `server/`  Servidor Node.js (WebSockets). Autoritativo: valida palabras, turnos y tiempo.
- `app/`     App móvil (Capacitor) con la interfaz web en `app/www`.

## 1. Servidor (gratis en Render)
1. Sube la carpeta `server/` a un repositorio de GitHub.
2. En render.com: New > Web Service > conecta el repo.
   Build command: `npm install`   Start command: `npm start`
3. Copia la URL que te dan, p. ej. `https://palabras-abc.onrender.com`.
   Prueba en el navegador: debe decir "Palabras encadenadas OK".
(Plan gratuito: el servidor se "duerme" tras inactividad; la primera conexión tarda ~30 s.)

## 2. Configurar la app
Edita `app/www/config.js` y pon tu URL con `wss://` (no `https://`):
    window.SERVER_URL = "wss://palabras-abc.onrender.com";

## 3. Generar las apps
Requisitos: Node 18+. Android: Android Studio. iPhone: un Mac con Xcode.

    cd app
    npm install
    npx cap add android
    npx cap add ios        # solo en Mac
    npx cap sync

Android:  `npx cap open android` > Run (o Build > Generate Signed Bundle para Google Play).
iPhone:   `npx cap open ios` > selecciona tu equipo de firma > Run (o Archive para App Store).

## Publicar en tiendas
- Google Play: cuenta de desarrollador (pago único 25 USD).
- App Store: Apple Developer Program (99 USD/año). Cambia `appId` en `capacitor.config.json`.

## Probar sin compilar
Abre `app/www/index.html` en dos pestañas del navegador, misma sala, para ver el multijugador.
