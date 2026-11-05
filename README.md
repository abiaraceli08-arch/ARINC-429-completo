# ARINC-429-completo

Aplicación didáctica para simular transmisiones ARINC 429 en un servidor local. Usa Express para la interfaz/API y SQLite para guardar instrumentos e historial en el equipo local.

## Requisitos

- Node.js 18 o posterior
- npm

## Instalación y ejecución

Desde la carpeta del proyecto:

```sh
npm install
npm start
```

Abre <http://127.0.0.1:3000>. El servidor escucha únicamente en la interfaz local de la computadora. La base de datos `arinc429_local.db` se crea automáticamente en la carpeta del proyecto y se inicializa con tres instrumentos si está vacía.

Para usar otro puerto, define la variable de entorno `PORT`. Para guardar la base de datos en otra ruta, define `ARINC_DB_PATH`.

## API local

- `GET /api/instrumentos`: lista los instrumentos configurados.
- `POST /api/transmitir`: codifica y guarda una transmisión. JSON esperado: `{"label": 131, "valor": 3000}`; las etiquetas enviadas son el valor decimal de la etiqueta octal (por ejemplo, octal `203` = decimal `131`).
- `GET /api/historial?limit=20`: devuelve las transmisiones recientes (máximo 100).
- WebSocket: notifica nuevas transmisiones a clientes conectados.

Las etiquetas disponibles y los rangos de valores se consultan en `GET /api/instrumentos`. Las solicitudes inválidas o fuera de rango devuelven un error JSON y no se guardan.

## Pruebas

```sh
npm test
```

Las pruebas arrancan una instancia aislada y usan una base SQLite temporal; no modifican la base local habitual.

> La codificación BNR actual es una simulación educativa simplificada y no debe usarse como implementación certificada para equipos aeronáuticos.
