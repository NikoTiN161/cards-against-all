const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Загрузка карт
const cardsData = JSON.parse(fs.readFileSync('cards.json', 'utf8'));

// Состояние игры
const games = new Map();

// Статические файлы
app.use(express.static('public'));

// Классы для игры
class Game {
    constructor(id) {
        this.id = id;
        this.players = new Map();
        this.darkCards = [...cardsData.darkCards];
        this.lightCards = [...cardsData.lightCards];
        this.trashLightCards = [];
        this.trashDarkCards = [];
        this.currentRound = 0;
        this.currentGuru = null;
        this.currentDarkCard = null;
        this.submittedCards = new Map();
        this.winnerCardText = null;
        this.gameState = 'waiting'; // waiting, playing, voting, roundEnd
        this.maxPlayers = 10;
        this.minPlayers = 2;
        this.scores = new Map();
        this.host = null;
    }

    addPlayer(playerId, playerName, isHost) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }
        
        const player = {
            id: playerId,
            name: playerName,
            hand: [],
            isGuru: false,
            isHost: isHost || false,
            connected: true
        };
        
        this.players.set(playerId, player);
        this.scores.set(playerId, 0);
        
        // Раздать карты новому игроку
        this.dealCards(playerId);
        
        return true;
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        this.scores.delete(playerId);
        this.submittedCards.delete(playerId);
    }

    dealCards(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        while (player.hand.length < 10 && this.lightCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.lightCards.length);
            const card = this.lightCards.splice(randomIndex, 1)[0];
            player.hand.push(card);
        }

    }

    dealCardsToAll() {
        for (const player of this.players.values()) {
            this.dealCards(player.id);
        }
    }

    startGame() {
        if (this.players.size < this.minPlayers) {
            return false;
        }

        this.gameState = 'playing';
        this.currentRound = 1;
        this.selectRandomGuru();
        this.drawDarkCard();
        this.dealCardsToAll();
        
        return true;
    }

    selectRandomGuru() {
        const playerIds = Array.from(this.players.keys());
        const randomIndex = Math.floor(Math.random() * playerIds.length);
        this.currentGuru = playerIds[randomIndex];
        
        // Сбросить статус гуру у всех игроков
        for (const player of this.players.values()) {
            player.isGuru = false;
        }
        
        // Установить нового гуру
        const guru = this.players.get(this.currentGuru);
        if (guru) {
            guru.isGuru = true;
        }
    }

    selectNextGuru() {
        const playerIds = Array.from(this.players.keys());
        const currentIndex = playerIds.indexOf(this.currentGuru);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        this.currentGuru = playerIds[nextIndex];
        
        // Сбросить статус гуру у всех игроков
        for (const player of this.players.values()) {
            player.isGuru = false;
        }
        
        // Установить нового гуру
        const guru = this.players.get(this.currentGuru);
        if (guru) {
            guru.isGuru = true;
        }
    }

    drawDarkCard() {
        if (this.darkCards.length === 0) {
            // Игра окончена
            this.gameState = 'finished';
            this.winnerCardText = 'Игра окончена!';
            return null;
        }

        const randomIndex = Math.floor(Math.random() * this.darkCards.length);
        this.currentDarkCard = this.darkCards.splice(randomIndex, 1)[0];
        return this.currentDarkCard;
    }

    submitCard(playerId, cardText) {
        if (this.gameState !== 'playing') return false;
        const player = this.players.get(playerId);
        if (!player) return false;
        if (player.isGuru) return false;
        const cardIndex = player.hand.indexOf(cardText);
        if (cardIndex === -1) return false;
        // НЕ убираем карту из руки игрока сейчас, только помечаем как выбранную
        player.selectedCard = cardText;
        // Добавить карту в поданные
        this.submittedCards.set(playerId, cardText);
        // Переход к голосованию, когда все НЕ-Гуру и подключенные игроки подали карты
        const allEligibleSubmitted = Array.from(this.players.values()).every(p => {
            // Гуру не подаёт карту, а отключенные игроки не учитываются
            return p.isGuru || !p.connected || this.submittedCards.has(p.id);
        });
        if (allEligibleSubmitted && this.submittedCards.size > 0) {
            this.gameState = 'voting';
        }
        return true;
    }

    selectWinner(winnerId, cardText) {
        if (this.gameState !== 'voting') return false;
        
        const submittedEntries = Array.from(this.submittedCards.entries());
        const winnerEntry = submittedEntries.find(([playerId, card]) => playerId === winnerId);
        
        if (!winnerEntry) return false;

        // Увеличить счет победителя
        const currentScore = this.scores.get(winnerId) || 0;
        this.scores.set(winnerId, currentScore + 1);
        this.winnerCardText = cardText;
        this.gameState = 'roundEnd';
        return true;
    }

    nextRound() {
        // Удалить выбранные карты из рук игроков
        for (const player of this.players.values()) {
            if (player.selectedCard) {
                const cardIndex = player.hand.indexOf(player.selectedCard);
                if (cardIndex !== -1) {
                    player.hand.splice(cardIndex, 1);
                }
                player.selectedCard = null;
            }
        }
        
        this.currentRound++;
        this.submittedCards.clear();
        this.currentDarkCard = null;
        this.selectNextGuru();
        this.drawDarkCard();
        this.dealCardsToAll();
        this.gameState = 'playing';
    }

    getGameState() {
        return {
            id: this.id,
            players: Array.from(this.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                isGuru: p.isGuru,
                isHost: p.isHost,
                connected: p.connected,
                handSize: p.hand.length
            })),
            currentRound: this.currentRound,
            currentGuru: this.currentGuru,
            currentDarkCard: this.currentDarkCard,
            gameState: this.gameState,
            submittedCount: this.submittedCards.size,
            scores: Object.fromEntries(this.scores),
            submittedCards: this.gameState === 'voting' ? Array.from(this.submittedCards.entries()) : []
        };
    }
}

// Таймеры на удаление игроков по playerId
const disconnectTimers = new Map();

// Socket.IO обработчики
io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    socket.on('createGame', (data) => {
        const { playerName } = data;
        const gameId = uuidv4();
        const game = new Game(gameId);
        games.set(gameId, game);
        
        // Добавляем создателя как первого игрока
        if (!game.addPlayer(socket.id, playerName, true)) {
            socket.emit('error', { message: 'Не удалось создать игру' });
            return;
        }
        
        socket.join(gameId);
        socket.gameId = gameId;
        socket.playerId = socket.id;
        
        const player = game.players.get(socket.id);
        socket.emit('gameCreated', { 
            gameId, 
            game: game.getGameState(),
            hand: player.hand,
            playerId: socket.id,
        });
    });

    socket.on('joinGame', (data) => {
        const { gameId, playerName } = data;
        const game = games.get(gameId);
        
        if (!game) {
            socket.emit('error', { message: 'Игра не найдена' });
            return;
        }

        if (!game.addPlayer(socket.id, playerName)) {
            socket.emit('error', { message: 'Не удалось присоединиться к игре' });
            return;
        }

        socket.join(gameId);
        socket.gameId = gameId;
        socket.playerId = socket.id;

        const player = game.players.get(socket.id);
        socket.emit('gameJoined', { 
            game: game.getGameState(), 
            hand: player.hand,
            playerId: socket.id
        });
        
        socket.to(gameId).emit('playerJoined', {
            game: game.getGameState()
        });
    });

    socket.on('startGame', () => {
        const game = games.get(socket.gameId);
        if (!game) return;

        if (game.startGame()) {
            io.to(socket.gameId).emit('gameStarted', {
                game: game.getGameState()
            });
            
            // Отправить карты каждому игроку
            for (const [playerId, player] of game.players) {
                const playerSocket = io.sockets.sockets.get(playerId);
                if (playerSocket) {
                    playerSocket.emit('handUpdated', { hand: player.hand });
                }
            }
        }
    });

    socket.on('submitCard', (data) => {
        const { cardText } = data;
        const game = games.get(socket.gameId);
        if (!game) return;

        if (game.submitCard(socket.id, cardText)) {
            const player = game.players.get(socket.id);
            socket.emit('handUpdated', { 
                hand: player.hand,
                selectedCard: player.selectedCard 
            });
            
            io.to(socket.gameId).emit('gameUpdated', {
                game: game.getGameState()
            });
        }
    });

    socket.on('selectWinner', (data) => {
        const { winnerId, cardText } = data;
        const game = games.get(socket.gameId);
        if (!game) return;

        // Проверить, что выбирает именно гуру
        if (socket.id !== game.currentGuru) return;

        if (game.selectWinner(winnerId, cardText)) {
            io.to(socket.gameId).emit('roundEnded', {
                game: game.getGameState(),
                winner: winnerId,
                winnerCardText: cardText
            });
        }
    });

    socket.on('nextRound', () => {
        const game = games.get(socket.gameId);
        if (!game) return;

        game.nextRound();
        
        io.to(socket.gameId).emit('newRound', {
            game: game.getGameState()
        });

        // Отправить обновленные карты каждому игроку
        for (const [playerId, player] of game.players) {
            const playerSocket = io.sockets.sockets.get(playerId);
            if (playerSocket) {
                playerSocket.emit('handUpdated', { hand: player.hand });
            }
        }
    });

    socket.on('reconnectPlayer', (data) => {
        const { playerId, gameId, playerName } = data;
        const game = games.get(gameId);
        if (!game) {
            socket.emit('error', { message: 'Игра не найдена' });
            return;
        }
        const player = game.players.get(playerId);
        if (!player) {
            socket.emit('error', { message: 'Игрок не найден в этой игре' });
            return;
        }
        // Обновляем socket.id и статус
        game.players.delete(playerId);
        player.id = socket.id;
        player.connected = true;
        game.players.set(socket.id, player);
        // Обновляем ссылки на socket
        socket.join(gameId);
        socket.gameId = gameId;
        socket.playerId = socket.id;
        // Обновляем гуру, если надо
        if (game.currentGuru === playerId) {
            game.currentGuru = socket.id;
        }
        // Обновляем очки
        if (game.scores.has(playerId)) {
            const score = game.scores.get(playerId);
            game.scores.delete(playerId);
            game.scores.set(socket.id, score);
        }
        // Удаляем таймер удаления, если был
        if (disconnectTimers.has(playerId)) {
            clearTimeout(disconnectTimers.get(playerId));
            disconnectTimers.delete(playerId);
        }
        // Отправляем игроку его состояние
        socket.emit('reconnected', {
            gameId,
            game: game.getGameState(),
            hand: player.hand,
            playerId: socket.id
        });
        // Всем остальным обновляем список игроков
        socket.to(gameId).emit('playerJoined', {
            game: game.getGameState()
        });
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id);
        
        if (socket.gameId) {
            const game = games.get(socket.gameId);
            if (game) {
                const player = game.players.get(socket.id);
                if (player) {
                    player.connected = false;

                    // Если отключился текущий Гуру — немедленно назначаем нового из подключенных игроков
                    const wasGuruNow = game.currentGuru === socket.id;
                    if (wasGuruNow) {
                        const connectedCandidates = Array
                            .from(game.players.values())
                            .filter(p => p.connected && p.id !== socket.id);

                        if (connectedCandidates.length > 0) {
                            // Сбросить статус гуру у всех и назначить нового из подключённых
                            for (const pl of game.players.values()) {
                                pl.isGuru = false;
                            }
                            const newGuru = connectedCandidates[Math.floor(Math.random() * connectedCandidates.length)];
                            game.currentGuru = newGuru.id;
                            newGuru.isGuru = true;

                            // Если у нового Гуру была подана карта — отменяем её подачу
                            if (game.submittedCards.has(newGuru.id)) {
                                game.submittedCards.delete(newGuru.id);
                                newGuru.selectedCard = null;
                            }

                            // Если все остальные (подключённые и не-Гуру) уже подали — переходим к голосованию
                            const allEligibleSubmitted = Array.from(game.players.values()).every(p => {
                                return p.isGuru || !p.connected || game.submittedCards.has(p.id);
                            });
                            if (allEligibleSubmitted && game.submittedCards.size > 0) {
                                game.gameState = 'voting';
                            }

                            // Уведомляем всех об обновлении состояния (для обновления роли Гуру и UI)
                            io.to(socket.gameId).emit('gameUpdated', {
                                game: game.getGameState()
                            });
                        }
                    }
                    // Запускаем таймер на удаление игрока через 60 секунд
                    const timer = setTimeout(() => {
                        // Проверяем, не вернулся ли игрок
                        const p = game.players.get(socket.id);
                        if (p && !p.connected) {
                            // Проверяем, был ли отключившийся игрок Гуру
                            const wasGuru = game.currentGuru === socket.id;
                            game.players.delete(socket.id);
                            game.scores.delete(socket.id);
                            game.submittedCards.delete(socket.id);
                            if (game.players.size === 0) {
                                games.delete(socket.gameId);
                            } else {
                                // Если отключился Гуру и есть другие игроки, выбираем нового Гуру
                                if (wasGuru && game.players.size > 0) {
                                    game.selectRandomGuru();
                                    console.log('Выбран новый Гуру после отключения:', game.currentGuru);
                                }
                                io.to(socket.gameId).emit('playerLeft', {
                                    game: game.getGameState()
                                });
                            }
                        }
                        disconnectTimers.delete(socket.id);
                    }, 60000); // 60 секунд
                    disconnectTimers.set(socket.id, timer);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
