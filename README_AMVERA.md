# Запуск SONA на Amvera

Проект готов к запуску как Node.js-приложение без сборки фронтенда.

## Параметры Amvera

- Environment: `nodejs`
- Toolchain: `npm`, Node `20`
- Command: `npm run start`
- Container port: `8000`
- Config file: `amvera.yml`

## Локальная проверка

```bash
npm run check
npm run start
```

По умолчанию сервер слушает `0.0.0.0:8000`. Для локального порта 3000:

```bash
PORT=3000 npm run start
```

На Windows PowerShell, если заблокирован `npm.ps1`, используйте:

```powershell
npm.cmd run check
$env:PORT=3000; npm.cmd run start
```

## SMS-вход

Если переменная `SMSRU_API_ID` не задана, вход по телефону работает в демо-режиме: код выводится в логи сервера.
Для реальной отправки SMS добавьте `SMSRU_API_ID` в переменные окружения Amvera.
