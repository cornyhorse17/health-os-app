# Health OS App

Личная рабочая среда здоровья (PWA для iPhone). Код — здесь (публично, без данных); данные — в приватном репозитории `health-os-data`.

- Требования и архитектура: [SPEC.md](SPEC.md)
- Что дальше: [BACKLOG.md](BACKLOG.md) · История: [CHANGELOG.md](CHANGELOG.md)

## Установка на iPhone
1. Открой адрес приложения в Safari: `https://<логин>.github.io/health-os-app/`.
2. Вставь GitHub-токен (fine-grained, только `health-os-data`, Contents: Read and write) или открой демо.
3. «Поделиться» → «На экран „Домой“».

## Разработка
Без сборки: HTML + ES-модули, Preact + htm, uPlot, marked (локально в `/vendor`). Локально: `python3 -m http.server` в корне, открыть `http://localhost:8000` → «Демо-режим».
Правила доработок: точечные правки, стек не менять, каждое изменение — запись в CHANGELOG и версия в `app/more.js` (APP_VERSION) и `sw.js` (VERSION).
