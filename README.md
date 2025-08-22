# Bot francotirador de blockchain de Tron

## Descripción general
Este proyecto es un bot de francotirador para la blockchain de Tron, diseñado para permitir a los usuarios comprar y vender tokens rápidamente en la red de Tron. Utiliza el enrutador inteligente de SunSwap para ejecutar operaciones a los mejores precios con un enrutamiento dinámico más rápido para los pares de intercambio.

## Key Features
- Operaciones rápidas de tokens: ejecute órdenes de compra y venta rápidamente en la cadena de bloques Tron.
- Enrutamiento optimizado: utiliza el enrutador inteligente de SunSwap para lograr la mejor ejecución de precios y rutas comerciales eficientes.
- Interfaz de bot de Telegram: interactúa con el bot a través de comandos de Telegram.

## Prerequisites
- Node.js
- MongoDB
- Tron API Key
- Telegram Bot Token id

## Link al bot
- https://t.me/Tronicorn_Bot

## Installation
1. Clonar el repositorio
2. Instalar dependecias:
   ```
   npm install
   ```
3. Configurar variables de entorno en un `.env` archivo:
   ```
   BOT_TOKEN=your_telegram_bot_token
   TRON_FULL_HOST=https://api.trongrid.io
   API_KEY=your_tron_api_key
   PRIVATE_KEY=your_private_key
   ENCRYPTION_KEY=your_encryption_key
   DATABASE_URI=your_mongodb_connection_string
   ```

## Uso
1. Iniciar el bot:
   ```
   node src/main.js
   ```
2. Interactúa con el bot en Telegram usando los siguientes comandos:
   - `/start`: Crea una nueva dirección y billetera TRON
   - `/balance`: Consulta tus saldos de tokens TRX y TRC20
   - `/swap`: Intercambie tokens utilizando el enrutador inteligente de SunSwap

## Estructura del proyecto
- `src/main.js`: Punto de entrada de la aplicación
- `src/commands/`: Punto de entrada de la aplicación
- `src/utils/`: Funciones de utilidad que incluyen configuración web de Tron y operaciones de base de datos
- `src/service/`: Capa de servicio para operaciones relacionadas con el usuario
- `src/model/`: Definiciones de esquema de MongoDB
- `src/config/`: Constantes y ajustes de configuración

## Componentes clave
1. Integración web de Tron:
   ```javascript:src/utils/tron.js
   startLine: 7
   endLine: 11
   ```

2. Comandos de bots de Telegram:
   ```javascript:src/main.js
   startLine: 20
   endLine: 38
   ```

3. Intercambio de tokens:
   ```javascript:src/commands/swap.js
   startLine: 26
   endLine: 77
   ```

4. Operaciones de base de datos:
   ```javascript:src/service/user.service.js
   startLine: 5
   endLine: 107
   ```
