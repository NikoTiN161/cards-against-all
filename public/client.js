const socket = io();

let gameState = null;
let playerId = null;
let playerHand = [];
let selectedCard = null;
let currentGameId = null;

// Проверка на наличие gameId в URL
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('game');
    if (gameIdFromUrl) {
        createGameButton.style.display = 'none';
        gameIdInput.style.display = 'block';
        gameIdInput.value = gameIdFromUrl;
        playerNameInput.focus();
    }
});

// Система уведомлений
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        this.notifications = [];
    }

    show(message, type = 'info', title = '', duration = 3000) {
        const notification = this.createNotification(message, type, title, duration);
        this.container.appendChild(notification);
        this.notifications.push(notification);

        // Автоматическое удаление
        setTimeout(() => {
            this.remove(notification);
        }, duration);

        return notification;
    }

    createNotification(message, type, title, duration) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => this.remove(notification);
        
        let content = '';
        if (title) {
            content += `<div class="notification-title">${title}</div>`;
        }
        content += `<div class="notification-message">${message}</div>`;
        
        notification.innerHTML = content;
        notification.appendChild(closeBtn);
        
        return notification;
    }

    remove(notification) {
        if (notification && notification.parentNode) {
            notification.classList.add('slide-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                const index = this.notifications.indexOf(notification);
                if (index > -1) {
                    this.notifications.splice(index, 1);
                }
            }, 300);
        }
    }

    success(message, title = 'Успех!') {
        return this.show(message, 'success', title);
    }

    error(message, title = 'Ошибка!') {
        return this.show(message, 'error', title);
    }

    info(message, title = 'Информация') {
        return this.show(message, 'info', title);
    }

    warning(message, title = 'Внимание!') {
        return this.show(message, 'warning', title);
    }
}

const notifications = new NotificationSystem();

// --- Переменные для восстановления сессии ---
function saveSession(playerId, gameId, playerName) {
    localStorage.setItem('caa_playerId', playerId);
    localStorage.setItem('caa_gameId', gameId);
    localStorage.setItem('caa_playerName', playerName);
}
function clearSession() {
    localStorage.removeItem('caa_playerId');
    localStorage.removeItem('caa_gameId');
    localStorage.removeItem('caa_playerName');
}
function getSession() {
    return {
        playerId: localStorage.getItem('caa_playerId'),
        gameId: localStorage.getItem('caa_gameId'),
        playerName: localStorage.getItem('caa_playerName'),
    };
}
// --- Переподключение ---
function tryReconnect() {
    const session = getSession();
    if (session.playerId && session.gameId && session.playerName) {
        socket.emit('reconnectPlayer', {
            playerId: session.playerId,
            gameId: session.gameId,
            playerName: session.playerName
        });
    }
}

// DOM элементы
const lobby = document.getElementById('lobby');
const gameDiv = document.getElementById('game');
const playerNameInput = document.getElementById('playerName');
const gameIdInput = document.getElementById('gameId');
const gameIdContainer = document.getElementById('gameIdContainer');
const gameIdDisplay = document.getElementById('gameIdDisplay');
const copyGameIdButton = document.getElementById('copyGameIdButton');
const burgerButton = document.getElementById('burgerButton');
const burgerContent = document.getElementById('burgerContent');
const selectedCardDisplay = document.getElementById('selectedCardDisplay');
const selectedCardContent = document.getElementById('selectedCardContent');
const createGameButton = document.getElementById('createGameButton');
const joinGameButton = document.getElementById('joinGameButton');
const startGameButton = document.getElementById('startGameButton');
const nextRoundButton = document.getElementById('nextRoundButton');
const gameInfo = document.getElementById('gameInfo');
const handDiv = document.getElementById('hand');
const submittedCardsDiv = document.getElementById('submittedCards');
const playersListDiv = document.getElementById('players');
const header = document.getElementById('header');

// Обработчики событий
createGameButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
        notifications.error('Введите ваше имя', 'Ошибка');
        return;
    }
    socket.emit('createGame', { playerName });
});

joinGameButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    const gameId = gameIdInput.value.trim();
    
    if (!playerName) {
        notifications.error('Введите ваше имя', 'Ошибка');
        return;
    }
    
    if (!gameId) {
        notifications.error('Введите ID комнаты', 'Ошибка');
        // Показать поле для ввода ID игры
        // gameIdInput.style.display = 'block';
        // gameIdInput.focus();
        return;
    }
    
    socket.emit('joinGame', { gameId, playerName });
});

startGameButton.addEventListener('click', () => {
    socket.emit('startGame');
});

nextRoundButton.addEventListener('click', () => {
    socket.emit('nextRound');
});

copyGameIdButton.addEventListener('click', () => {
    copyGameId();
});

// Обработчик бургер-меню
burgerButton.addEventListener('click', (e) => {
    e.stopPropagation();
    burgerContent.classList.toggle('active');
});

// Закрытие бургер-меню при клике вне его области
document.addEventListener('click', (e) => {
    if (!burgerContent.contains(e.target) && !burgerButton.contains(e.target)) {
        burgerContent.classList.remove('active');
    }
});

// Предотвращение закрытия меню при клике внутри него
burgerContent.addEventListener('click', (e) => {
    e.stopPropagation();
});

// Socket.IO обработчики
socket.on('gameCreated', (data) => {
    gameState = data.game;
    playerId = data.playerId;
    playerHand = data.hand;
    currentGameId = data.gameId;
    saveSession(playerId, currentGameId, playerNameInput.value.trim());
    
    lobby.style.display = 'none';
    header.style.display = 'none';
    gameDiv.style.display = 'block';
    
    // Показываем ID игры и кнопку копирования
    gameIdDisplay.value = data.gameId;
    gameIdContainer.style.display = 'block';
    
    const newUrl = `${window.location.origin}${window.location.pathname}?game=${data.gameId}`;
    window.history.replaceState(null, '', newUrl);
    
    notifications.success(`Игра создана! ID: ${data.gameId}`, 'Игра создана');
    updateGameInfo();
    updatePlayersList();
    updateHand();
});

socket.on('gameJoined', (data) => {
    gameState = data.game;
    playerId = data.playerId;
    playerHand = data.hand;
    saveSession(playerId, gameState.id, playerNameInput.value.trim());
    
    lobby.style.display = 'none';
    header.style.display = 'none';
    gameDiv.style.display = 'block';
    
    notifications.success('Вы успешно присоединились к игре!', 'Присоединение');
    updateGameInfo();
    updatePlayersList();
    updateHand();
});

socket.on('playerJoined', (data) => {
    gameState = data.game;
    // Найти нового игрока (последний в списке)
    const newPlayer = gameState.players[gameState.players.length - 1];
    if (newPlayer) {
        notifications.info(`${newPlayer.name} присоединился к игре`, 'Новый игрок');
    }
    updateGameInfo();
    updatePlayersList();
});

socket.on('playerLeft', (data) => {
    gameState = data.game;
    notifications.warning('Игрок покинул игру', 'Игрок отключился');
    updateGameInfo();
    updatePlayersList();
});

socket.on('gameStarted', (data) => {
    gameState = data.game;
    notifications.success('Игра началась! Удачи!', 'Начало игры');
    updateGameInfo();
    updatePlayersList();
});

socket.on('handUpdated', (data) => {
    playerHand = data.hand;
    if (data.selectedCard) {
        selectedCard = data.selectedCard;
    }
    updateHand();
    updateSelectedCard();
});

socket.on('gameUpdated', (data) => {
    gameState = data.game;
    
    // Уведомление о переходе к голосованию
    if (gameState.gameState === 'voting') {
        const currentPlayer = gameState.players.find(p => p.id === playerId);
        if (currentPlayer?.isGuru) {
            notifications.info('Все карты собраны! Выберите лучший ответ', 'Время голосования');
        } else {
            notifications.info('Все карты собраны! Ждите решения Гуру', 'Время голосования');
        }
        // Скрыть карты на руке когда все игроки выбрали карты
        handDiv.style.display = 'none';
    }
    
    updateGameInfo();
    updateSubmittedCards();
    updateSelectedCard();
});

socket.on('roundEnded', (data) => {
    gameState = data.game;
    console.log('Round ended:', data);
    const winnerCardText = data.winnerCardText;
    updateGameInfo();
    updateSubmittedCards();
    
    const winnerName = gameState.players.find(p => p.id === data.winner)?.name || 'Неизвестно';
    const cardDisplay = selectedCardDisplay.querySelector('h3');
    cardDisplay.textContent = "Победитель:";
    selectedCardContent.textContent = winnerCardText;
    setTimeout(() => {
        notifications.info(`Победитель раунда: ${winnerName}!`, 'Раунд окончен');
    }, 1000);
    
});

socket.on('newRound', (data) => {
    gameState = data.game;
    selectedCard = null;
    // Показать карты снова при новом раунде
    handDiv.style.display = 'flex';
    const cardDisplay = selectedCardDisplay.querySelector('h3');
    cardDisplay.textContent = "Выбранная карта:";
    selectedCardContent.textContent = '';
    
    const currentPlayer = gameState.players.find(p => p.id === playerId);
    if (currentPlayer?.isGuru) {
        notifications.info('Вы стали Гуру этого раунда!', 'Новая роль');
    } else {
        notifications.info('Начался новый раунд. Выберите карту!', 'Новый раунд');
    }
    
    updateGameInfo();
    updatePlayersList();
    updateHand();
    updateSubmittedCards();
    updateSelectedCard();
});

socket.on('error', (data) => {
    notifications.error(data.message, 'Ошибка');
});

// При переподключении сокета
socket.on('reconnect', () => {
    tryReconnect();
});

// При загрузке страницы, если есть сессия, пробуем восстановить
window.addEventListener('DOMContentLoaded', () => {
    const session = getSession();
    if (session.playerId && session.gameId && session.playerName) {
        tryReconnect();
    }
});

// Сервер должен вернуть событие 'reconnected' или 'gameJoined' при успехе, либо 'error' при неудаче
socket.on('reconnected', (data) => {
    gameState = data.game;
    playerId = data.playerId;
    playerHand = data.hand;
    currentGameId = data.gameId;
    notifications.success('Сессия восстановлена!', 'Переподключение');
    lobby.style.display = 'none';
    header.style.display = 'none';
    gameDiv.style.display = 'block';
    updateGameInfo();
    updatePlayersList();
    updateHand();
});

// Функции обновления UI
function updateGameInfo() {
    if (!gameState) return;
    
    const currentPlayer = gameState.players.find(p => p.id === playerId);
    const isGuru = currentPlayer?.isGuru || false;
    const isHost = currentPlayer?.isHost || false;
    
    let html = `
        <div class="status">
            <strong>Раунд ${gameState.currentRound}</strong> | 
            <strong>Статус:</strong> ${getGameStatusText()}
        </div>
    `;
    
    // Темная карта
    if (gameState.currentDarkCard) {
        html += `<div class="dark-card">${gameState.currentDarkCard}</div>`;
    }
    
    gameInfo.innerHTML = html;
    
    // Управление кнопками
    startGameButton.style.display = (gameState.gameState === 'waiting' && gameState.players.length >= 2 && isHost) ? 'block' : 'none';
    // startGameButton.style.display = (gameState.gameState === 'waiting' && gameState.players.length >= 2) ? 'block' : 'none';
    nextRoundButton.style.display = (gameState.gameState === 'roundEnd' && isGuru) ? 'block' : 'none';
}

function updateHand() {
    if (!playerHand || gameState?.gameState !== 'playing') {
        handDiv.innerHTML = '';
        return;
    }
    
    handDiv.innerHTML = '';
    playerHand.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        
        // Подсвечиваем выбранную карту
        if (selectedCard === card) {
            cardDiv.classList.add('selected');
        }
        
        cardDiv.textContent = card;
        cardDiv.addEventListener('click', () => selectCard(card));
        handDiv.appendChild(cardDiv);
    });
}

function selectCard(card) {
    // const currentPlayer = gameState.players.find(p => p.id === playerId);
    // if (currentPlayer?.isGuru) {
    //     notifications.error('Вы не можете подавать карты', 'Ошибка');
    //     return;
    // }

    if (gameState?.gameState !== 'playing') return;
    
    selectedCard = card;
    socket.emit('submitCard', { cardText: card });
    // notifications.success(`Карта "${card}" подана!`, 'Карта выбрана');
    updateSelectedCard();
}

function updateSelectedCard() {
    if (!selectedCard) {
        selectedCardDisplay.style.display = 'none';
        selectedCardContent.textContent = '';
        return;
    }
    selectedCardDisplay.style.display = 'block';
    selectedCardContent.textContent = selectedCard;
}

function updateSubmittedCards() {
    if (!gameState || gameState.gameState !== 'voting') {
        submittedCardsDiv.innerHTML = '';
        return;
    }
    
    const currentPlayer = gameState.players.find(p => p.id === playerId);
    const isGuru = currentPlayer?.isGuru || false;
    
    // Заголовок для всех игроков
    if (isGuru) {
        submittedCardsDiv.innerHTML = '<h3>Выберите лучший ответ:</h3>';
    } else {
        submittedCardsDiv.innerHTML = '<h3>Варианты ответов:</h3><div class="status">Дождитесь, пока Гуру выберет победителя...</div>';
    }
    
    // Показываем все поданные карты всем игрокам
    if (gameState.submittedCards && gameState.submittedCards.length > 0) {
        gameState.submittedCards.forEach(([playerIdCard, cardText]) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'submitted-card';
            cardDiv.textContent = cardText;
            
            // Только Гуру может кликать по картам для выбора победителя
            if (isGuru) {
                cardDiv.classList.add('clickable');
                cardDiv.addEventListener('click', () => {
                    socket.emit('selectWinner', { winnerId: playerIdCard, cardText: cardText });
                });
            }
            
            submittedCardsDiv.appendChild(cardDiv);
        });
    }
}

function updatePlayersList() {
    if (!gameState || !playersListDiv) return;
    
    playersListDiv.innerHTML = '';
    
    // Сортируем игроков по счету (по убыванию)
    const sortedPlayers = [...gameState.players].sort((a, b) => {
        const scoreA = gameState.scores[a.id] || 0;
        const scoreB = gameState.scores[b.id] || 0;
        return scoreB - scoreA;
    });
    
    const maxScore = Math.max(...Object.values(gameState.scores || {}), 0);
    
    sortedPlayers.forEach(player => {
        const li = document.createElement('li');
        const score = gameState.scores[player.id] || 0;
        const isLeader = score === maxScore && score > 0;
        
        // Основной текст
        li.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-score">${score}</span>
        `;
        
        // Классы для стилизации
        if (player.isGuru) {
            li.classList.add('guru');
            li.querySelector('.player-name').textContent += ' (Гуру)';
        }
        
        if (player.id === playerId) {
            li.classList.add('current');
            li.querySelector('.player-name').textContent += ' (Вы)';
        }
        
        if (isLeader) {
            li.classList.add('leader');
        }
        
        playersListDiv.appendChild(li);
    });
}

function copyGameId() {
    if (currentGameId) {
        const gameUrl = `${window.location.origin}${window.location.pathname}?game=${currentGameId}`;
        navigator.clipboard.writeText(gameUrl).then(() => {
            notifications.success('Ссылка на игру скопирована!', 'Копирование');
        }).catch(() => {
            // Для старых браузеров
            gameIdDisplay.select();
            document.execCommand('copy');
            notifications.success('Ссылка на игру скопирована!', 'Копирование');
        });
    }
}

function getGameStatusText() {
    switch (gameState?.gameState) {
        case 'waiting':
            return 'Ожидание игроков';
        case 'playing':
            return 'Выбор карт';
        case 'voting':
            return 'Гуру выбирает победителя';
        case 'roundEnd':
            return 'Конец раунда';
        case 'finished':
            return 'Игра окончена';
        default:
            return 'Неизвестно';
    }
}
