# Карты против всех

Многопользовательская веб-игра, основанная на популярной карточной игре "Карты против человечества" (Cards Against Humanity).

## Установка и запуск

1. Установите Node.js (если не установлен)
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Запустите сервер:
   ```bash
   npm start
   ```
4. Откройте браузер и перейдите на http://localhost:3000

## Правила игры

### Основные правила
- Количество игроков: от 2 до 10 человек
- Каждый игрок получает в руку 10 Светлых карт
- Один игрок назначается Карточным Гуру на раунд
- Гуру вытягивает Темную карту (вопрос или фразу с пропуском)
- Остальные игроки выбирают Светлую карту в качестве ответа
- Гуру выбирает лучший ответ
- Победитель получает Темную карту как очко
- Роль Гуру переходит к следующему игроку

### Как играть
1. Введите своё имя
2. Создайте игру или присоединитесь к существующей (по ID)
3. Дождитесь других игроков (минимум 2)
4. Начните игру
5. Выбирайте карты в ответ на вопрос Гуру
6. Если вы Гуру - выбирайте лучший ответ
7. Играйте до тех пор, пока не закончатся карты!

## Структура файлов

- `server.js` - серверная часть на Node.js с Socket.IO
- `cards.json` - файл с картами (можно редактировать)
- `public/index.html` - HTML интерфейс
- `public/style.css` - стили
- `public/client.js` - клиентская логика

## Настройка карт

Вы можете редактировать файл `cards.json` для изменения содержимого карт:

```json
{
  "darkCards": [
    "Ваш вопрос или фраза с пропуском _____"
  ],
  "lightCards": [
    "Ваш ответ или слово"
  ]
}
```

### Типы темных карт:
- Вопросы: "Что помогает мне расслабиться?"
- Фразы с пропуском: "_____ - это ловушка!"
- Фразы с несколькими пропусками: "_____ + _____ = идеальное свидание"

## Особенности

- Реальное время через WebSocket
- Адаптивный дизайн для мобильных устройств
- Автоматическое управление состоянием игры
- Система очков
- Красивый интерфейс с анимациями

## Технологии

- Node.js
- Express
- Socket.IO
- Vanilla JavaScript
- CSS3 с анимациями

## Разработка

Для разработки используйте:
```bash
npm run dev
```

Это запустит сервер с автоматической перезагрузкой при изменении файлов.

## Порт

По умолчанию сервер запускается на порту 3000. Вы можете изменить это, установив переменную окружения PORT:

```bash
PORT=8080 npm start
```
