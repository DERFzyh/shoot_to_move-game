// 简单的 WebSocket 联机服务器
// 使用方法：
//   1) 在项目根目录执行：npm install ws
//   2) 启动服务器：node server.js
//   3) 在两台设备上用浏览器访问同一个 index.html（通过 http-server 或其它静态服务器）

const WebSocket = require('ws');

const PORT = 3000;

// 这里只做一个简单的“房间”，最多两人
const wss = new WebSocket.Server({ port: PORT });

let clients = []; // { ws, role }

// 复制前端的迷宫生成算法用于在服务器统一生成地图
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const WALL_SIZE = 20;

class Wall {
  constructor(x, y, wallType, color) {
    this.x = x;
    this.y = y;
    this.wallType = wallType;
    this.color = color;
  }
}

function generateMap() {
  const walls = [];
  // 地图边缘固定为墙1
  for (let x = 0; x < SCREEN_WIDTH; x += WALL_SIZE) {
    walls.push(new Wall(x, 0, 1, null));
    walls.push(new Wall(x, SCREEN_HEIGHT - WALL_SIZE, 1, null));
  }
  for (let y = WALL_SIZE; y < SCREEN_HEIGHT - WALL_SIZE; y += WALL_SIZE) {
    walls.push(new Wall(0, y, 1, null));
    walls.push(new Wall(SCREEN_WIDTH - WALL_SIZE, y, 1, null));
  }

  const gridWidth = SCREEN_WIDTH / WALL_SIZE - 2;
  const gridHeight = SCREEN_HEIGHT / WALL_SIZE - 2;
  const grid = Array(gridHeight)
    .fill(0)
    .map(() => Array(gridWidth).fill(1));

  function dfs(x, y) {
    if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return;
    grid[y][x] = 0;

    if (x + 1 < gridWidth) grid[y][x + 1] = 0;
    if (y + 1 < gridHeight) grid[y + 1][x] = 0;
    if (x + 1 < gridWidth && y + 1 < gridHeight) grid[y + 1][x + 1] = 0;

    const directions = [
      [0, 3],
      [3, 0],
      [0, -3],
      [-3, 0],
    ];

    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight && grid[ny][nx] === 1) {
        const midX = x + Math.floor(dx / 3);
        const midY = y + Math.floor(dy / 3);
        if (midX >= 0 && midX < gridWidth && midY >= 0 && midY < gridHeight) {
          grid[midY][midX] = 0;
          if (midX + 1 < gridWidth) grid[midY][midX + 1] = 0;
          if (midY + 1 < gridHeight) grid[midY + 1][midX] = 0;
          if (midX + 1 < gridWidth && midY + 1 < gridHeight) grid[midY + 1][midX + 1] = 0;
        }
        dfs(nx, ny);
      }
    }
  }

  const startX = Math.floor(Math.random() * Math.floor(gridWidth / 2)) * 2;
  const startY = Math.floor(Math.random() * Math.floor(gridHeight / 2)) * 2;
  dfs(startX, startY);

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (grid[y][x] === 1) {
        const choices = [1, 2, 3];
        const weights = [1, 3, 1];
        let wallType = 0;
        let totalWeight = weights.reduce((a, b) => a + b, 0);
        let rand = Math.random() * totalWeight;
        for (let i = 0; i < choices.length; i++) {
          if (rand < weights[i]) {
            wallType = choices[i];
            break;
          }
          rand -= weights[i];
        }
        walls.push(
          new Wall(
            (x + 1) * WALL_SIZE,
            (y + 1) * WALL_SIZE,
            wallType,
            wallType === 2 ? 'rgb(255, 255, 255)' : null
          )
        );
      }
    }
  }

  // 这里为了简单，服务器端不再做“减少死胡同”和额外打通逻辑
  // 只要两边地图完全一样即可，复杂度不重要

  // 把非边缘墙全部设为 type2（和前端一致）
  for (const wall of walls) {
    if (
      wall.x > WALL_SIZE &&
      wall.x < SCREEN_WIDTH - WALL_SIZE * 2 &&
      wall.y > WALL_SIZE &&
      wall.y < SCREEN_HEIGHT - WALL_SIZE * 2
    ) {
      wall.wallType = 2;
      wall.color = 'rgb(255, 255, 255)';
    }
  }

  return walls;
}

// 当前房间地图（两人共用）
let currentMap = generateMap();

function broadcast(data) {
  const str = JSON.stringify(data);
  for (const c of clients) {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(str);
    }
  }
}

wss.on('connection', (ws) => {
  if (clients.length >= 2) {
    ws.send(JSON.stringify({ type: 'full' }));
    ws.close();
    return;
  }

  const role = clients.length === 0 ? 'player1' : 'player2';
  const client = { ws, role };
  clients.push(client);

  // 分配身份并同步地图
  ws.send(
    JSON.stringify({
      type: 'init',
      role,
      walls: currentMap,
    })
  );

  // 通知已有客户端有新玩家加入（可选）
  broadcast({ type: 'player_join', role });

  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }
    // 直接转发状态/事件给另一个客户端
    if (data.type === 'state' || data.type === 'event') {
      // 附带发送者的 role
      data.from = role;
      broadcast(data);
    }
    if (data.type === 'restart') {
      // 重新生成地图并广播
      currentMap = generateMap();
      broadcast({ type: 'restart', walls: currentMap });
    }
  });

  ws.on('close', () => {
    clients = clients.filter((c) => c.ws !== ws);
    broadcast({ type: 'player_leave', role });
    // 所有人离开后自动重置地图
    if (clients.length === 0) {
      currentMap = generateMap();
    }
  });
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);


