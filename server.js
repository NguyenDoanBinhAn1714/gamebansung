// server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const players = {};
const teamCounts = { blue: 0, red: 0 };
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// HÀM MỚI: Kiểm tra điều kiện chiến thắng
function checkWinCondition() {
    let livingBlue = 0;
    let livingRed = 0;

    // Đếm số người còn sống ở mỗi đội
    for (const id in players) {
        const player = players[id];
        if (player.health > 0) {
            if (player.team === 'blue') {
                livingBlue++;
            } else {
                livingRed++;
            }
        }
    }

    // Chỉ kiểm tra khi có người chơi ở cả 2 đội
    if (teamCounts.blue > 0 && teamCounts.red > 0) {
        if (livingBlue === 0) {
            io.emit('gameOver', 'Red'); // Gửi sự kiện game over
        } else if (livingRed === 0) {
            io.emit('gameOver', 'Blue'); // Gửi sự kiện game over
        }
    }
}

// HÀM MỚI: Reset lại game
function resetGame() {
    for (const id in players) {
        const player = players[id];
        player.health = 100; // Hồi đầy máu

        // Đặt lại vị trí ban đầu
        if (player.team === 'blue') {
            player.x = Math.floor(Math.random() * (GAME_WIDTH / 2 - 100)) + 50;
            player.y = GAME_HEIGHT - 100;
        } else {
            player.x = Math.floor(Math.random() * (GAME_WIDTH / 2 - 100)) + (GAME_WIDTH / 2) + 50;
            player.y = 50;
        }
    }
    // Thông báo cho client biết game đã reset
    io.emit('gameRestart');
}


io.on('connection', (socket) => {
    // ... (Phần code phân đội và tạo người chơi giữ nguyên như cũ) ...
    let teamAssignment = 'blue';
    if (teamCounts.blue > teamCounts.red) teamAssignment = 'red';
    teamCounts[teamAssignment]++;
    let playerX, playerY, playerColor;
    if (teamAssignment === 'blue') {
        playerX = Math.floor(Math.random() * (GAME_WIDTH / 2 - 100)) + 50;
        playerY = GAME_HEIGHT - 100;
        playerColor = '#0099ff';
    } else {
        playerX = Math.floor(Math.random() * (GAME_WIDTH / 2 - 100)) + (GAME_WIDTH / 2) + 50;
        playerY = 50;
        playerColor = '#ff4136';
    }
    players[socket.id] = {id: socket.id, x: playerX, y: playerY, width: 50, height: 50, color: playerColor, health: 100, team: teamAssignment};
    
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            teamCounts[players[socket.id].team]--;
            delete players[socket.id];
            checkWinCondition(); // Kiểm tra lại khi có người thoát
        }
    });

    socket.on('playerMove', (data) => {
        const player = players[socket.id] || {};
        if (data.left) player.x -= 5;
        if (data.right) player.x += 5;
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > GAME_WIDTH) player.x = GAME_WIDTH - player.width;
    });
    
    socket.on('shoot', (bulletData) => {
        socket.broadcast.emit('newBullet', bulletData);
    });

    socket.on('playerHit', (hitData) => {
        const attacker = players[hitData.attackerId];
        const victim = players[hitData.victimId];
        if (attacker && victim && attacker.team !== victim.team && victim.health > 0) {
            victim.health -= 10;
            if (victim.health < 0) victim.health = 0;
            io.emit('healthUpdate', { id: hitData.victimId, health: victim.health });
            
            // THAY ĐỔI: Kiểm tra chiến thắng ngay sau khi máu cập nhật
            checkWinCondition();
        }
    });

    // HÀM MỚI: Lắng nghe yêu cầu chơi lại
    socket.on('requestRestart', () => {
        resetGame();
    });
});

setInterval(() => {
    io.emit('updateState', players);
}, 1000 / 60);

const PORT = 3000;
server.listen(PORT, () => console.log(`Server đang chạy tại http://localhost:${PORT}`));