// public/game.js

const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// LẤY CÁC PHẦN TỬ HTML MỚI
const gameOverScreen = document.getElementById('gameOverScreen');
const winnerText = document.getElementById('winnerText');
const playAgainButton = document.getElementById('playAgainButton');


// Lấy các phần tử nút điều khiển
const touchControls = document.getElementById('touchControls');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
const shootButton = document.getElementById('shootButton');

// Biến để kiểm tra có phải thiết bị cảm ứng không
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

if (isTouchDevice) {
    touchControls.classList.remove('hidden'); // Hiện bộ điều khiển
}

// Hàm xử lý sự kiện chạm (mô phỏng nhấn phím)
function handleTouchStart(e, key) {
    e.preventDefault(); // Ngăn hành vi mặc định của trình duyệt (như cuộn trang)
    keys[key] = true;
}

function handleTouchEnd(e, key) {
    e.preventDefault();
    keys[key] = false;
}

// Gán sự kiện cho các nút
leftButton.addEventListener('touchstart', (e) => handleTouchStart(e, 'a'));
leftButton.addEventListener('touchend', (e) => handleTouchEnd(e, 'a'));

rightButton.addEventListener('touchstart', (e) => handleTouchStart(e, 'd'));
rightButton.addEventListener('touchend', (e) => handleTouchEnd(e, 'd'));

shootButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    // Mô phỏng lại việc nhấn phím cách
    // Tạo một sự kiện giả và gửi đi
    const spacePressEvent = new KeyboardEvent('keypress', {'key': ' '});
    window.dispatchEvent(spacePressEvent);
});

// === KẾT THÚC PHẦN THÊM MỚI ===

let players = {};
let bullets = [];
const keys = {};
let gameActive = true; // BIẾN MỚI: Để kiểm soát trạng thái game

// (Phần code lắng nghe bàn phím giữ nguyên)
window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });
window.addEventListener('keypress', (e) => {
    if (e.key === ' ' && gameActive) { // CHỈ BẮN KHI GAME ĐANG CHẠY
        if (players[socket.id]) {
            const player = players[socket.id];
            let bulletY, bulletSpeedY;
            if (player.team === 'blue') {
                bulletY = player.y;
                bulletSpeedY = -10;
            } else {
                bulletY = player.y + player.height;
                bulletSpeedY = 10;
            }
            const bullet = {x: player.x + player.width / 2 - 2.5, y: bulletY, width: 5, height: 15, color: 'yellow', ownerId: socket.id, ownerTeam: player.team, speedY: bulletSpeedY};
            bullets.push(bullet);
            socket.emit('shoot', bullet);
        }
    }
});


// (Phần code socket.on('updateState'), ('newBullet'), ('healthUpdate') giữ nguyên)
socket.on('updateState', (serverPlayers) => { players = serverPlayers; });
socket.on('newBullet', (bulletData) => { bullets.push(bulletData); });
socket.on('healthUpdate', (data) => { if (players[data.id]) { players[data.id].health = data.health; } });


// HÀM MỚI: Lắng nghe sự kiện Game Over
socket.on('gameOver', (winningTeam) => {
    gameActive = false; // Dừng game
    winnerText.textContent = `${winningTeam} Team Wins!`;
    gameOverScreen.classList.remove('hidden'); // Hiện màn hình
});

// HÀM MỚI: Lắng nghe sự kiện Reset Game
socket.on('gameRestart', () => {
    gameActive = true; // Bắt đầu game lại
    bullets = []; // Xóa hết đạn cũ trên màn hình
    gameOverScreen.classList.add('hidden'); // Ẩn màn hình đi
});

// HÀM MỚI: Xử lý khi nhấn nút "Chơi Lại"
playAgainButton.addEventListener('click', () => {
    socket.emit('requestRestart'); // Gửi yêu cầu chơi lại cho server
});

// (Hàm draw giữ nguyên)
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, canvas.height / 2 - 2, canvas.width, 4);
    for (const id in players) {
        const player = players[id];
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, player.width, player.height);
        ctx.fillStyle = '#333';
        ctx.fillRect(player.x, player.y - 20, player.width, 10);
        ctx.fillStyle = 'green';
        ctx.fillRect(player.x, player.y - 20, player.width * (player.health / 100), 10);
    }
    for (const bullet of bullets) {
        ctx.fillStyle = bullet.color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
}


function update() {
    if (!gameActive) return; // Nếu game dừng thì không cập nhật nữa

    socket.emit('playerMove', { left: keys['a'], right: keys['d'] });

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.y += b.speedY;
        if (b.y < 0 || b.y > canvas.height) {
            bullets.splice(i, 1);
            continue;
        }
        for (const id in players) {
            if (b.ownerId === id) continue;
            const p = players[id];
            if (b.ownerTeam !== p.team) {
                 if (b.x < p.x + p.width && b.x + b.width > p.x && b.y < p.y + p.height && b.y + b.height > p.y) {
                    if (b.ownerId === socket.id) {
                        socket.emit('playerHit', { attackerId: socket.id, victimId: id });
                    }
                    bullets.splice(i, 1);
                    break;
                }
            }
        }
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();