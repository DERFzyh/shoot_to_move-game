// 获取Canvas元素和绘图上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 屏幕尺寸 (与Python版本保持一致)
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

// 确保Canvas尺寸正确
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

// 颜色 (与Python版本保持一致)
const WHITE = 'rgb(255, 255, 255)';
const BLACK = 'rgb(0, 0, 0)';
const RED = 'rgb(255, 0, 0)';
const BLUE = 'rgb(0, 0, 255)';
const LIGHT_RED = 'rgb(255, 100, 100)';
const LIGHT_BLUE = 'rgb(100, 100, 255)';
const GRAY = 'rgb(128, 128, 128)';
const DARK_GRAY = 'rgb(64, 64, 64)';
const LIGHT_GRAY = 'rgb(192, 192, 192)';

// 墙的尺寸 (与Python版本保持一致)
const WALL_SIZE = 20;

// 全局的effect_canvas，用于记录子弹的路线和爆炸效果
const effectCanvas = document.createElement('canvas');
effectCanvas.width = SCREEN_WIDTH;
effectCanvas.height = SCREEN_HEIGHT;
const effectCtx = effectCanvas.getContext('2d');

// 游戏时钟 (使用JavaScript的requestAnimationFrame和时间戳模拟)
let lastTime = 0;
let deltaTime = 0; // 每帧的时间差

// 字体 (JavaScript中直接使用Canvas的font属性)
ctx.font = '48px Arial'; // 初始字体，后续可以根据需要调整

// 玩家类 (Player Class)
class Player {
    constructor(x, y, color, team, playerId, playerName) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.team = team; // 阵营ID
        this.teamColor = TEAM_COLORS[team % TEAM_COLORS.length]; // 阵营颜色
        this.playerId = playerId; // 玩家ID
        this.playerName = playerName; // 玩家名称
        this.size = 15; // 三角形的大小
        this.angle = 0; // 初始角度
        this.health = 100;
        this.maxHealth = 100;
        this.speedX = 0; // 水平速度
        this.speedY = 0; // 垂直速度
        this.friction = 0.95; // 摩擦力
        this.shieldActive = false;
        this.shieldStartTime = 0;
        this.shieldDuration = 5; // 防护罩持续时间改为5秒
        this.shieldRadius = 25; // 防护罩半径
        this.shieldRemainingTime = 0;
        this.shieldCooldown = 0;
        this.shieldButtonPressed = false;

        // 统计数据
        this.kills = 0; // 击杀数
        this.damageDealt = 0; // 造成的伤害
        this.damageTaken = 0; // 承受的伤害
        this.isAlive = true; // 是否存活
    }

    draw() {
        // 计算三角形的三个顶点
        const point1 = {
            x: this.x + Math.cos(this.angle) * this.size,
            y: this.y + Math.sin(this.angle) * this.size
        };
        const point2 = {
            x: this.x + Math.cos(this.angle + 2 * Math.PI / 3) * this.size,
            y: this.y + Math.sin(this.angle + 2 * Math.PI / 3) * this.size
        };
        const point3 = {
            x: this.x + Math.cos(this.angle + 4 * Math.PI / 3) * this.size,
            y: this.y + Math.sin(this.angle + 4 * Math.PI / 3) * this.size
        };

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(point1.x, point1.y);
        ctx.lineTo(point2.x, point2.y);
        ctx.lineTo(point3.x, point3.y);
        ctx.closePath();
        ctx.fill();

        // 在三角形顶部添加绿色方向指示
        const directionPoint = {
            x: this.x + Math.cos(this.angle) * (this.size + 5),
            y: this.y + Math.sin(this.angle) * (this.size + 5)
        };
        ctx.fillStyle = 'rgb(0, 255, 0)';
        ctx.beginPath();
        ctx.arc(directionPoint.x, directionPoint.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // 绘制防护罩
        if (this.isShieldActive()) {
            const elapsedTime = (Date.now() - this.shieldStartTime) / 1000;
            const shieldAlpha = Math.min(1, 1 - elapsedTime / this.shieldDuration);
            
            // 使用一个临时的canvas来绘制带透明度的防护罩，然后绘制到主canvas上
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.shieldRadius * 2;
            tempCanvas.height = this.shieldRadius * 2;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.strokeStyle = this.color;
            tempCtx.lineWidth = 2;
            tempCtx.globalAlpha = shieldAlpha; // 设置透明度
            tempCtx.beginPath();
            tempCtx.arc(this.shieldRadius, this.shieldRadius, this.shieldRadius - 1, 0, Math.PI * 2);
            tempCtx.stroke();
            
            ctx.drawImage(tempCanvas, this.x - this.shieldRadius, this.y - this.shieldRadius);
        }
    }

    rotate(angle) {
        this.angle = angle;
    }

    move(walls) {
        let newX = this.x + this.speedX;
        let newY = this.y + this.speedY;

        let collision = false;
        for (const wall of walls) {
            // 简化碰撞检测，只检测中心点是否进入墙体
            if (newX > wall.x && newX < wall.x + WALL_SIZE &&
                newY > wall.y && newY < wall.y + WALL_SIZE) {
                if (wall.wallType === 1 || wall.wallType === 3) {
                    collision = true;
                    break;
                } else if (wall.wallType === 2) {
                    // 只有同阵营的墙才能通行，其他墙壁（包括中性和敌方阵营）都会阻挡
                    if (wall.team !== this.team) {
                        collision = true;
                        break;
                    }
                }
            }
        }

        if (!collision) {
            this.x = newX;
            this.y = newY;
        }

        this.speedX *= this.friction;
        this.speedY *= this.friction;

        // 边界检测
        if (this.x < 0) this.x = 0;
        else if (this.x > SCREEN_WIDTH) this.x = SCREEN_WIDTH;
        if (this.y < 0) this.y = 0;
        else if (this.y > SCREEN_HEIGHT) this.y = SCREEN_HEIGHT;
    }

    pushBack(force, angle) {
        this.speedX += Math.cos(angle) * force;
        this.speedY += Math.sin(angle) * force;
    }

    activateShield() {
        if (!this.shieldActive && this.shieldCooldown <= 0) {
            this.shieldActive = true;
            this.shieldButtonPressed = true;
            if (this.shieldRemainingTime <= 0) {
                this.shieldStartTime = Date.now();
            } else {
                this.shieldStartTime = Date.now() - (this.shieldDuration - this.shieldRemainingTime) * 1000;
            }
        }
    }

    deactivateShield() {
        if (this.shieldActive) {
            this.shieldActive = false;
            this.shieldButtonPressed = false;
            this.shieldRemainingTime = Math.max(0, this.shieldDuration - (Date.now() - this.shieldStartTime) / 1000);
        }
    }

    isShieldActive() {
        if (!this.shieldActive || !this.shieldButtonPressed) {
            return false;
        }
        const elapsedTime = (Date.now() - this.shieldStartTime) / 1000;
        if (elapsedTime >= this.shieldDuration) {
            this.deactivateShield();
            this.shieldCooldown = 1;
            return false;
        }
        return true;
    }

    update(dt) {
        if (this.shieldCooldown > 0) {
            this.shieldCooldown -= dt;
        }
    }
}

// 子弹类 (Bullet Class)
class Bullet {
    constructor(x, y, angle, teamColor, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 10;
        this.radius = 5;
        this.color = teamColor; // 使用阵营颜色
        this.trailColor = teamColor; // 轨迹也使用阵营颜色
        this.team = owner.team; // 记录阵营ID
        this.creationTime = Date.now();
        this.trail = [{ x: x, y: y }]; // 子弹的行进路线
        this.active = true;
        this.owner = owner;
    }

    move(walls) {
        if (this.active) {
            let newX = this.x + Math.cos(this.angle) * this.speed;
            let newY = this.y + Math.sin(this.angle) * this.speed;

            let collision = false;
            for (const wall of walls) {
                if (newX > wall.x && newX < wall.x + WALL_SIZE &&
                    newY > wall.y && newY < wall.y + WALL_SIZE) {
                    if (wall.wallType === 1) {
                        collision = true;
                        break;
                    } else if (wall.wallType === 2) {
                        // 只有同阵营的墙才能通行，其他墙壁（包括中性和敌方阵营）都会阻挡
                        if (wall.team !== this.team) {
                            collision = true;
                            break;
                        }
                    } else if (wall.wallType === 3) {
                        // 计算碰撞点 (简化处理，取墙的中心)
                        const collisionPoint = { x: wall.x + WALL_SIZE / 2, y: wall.y + WALL_SIZE / 2 };
                        // 计算入射角
                        const incidentAngle = this.angle;
                        // 计算墙的法线角度 (简化处理，根据子弹进入墙的哪个方向来判断)
                        // 这里需要更精确的碰撞检测和法线计算，但为了初步转换，先简化处理
                        // 假设反弹墙是方形，法线可以是水平或垂直的
                        let wallNormal = 0;
                        if (Math.abs(newX - collisionPoint.x) > Math.abs(newY - collisionPoint.y)) {
                            // 水平方向碰撞
                            wallNormal = (newX < collisionPoint.x) ? Math.PI : 0; // 左侧或右侧
                        } else {
                            // 垂直方向碰撞
                            wallNormal = (newY < collisionPoint.y) ? Math.PI / 2 : -Math.PI / 2; // 上方或下方
                        }

                        const reflectionAngle = 2 * wallNormal - incidentAngle + Math.PI; // 调整反射角
                        this.angle = reflectionAngle;
                        return; // 反弹后直接返回，不更新位置
                    }
                }
            }

            if (collision) {
                this.explode(walls);
                this.active = false;
            } else {
                this.x = newX;
                this.y = newY;
                this.trail.push({ x: Math.floor(this.x), y: Math.floor(this.y) });
                // 限制轨迹长度，避免内存占用过大
                if (this.trail.length > 50) {
                    this.trail.shift();
                }
            }
        }
    }

    draw() {
        if (this.active) {
            // 绘制子弹的行进路线
            if (this.trail.length >= 2) {
                effectCtx.strokeStyle = this.trailColor;
                effectCtx.lineWidth = this.radius * 2;
                effectCtx.beginPath();
                effectCtx.moveTo(this.trail[0].x, this.trail[0].y);
                for (let i = 1; i < this.trail.length; i++) {
                    effectCtx.lineTo(this.trail[i].x, this.trail[i].y);
                }
                effectCtx.stroke();
            }
            // 绘制子弹
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    isActive() {
        return (Date.now() - this.creationTime) / 1000 >= 0.2;
    }

    explode(walls) {
        // 子弹消失时绘制一个圆形区域
        effectCtx.fillStyle = this.trailColor;
        effectCtx.beginPath();
        effectCtx.arc(this.x, this.y, 30, 0, Math.PI * 2);
        effectCtx.fill();

        // 将距离25以内的墙2变为发射子弹阵营的墙壁
        for (const wall of walls) {
            if (wall.wallType === 2) {
                const distance = Math.hypot(wall.x + WALL_SIZE / 2 - this.x, wall.y + WALL_SIZE / 2 - this.y);
                if (distance <= 25) {
                    wall.team = this.team;
                    wall.color = this.trailColor;
                }
            }
        }
    }
}

// 墙类 (Wall Class)
class Wall {
    constructor(x, y, wallType, team = -1) {
        this.x = x;
        this.y = y;
        this.wallType = wallType;
        this.team = team; // -1表示中性墙，0-5表示对应阵营的墙
        this.color = (wallType === 2) ? (team >= 0 ? TEAM_COLORS[team] : WHITE) : null;
    }

    draw() {
        if (this.wallType === 1) {
            ctx.fillStyle = GRAY;
            ctx.fillRect(this.x, this.y, WALL_SIZE, WALL_SIZE);
            ctx.strokeStyle = DARK_GRAY;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, WALL_SIZE, WALL_SIZE);
        } else if (this.wallType === 2) {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, WALL_SIZE, WALL_SIZE);
            ctx.strokeStyle = LIGHT_GRAY;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, WALL_SIZE, WALL_SIZE);
        } else if (this.wallType === 3) {
            ctx.fillStyle = LIGHT_GRAY;
            ctx.fillRect(this.x, this.y, WALL_SIZE, WALL_SIZE);
            ctx.strokeStyle = WHITE;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, WALL_SIZE, WALL_SIZE);
        }
    }
}

// 虚拟摇杆类 (Joystick Class)
class Joystick {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 30; // 摇杆的判定范围
        this.innerRadius = 15;
        this.dx = 0;
        this.dy = 0;
    }

    draw() {
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = BLACK;
        ctx.beginPath();
        ctx.arc(this.x + this.dx * this.radius, this.y + this.dy * this.radius, this.innerRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    update(pos) {
        let dx = pos.x - this.x;
        let dy = pos.y - this.y;
        let distance = Math.hypot(dx, dy);
        if (distance > this.radius) {
            dx = (dx / distance) * this.radius;
            dy = (dy / distance) * this.radius;
        }
        this.dx = dx / this.radius;
        this.dy = dy / this.radius;
    }
}

// 触控按钮类 (Button Class)
class Button {
    constructor(x, y, width, height, text) {
        this.rect = { x: x, y: y, width: width, height: height };
        this.text = text;
    }

    draw() {
        ctx.strokeStyle = BLACK;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height);

        ctx.fillStyle = BLACK;
        ctx.font = '24px Arial'; // 按钮文本使用较小的字体
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.rect.x + this.rect.width / 2, this.rect.y + this.rect.height / 2);
    }

    isPressed(pos) {
        return pos.x > this.rect.x && pos.x < this.rect.x + this.rect.width &&
               pos.y > this.rect.y && pos.y < this.rect.y + this.rect.height;
    }
}

// 生成随机地图 (generate_map function)
function generateMap() {
    const walls = [];
    // 地图边缘固定为墙1
    for (let x = 0; x < SCREEN_WIDTH; x += WALL_SIZE) {
        walls.push(new Wall(x, 0, 1));
        walls.push(new Wall(x, SCREEN_HEIGHT - WALL_SIZE, 1));
    }
    for (let y = WALL_SIZE; y < SCREEN_HEIGHT - WALL_SIZE; y += WALL_SIZE) {
        walls.push(new Wall(0, y, 1));
        walls.push(new Wall(SCREEN_WIDTH - WALL_SIZE, y, 1));
    }

    // 初始化迷宫网格
    const gridWidth = (SCREEN_WIDTH / WALL_SIZE) - 2;
    const gridHeight = (SCREEN_HEIGHT / WALL_SIZE) - 2;
    const grid = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(1));

    // 修改后的DFS函数
    function dfs(x, y) {
        if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) {
            return;
        }

        grid[y][x] = 0; // 标记为通路
        // 同时标记相邻的3个单元格为通路
        if (x + 1 < gridWidth) {
            grid[y][x + 1] = 0;
        }
        if (y + 1 < gridHeight) {
            grid[y + 1][x] = 0;
        }
        if (x + 1 < gridWidth && y + 1 < gridHeight) {
            grid[y + 1][x + 1] = 0;
        }

        const directions = [[0, 3], [3, 0], [0, -3], [-3, 0]]; // 将步长改为3
        // 随机打乱方向
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight && grid[ny][nx] === 1) {
                // 打通中间的墙，保持2个单元格的间隔
                const midX = x + Math.floor(dx / 3);
                const midY = y + Math.floor(dy / 3);
                if (midX >= 0 && midX < gridWidth && midY >= 0 && midY < gridHeight) {
                    grid[midY][midX] = 0;
                    if (midX + 1 < gridWidth) {
                        grid[midY][midX + 1] = 0;
                    }
                    if (midY + 1 < gridHeight) {
                        grid[midY + 1][midX] = 0;
                    }
                    if (midX + 1 < gridWidth && midY + 1 < gridHeight) {
                        grid[midY + 1][midX + 1] = 0;
                    }
                }
                dfs(nx, ny);
            }
        }
    }

    // 从随机起点开始生成迷宫
    const startX = Math.floor(Math.random() * (Math.floor(gridWidth / 2))) * 2;
    const startY = Math.floor(Math.random() * (Math.floor(gridHeight / 2))) * 2;
    dfs(startX, startY);

    // 将迷宫网格转换为墙，并随机分配墙的类型
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            if (grid[y][x] === 1) {
                // 随机选择墙的类型
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

                // 初始所有墙壁都是中性的（team = -1）
                walls.push(new Wall((x + 1) * WALL_SIZE, (y + 1) * WALL_SIZE, wallType, -1));
            }
        }
    }

    // 减少死胡同的数量
    for (let y = 1; y < gridHeight - 1; y++) {
        for (let x = 1; x < gridWidth - 1; x++) {
            if (grid[y][x] === 0) {
                // 检查当前点是否是死胡同
                const neighbors = [
                    grid[y - 1][x], // 上
                    grid[y + 1][x], // 下
                    grid[y][x - 1], // 左
                    grid[y][x + 1], // 右
                ];
                if (neighbors.filter(val => val === 1).length >= 3) { // 如果当前点有3面是墙，则打通一个方向
                    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
                    // 随机打乱方向
                    for (let i = directions.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [directions[i], directions[j]] = [directions[j], directions[i]];
                    }
                    for (const [dx, dy] of directions) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (grid[ny][nx] === 1) {
                            grid[ny][nx] = 0;
                            // 移除对应的墙
                            for (let i = walls.length - 1; i >= 0; i--) {
                                const wall = walls[i];
                                if (wall.x === (nx + 1) * WALL_SIZE && wall.y === (ny + 1) * WALL_SIZE) {
                                    walls.splice(i, 1);
                                    break;
                                }
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    // 随机打通30处不在边缘的墙
    for (let _ = 0; _ < 30; _++) {
        // 获取所有不在边缘的墙
        const nonEdgeWalls = walls.filter(wall =>
            wall.x > WALL_SIZE && wall.x < SCREEN_WIDTH - WALL_SIZE * 2 &&
            wall.y > WALL_SIZE && wall.y < SCREEN_HEIGHT - WALL_SIZE * 2
        );

        // 筛选出在上下两侧或左右两侧都没有墙的墙
        const removableWalls = [];
        for (const wall of nonEdgeWalls) {
            // 找到对应的网格坐标
            const gridX = (wall.x / WALL_SIZE) - 1;
            const gridY = (wall.y / WALL_SIZE) - 1;

            // 检查上下两侧是否有墙
            const hasWallAbove = gridY - 1 >= 0 ? grid[gridY - 1][gridX] === 1 : false;
            const hasWallBelow = gridY + 1 < gridHeight ? grid[gridY + 1][gridX] === 1 : false;

            // 检查左右两侧是否有墙
            const hasWallLeft = gridX - 1 >= 0 ? grid[gridY][gridX - 1] === 1 : false;
            const hasWallRight = gridX + 1 < gridWidth ? grid[gridY][gridX + 1] === 1 : false;

            // 如果上下两侧或左右两侧都没有墙，则加入可移除列表
            if (!(hasWallAbove || hasWallBelow) || !(hasWallLeft || hasWallRight)) {
                removableWalls.push(wall);
            }
        }

        // 随机选择一个符合条件的墙
        if (removableWalls.length > 0) { // 确保列表不为空
            const wallToRemove = removableWalls[Math.floor(Math.random() * removableWalls.length)];
            // 找到对应的网格坐标
            const gridX = (wallToRemove.x / WALL_SIZE) - 1;
            const gridY = (wallToRemove.y / WALL_SIZE) - 1;

            // 移除选中的墙
            for (let dx = 0; dx < 2; dx++) {
                for (let dy = 0; dy < 2; dy++) {
                    if (gridX + dx >= 0 && gridX + dx < gridWidth && gridY + dy >= 0 && gridY + dy < gridHeight) {
                        grid[gridY + dy][gridX + dx] = 0;
                    }
                }
            }
            walls.splice(walls.indexOf(wallToRemove), 1);

            // Recalculate wall adjacency for the removed wall's position
            const reHasWallAbove = gridY - 1 >= 0 ? grid[gridY - 1][gridX] === 1 : false;
            const reHasWallBelow = gridY + 1 < gridHeight ? grid[gridY + 1][gridX] === 1 : false;
            const reHasWallLeft = gridX - 1 >= 0 ? grid[gridY][gridX - 1] === 1 : false;
            const reHasWallRight = gridX + 1 < gridWidth ? grid[gridY][gridX + 1] === 1 : false;

            // 查找并移除紧贴的另一堵符合条件的墙
            // 检查上下方向
            if (!(reHasWallAbove || reHasWallBelow)) {
                // 检查上方
                if (gridY - 1 >= 0 && grid[gridY - 1][gridX] === 1) {
                    const adjacentWall = walls.find(w => w.x === wallToRemove.x && w.y === wallToRemove.y - WALL_SIZE);
                    if (adjacentWall) {
                        for (let dx = 0; dx < 2; dx++) {
                            if (gridX + dx >= 0 && gridX + dx < gridWidth) {
                                grid[gridY - 1][gridX + dx] = 0;
                            }
                        }
                        walls.splice(walls.indexOf(adjacentWall), 1);
                    }
                }
                // 检查下方
                else if (gridY + 1 < gridHeight && grid[gridY + 1][gridX] === 1) {
                    const adjacentWall = walls.find(w => w.x === wallToRemove.x && w.y === wallToRemove.y + WALL_SIZE);
                    if (adjacentWall) {
                        for (let dx = 0; dx < 2; dx++) {
                            if (gridX + dx >= 0 && gridX + dx < gridWidth) {
                                grid[gridY + 1][gridX + dx] = 0;
                            }
                        }
                        walls.splice(walls.indexOf(adjacentWall), 1);
                    }
                }
            }

            // 检查左右方向
            else if (!(reHasWallLeft || reHasWallRight)) {
                // 检查左侧
                if (gridX - 1 >= 0 && grid[gridY][gridX - 1] === 1) {
                    const adjacentWall = walls.find(w => w.x === wallToRemove.x - WALL_SIZE && w.y === wallToRemove.y);
                    if (adjacentWall) {
                        for (let dy = 0; dy < 2; dy++) {
                            if (gridY + dy >= 0 && gridY + dy < gridHeight) {
                                grid[gridY + dy][gridX - 1] = 0;
                            }
                        }
                        walls.splice(walls.indexOf(adjacentWall), 1);
                    }
                }
                // 检查右侧
                else if (gridX + 1 < gridWidth && grid[gridY][gridX + 1] === 1) {
                    const adjacentWall = walls.find(w => w.x === wallToRemove.x + WALL_SIZE && w.y === wallToRemove.y);
                    if (adjacentWall) {
                        for (let dy = 0; dy < 2; dy++) {
                            if (gridY + dy >= 0 && gridY + dy < gridHeight) {
                                grid[gridY + dy][gridX + 1] = 0;
                            }
                        }
                        walls.splice(walls.indexOf(adjacentWall), 1);
                    }
                }
            }
        }
    }

    // 将所有不在边缘的墙变为type2
    for (const wall of walls) {
        if (wall.x > WALL_SIZE && wall.x < SCREEN_WIDTH - WALL_SIZE * 2 &&
            wall.y > WALL_SIZE && wall.y < SCREEN_HEIGHT - WALL_SIZE * 2) {
            wall.wallType = 2;
            wall.color = WHITE; // 确保颜色也更新为type2的颜色
        }
    }

    return walls;
}

// 预定义颜色和阵营
const PLAYER_COLORS = [
    'rgb(0, 0, 255)',     // 蓝色
    'rgb(255, 0, 0)',     // 红色
    'rgb(0, 255, 0)',     // 绿色
    'rgb(255, 255, 0)',   // 黄色
    'rgb(255, 0, 255)',   // 品红
    'rgb(0, 255, 255)',   // 青色
    'rgb(255, 165, 0)',   // 橙色
    'rgb(128, 0, 128)',   // 紫色
    'rgb(255, 192, 203)', // 粉色
    'rgb(165, 42, 42)',   // 棕色
    'rgb(0, 128, 128)',   // 青绿
    'rgb(128, 128, 0)'    // 橄榄绿
];

const TEAM_COLORS = [
    'rgb(0, 100, 255)',   // 蓝色阵营
    'rgb(255, 100, 0)',   // 红色阵营
    'rgb(100, 255, 0)',   // 绿色阵营
    'rgb(255, 255, 100)', // 黄色阵营
    'rgb(255, 100, 255)', // 粉色阵营
    'rgb(100, 255, 255)'  // 青色阵营
];

// 默认键位配置
const DEFAULT_CONTROLS = [
    // 玩家1
    {
        aimMode: "keys",
        leftKey: "a",
        rightKey: "d",
        shootKey: "w",
        shieldKey: "s"
    },
    // 玩家2
    {
        aimMode: "keys",
        leftKey: "ArrowLeft",
        rightKey: "ArrowRight",
        shootKey: " ",
        shieldKey: "Shift"
    },
    // 玩家3
    {
        aimMode: "keys",
        leftKey: "j",
        rightKey: "l",
        shootKey: "i",
        shieldKey: "k"
    },
    // 玩家4
    {
        aimMode: "keys",
        leftKey: "f",
        rightKey: "h",
        shootKey: "t",
        shieldKey: "g"
    },
    // 其他玩家的默认配置
    {
        aimMode: "keys",
        leftKey: "q",
        rightKey: "e",
        shootKey: "r",
        shieldKey: "w"
    },
    {
        aimMode: "keys",
        leftKey: "u",
        rightKey: "o",
        shootKey: "y",
        shieldKey: "i"
    },
    {
        aimMode: "keys",
        leftKey: "z",
        rightKey: "c",
        shootKey: "x",
        shieldKey: "v"
    },
    {
        aimMode: "keys",
        leftKey: "n",
        rightKey: "m",
        shootKey: "b",
        shieldKey: "v"
    },
    {
        aimMode: "keys",
        leftKey: "1",
        rightKey: "3",
        shootKey: "2",
        shieldKey: "4"
    },
    {
        aimMode: "keys",
        leftKey: "7",
        rightKey: "9",
        shootKey: "8",
        shieldKey: "0"
    }
];

// 游戏设置变量
let gameSettings = {
    playerCount: 2,
    players: []
};

// 初始化玩家设置
function initializePlayers() {
    gameSettings.players = [];
    for (let i = 0; i < 12; i++) {
        const playerIndex = i % DEFAULT_CONTROLS.length;
        // 默认平均分配阵营，最多6个阵营
        const team = Math.floor(i / 2) % 6; // 每2个玩家一个阵营，循环分配

        gameSettings.players.push({
            id: i + 1,
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            team: team,
            name: `玩家${i + 1}`,
            controls: { ...DEFAULT_CONTROLS[playerIndex] },
            // 统计数据将在Player对象中初始化
            kills: 0,
            damageDealt: 0,
            damageTaken: 0,
            isAlive: true
        });
    }
}

// 游戏状态变量
let player1, player2, player3, player4, player5, player6, player7, player8, player9, player10, player11, player12;
let joystick1, joystick2, joystick3, joystick4, joystick5, joystick6, joystick7, joystick8, joystick9, joystick10, joystick11, joystick12;
let button1, button2, button3, button4, button5, button6, button7, button8, button9, button10, button11, button12;
let button1Shield, button2Shield, button3Shield, button4Shield, button5Shield, button6Shield, button7Shield, button8Shield, button9Shield, button10Shield, button11Shield, button12Shield;
let restartButton;
let backToMenuButton;
let bullets = [];
let walls = [];
let gameOver = false;
let winner = null;
let gamePaused = false; // 游戏是否暂停（设置面板打开时）
let gameStats = null; // 游戏统计数据
let showTouchControls = false; // 默认不显示触控按钮，根据设备类型决定
let lastKeyboardEventTime = 0; // 记录最后一次键盘事件的时间
let lastMouseEventTime = 0; // 记录最后一次鼠标事件的时间
let lastTouchEventTime = 0; // 记录最后一次触摸事件的时间
const HIDE_DELAY = 5; // 键盘事件后隐藏按钮的延迟时间（秒）
let mouseX = 0; // 鼠标X坐标
let mouseY = 0; // 鼠标Y坐标

// 检测设备类型
function isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// 统一的事件状态检查（只针对游戏相关事件）
function shouldBlockGameEvents() {
    return keyCapturePlayer !== null && keyCaptureType !== null;
}

// 检查是否应该暂停游戏事件（包括UI事件）
function shouldPauseAllEvents() {
    return gamePaused;
}

// 统一的事件阻断处理
function blockEventIfNeeded(event) {
    // 检查事件是否发生在设置面板内
    const settingsPanel = document.getElementById('settingsPanel');
    const isInSettingsPanel = settingsPanel && settingsPanel.contains(event.target);

    // 如果事件发生在设置面板内，且只是游戏暂停（不是录制按键），则不阻断
    if (isInSettingsPanel && shouldPauseAllEvents() && !shouldBlockGameEvents()) {
        return false; // 允许UI事件正常处理
    }

    // 录制按键时，所有事件都应该被阻断，包括UI事件
    if (shouldBlockGameEvents()) {
        event.preventDefault();
        event.stopPropagation();
        return true; // 返回true表示事件被阻断
    }

    // 游戏暂停时，阻断所有非UI事件
    if (shouldPauseAllEvents()) {
        event.preventDefault();
        event.stopPropagation();
        return true; // 返回true表示事件被阻断
    }

    return false; // 返回false表示事件正常处理
}

// 专门用于处理玩家人数变化的事件
function onPlayerCountChange() {
    const playerCountSelect = document.getElementById('playerCount');
    if (!playerCountSelect) {
        console.error('playerCount select element not found');
        return;
    }

    const playerCount = parseInt(playerCountSelect.value);
    if (isNaN(playerCount) || playerCount < 0 || playerCount > 12) {
        console.error('Invalid player count:', playerCount);
        return;
    }

    // 保存设置
    gameSettings.playerCount = playerCount;

    // 立即更新UI，无论面板是否打开
    updatePlayerSettings();
}

// 设置界面函数
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    const wasShown = panel.classList.contains('show');

    panel.classList.toggle('show');

    if (panel.classList.contains('show')) {
        updatePlayerSettings();
    }

    // 当设置面板打开时，暂停游戏；关闭时恢复
    gamePaused = panel.classList.contains('show');
}

// 回到主界面
function backToMainMenu() {
    window.location.href = 'main.html';
}

function updatePlayerSettings() {
    const playerCountSelect = document.getElementById('playerCount');
    if (!playerCountSelect) {
        console.error('playerCount select element not found');
        return;
    }

    const playerCount = parseInt(playerCountSelect.value);
    if (isNaN(playerCount) || playerCount < 0 || playerCount > 12) {
        console.error('Invalid player count:', playerCount);
        return;
    }

    gameSettings.playerCount = playerCount;

    const playerSettingsDiv = document.getElementById('playerSettings');
    if (!playerSettingsDiv) {
        console.error('playerSettings div not found');
        return;
    }

    playerSettingsDiv.innerHTML = '';

    // 确保players数组已初始化
    if (!gameSettings.players || gameSettings.players.length === 0) {
        console.log('Re-initializing players array');
        initializePlayers();
    }

    // 确保有足够的玩家数据
    if (gameSettings.players.length < playerCount) {
        console.log('Extending players array to accommodate', playerCount, 'players');
        while (gameSettings.players.length < playerCount) {
            const playerIndex = gameSettings.players.length;
            const defaultControlsIndex = playerIndex % DEFAULT_CONTROLS.length;
            gameSettings.players.push({
                id: playerIndex + 1,
                color: PLAYER_COLORS[playerIndex % PLAYER_COLORS.length],
                name: `玩家${playerIndex + 1}`,
                controls: { ...DEFAULT_CONTROLS[defaultControlsIndex] }
            });
        }
    }

    for (let i = 0; i < playerCount; i++) {
        const player = gameSettings.players[i];
        if (!player) {
            console.error(`Player ${i} not found in players array`);
            continue;
        }

        const teamName = ['红', '蓝', '绿', '黄', '粉', '青'][player.team] || `阵营${player.team + 1}`;
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-settings';
        playerDiv.innerHTML = `
            <h3 style="color: ${player.color || PLAYER_COLORS[i % PLAYER_COLORS.length]}">${player.name || `玩家${i + 1}`} (${teamName}阵营)</h3>

            <div class="settings-group">
                <label for="teamSelect${i}">阵营:</label>
                <select id="teamSelect${i}" name="teamSelect${i}">
                    <option value="0" ${player.team === 0 ? 'selected' : ''}>红阵营</option>
                    <option value="1" ${player.team === 1 ? 'selected' : ''}>蓝阵营</option>
                    <option value="2" ${player.team === 2 ? 'selected' : ''}>绿阵营</option>
                    <option value="3" ${player.team === 3 ? 'selected' : ''}>黄阵营</option>
                    <option value="4" ${player.team === 4 ? 'selected' : ''}>粉阵营</option>
                    <option value="5" ${player.team === 5 ? 'selected' : ''}>青阵营</option>
                </select>
            </div>

            <div class="settings-group">
                <div class="radio-group">
                    <label>
                        <input type="radio" name="aimMode${i}" value="keys" ${(player.controls && player.controls.aimMode === 'keys') ? 'checked' : (i < 2 ? 'checked' : '')}>
                        按键控制 (左转/右转)
                    </label>
                    <label>
                        <input type="radio" name="aimMode${i}" value="mouse" ${(player.controls && player.controls.aimMode === 'mouse') ? 'checked' : ''}>
                        始终对准鼠标
                    </label>
                </div>
            </div>

            <div class="control-group">
                <label for="leftKey${i}">左转键:</label>
                <input type="text" id="leftKey${i}" value="${(player.controls && player.controls.leftKey) ? getDisplayValue(player.controls.leftKey) : 'A'}" readonly onclick="startKeyCapture(${i}, 'leftKey')">
            </div>

            <div class="control-group">
                <label for="rightKey${i}">右转键:</label>
                <input type="text" id="rightKey${i}" value="${(player.controls && player.controls.rightKey) ? getDisplayValue(player.controls.rightKey) : 'D'}" readonly onclick="startKeyCapture(${i}, 'rightKey')">
            </div>

            <div class="control-group">
                <label for="shootKey${i}">射击键:</label>
                <input type="text" id="shootKey${i}" value="${(player.controls && player.controls.shootKey) ? getDisplayValue(player.controls.shootKey) : 'W'}" readonly onclick="startKeyCapture(${i}, 'shootKey')">
            </div>

            <div class="control-group">
                <label for="shieldKey${i}">护盾键:</label>
                <input type="text" id="shieldKey${i}" value="${(player.controls && player.controls.shieldKey) ? getDisplayValue(player.controls.shieldKey) : 'S'}" readonly onclick="startKeyCapture(${i}, 'shieldKey')">
            </div>
        `;
        playerSettingsDiv.appendChild(playerDiv);
    }
}

let keyCapturePlayer = null;
let keyCaptureType = null;

// 鼠标按键名称映射
const MOUSE_BUTTON_NAMES = {
    0: '鼠标左键',
    1: '鼠标中键',
    2: '鼠标右键',
    3: '鼠标侧键1',
    4: '鼠标侧键2'
};

function startKeyCapture(playerIndex, keyType) {
    keyCapturePlayer = playerIndex;
    keyCaptureType = keyType;
    document.addEventListener('keydown', captureKey);
    document.addEventListener('mousedown', captureMouse);
    document.addEventListener('wheel', captureWheel);
    document.getElementById(keyType + playerIndex).style.backgroundColor = '#ffffcc';
    document.getElementById(keyType + playerIndex).value = '按下任意键或鼠标按键...';

    // 显示全屏遮罩层，防止任何干扰
    document.getElementById('keyCaptureOverlay').style.display = 'block';
}

function captureKey(event) {
    if (keyCapturePlayer !== null && keyCaptureType !== null) {
        event.preventDefault();
        let keyValue = event.key;
        if (keyValue === ' ') keyValue = ' '; // 空格键特殊处理

        gameSettings.players[keyCapturePlayer].controls[keyCaptureType] = keyValue;
        document.getElementById(keyCaptureType + keyCapturePlayer).value = keyValue;
        document.getElementById(keyCaptureType + keyCapturePlayer).style.backgroundColor = '';

        cleanupCapture();
    }
}

function captureMouse(event) {
    if (keyCapturePlayer !== null && keyCaptureType !== null) {
        event.preventDefault();

        let mouseValue = `mouse${event.button}`;
        let displayValue = MOUSE_BUTTON_NAMES[event.button] || `鼠标按键${event.button}`;

        gameSettings.players[keyCapturePlayer].controls[keyCaptureType] = mouseValue;
        document.getElementById(keyCaptureType + keyCapturePlayer).value = displayValue;
        document.getElementById(keyCaptureType + keyCapturePlayer).style.backgroundColor = '';

        cleanupCapture();
    }
}

function captureWheel(event) {
    if (keyCapturePlayer !== null && keyCaptureType !== null) {
        // 注意：滚轮事件是passive的，无法preventDefault，但我们通过提前返回来阻止游戏逻辑
        event.stopPropagation();

        let wheelValue = event.deltaY > 0 ? 'wheelDown' : 'wheelUp';
        let displayValue = event.deltaY > 0 ? '滚轮下滚' : '滚轮上滚';

        gameSettings.players[keyCapturePlayer].controls[keyCaptureType] = wheelValue;
        document.getElementById(keyCaptureType + keyCapturePlayer).value = displayValue;
        document.getElementById(keyCaptureType + keyCapturePlayer).style.backgroundColor = '';

        cleanupCapture();
    }
}

function cleanupCapture() {
    document.removeEventListener('keydown', captureKey);
    document.removeEventListener('mousedown', captureMouse);
    document.removeEventListener('wheel', captureWheel);

    // 隐藏遮罩层
    document.getElementById('keyCaptureOverlay').style.display = 'none';

    keyCapturePlayer = null;
    keyCaptureType = null;
}

function startGame() {
    // 确保玩家数据已初始化
    if (!gameSettings.players || gameSettings.players.length === 0) {
        console.log('Initializing players in startGame');
        initializePlayers();
    }

    // 保存设置
    const playerCount = parseInt(document.getElementById('playerCount').value);
    gameSettings.playerCount = playerCount;

    for (let i = 0; i < playerCount; i++) {
        // 保存阵营选择
        const teamSelect = document.getElementById(`teamSelect${i}`);
        if (teamSelect && gameSettings.players[i]) {
            gameSettings.players[i].team = parseInt(teamSelect.value);
        }

        // 保存瞄准模式
        const aimMode = document.querySelector(`input[name="aimMode${i}"]:checked`);
        if (aimMode && gameSettings.players[i]) {
            gameSettings.players[i].controls.aimMode = aimMode.value;
        }
    }

    // 隐藏设置面板
    toggleSettings();

    // 初始化游戏
    initGame();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化玩家设置
    initializePlayers();
});

// 游戏初始化
function initGame() {
    // 确保玩家数据已初始化
    if (!gameSettings.players || gameSettings.players.length === 0) {
        console.log('Initializing players in initGame');
        initializePlayers();
    }

    // 根据设置创建玩家
    const positions = [
        { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 }, // 0人模式下的观察位置
        { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 }, // 1人
        { x: SCREEN_WIDTH / 4, y: SCREEN_HEIGHT / 2 }, // 玩家1
        { x: 3 * SCREEN_WIDTH / 4, y: SCREEN_HEIGHT / 2 }, // 玩家2
        { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 4 }, // 玩家3
        { x: SCREEN_WIDTH / 2, y: 3 * SCREEN_HEIGHT / 4 }, // 玩家4
        { x: SCREEN_WIDTH / 4, y: SCREEN_HEIGHT / 4 }, // 玩家5
        { x: 3 * SCREEN_WIDTH / 4, y: SCREEN_HEIGHT / 4 }, // 玩家6
        { x: SCREEN_WIDTH / 4, y: 3 * SCREEN_HEIGHT / 4 }, // 玩家7
        { x: 3 * SCREEN_WIDTH / 4, y: 3 * SCREEN_HEIGHT / 4 }, // 玩家8
        { x: SCREEN_WIDTH / 6, y: SCREEN_HEIGHT / 2 }, // 玩家9
        { x: 5 * SCREEN_WIDTH / 6, y: SCREEN_HEIGHT / 2 }, // 玩家10
        { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 6 }, // 玩家11
        { x: SCREEN_WIDTH / 2, y: 5 * SCREEN_HEIGHT / 6 }  // 玩家12
    ];

    // 初始化所有玩家变量为null
    for (let i = 1; i <= 12; i++) {
        eval(`player${i} = null; joystick${i} = null; button${i} = null; button${i}Shield = null;`);
    }

    // 创建玩家
    for (let i = 0; i < gameSettings.playerCount; i++) {
        const player = gameSettings.players[i];
        if (!player) {
            console.error(`Player ${i} not found in gameSettings.players`);
            continue;
        }

        const playerColor = player.color || PLAYER_COLORS[i % PLAYER_COLORS.length];
        const pos = positions[i + 1] || positions[1];

        eval(`player${i + 1} = new Player(pos.x, pos.y, playerColor, player.team, player.id, player.name);`);

        // 创建触控控件（如果需要的话）
        if (isTouchDevice() || showTouchControls) {
            const joystickX = (i % 3) * 200 + 100;
            const joystickY = Math.floor(i / 3) * 200 + 100;
            const buttonX = joystickX - 50;
            const buttonY = joystickY + 100;

            eval(`joystick${i + 1} = new Joystick(joystickX, joystickY);`);
            eval(`button${i + 1} = new Button(buttonX, buttonY, 100, 50, "Shoot");`);
            eval(`button${i + 1}Shield = new Button(buttonX, buttonY + 100, 100, 50, "Shield");`);
        }
    }

    restartButton = new Button(SCREEN_WIDTH / 2 - 110, SCREEN_HEIGHT / 2 + 50, 100, 50, "重新开始");
    backToMenuButton = new Button(SCREEN_WIDTH / 2 + 10, SCREEN_HEIGHT / 2 + 50, 100, 50, "主界面");

    bullets = [];
    walls = generateMap();
    gameOver = false;
    winner = null;
    effectCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT); // 清空效果画布

    // 根据设备类型设置初始触控显示状态
    showTouchControls = isTouchDevice();
}

// 绘制状态信息
function drawStatus() {
    ctx.font = '20px Arial';

    const statusY = 70;
    const statusSpacing = 150;

    for (let i = 0; i < gameSettings.playerCount; i++) {
        const playerObj = getPlayerObject(i);
        const player = gameSettings.players[i];
        const x = 10 + (i * statusSpacing);

        if (player && playerObj) {
            let statusText;
            if (playerObj.shieldActive) {
                const remainingTime = Math.max(0, playerObj.shieldDuration - (Date.now() - playerObj.shieldStartTime) / 1000);
                statusText = `护盾: ${remainingTime.toFixed(1)}s`;
            } else if (playerObj.shieldCooldown > 0) {
                statusText = `冷却: ${playerObj.shieldCooldown.toFixed(1)}s`;
            } else {
                statusText = "护盾就绪";
            }

            const playerColor = player.color || PLAYER_COLORS[i % PLAYER_COLORS.length];
            ctx.fillStyle = playerColor;
            ctx.textAlign = 'left';
            ctx.fillText(statusText, x, statusY);
        }
    }
}

// 键盘和鼠标事件处理
const keysPressed = {};
const mouseButtonsPressed = {};

document.addEventListener('keydown', (event) => {
    // 统一的事件阻断检查
    if (blockEventIfNeeded(event)) return;

    keysPressed[event.key] = true;
    lastKeyboardEventTime = Date.now();

    if (gameOver && event.key === 'r') { // 假设R键重启
        initGame();
        return;
    }

    if (!gameOver) {
        // 检查所有玩家的键位
        for (let i = 0; i < gameSettings.playerCount; i++) {
            const player = gameSettings.players[i];
            const playerObj = getPlayerObject(i);

            if (player && playerObj && event.key === player.controls.shootKey && !playerObj.isShieldActive()) {
                bullets.push(new Bullet(playerObj.x, playerObj.y, playerObj.angle + Math.PI, playerObj.teamColor, playerObj));
                playerObj.pushBack(2, playerObj.angle);
            } else if (player && playerObj && event.key === player.controls.shieldKey) {
                playerObj.activateShield();
            }
        }

        if (event.key === 't') {
            showTouchControls = !showTouchControls;
        }
    }
});

document.addEventListener('keyup', (event) => {
    // 统一的事件阻断检查
    if (blockEventIfNeeded(event)) return;

    keysPressed[event.key] = false;

    // 检查所有玩家的护盾键
    for (let i = 0; i < gameSettings.playerCount; i++) {
        const player = gameSettings.players[i];
        const playerObj = getPlayerObject(i);
        if (player && playerObj && event.key === player.controls.shieldKey) {
            playerObj.deactivateShield();
        }
    }
});

// 阻止右键菜单
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    return false;
});

// 鼠标事件处理
document.addEventListener('mousedown', (event) => {
    // 统一的事件阻断检查
    if (blockEventIfNeeded(event)) return;

    const mouseKey = `mouse${event.button}`;
    mouseButtonsPressed[mouseKey] = true;
    lastMouseEventTime = Date.now();

    if (!gameOver) {
        // 检查所有玩家的鼠标按键
        for (let i = 0; i < gameSettings.playerCount; i++) {
            const player = gameSettings.players[i];
            const playerObj = getPlayerObject(i);

            if (player && playerObj && mouseKey === player.controls.shootKey && !playerObj.isShieldActive()) {
                bullets.push(new Bullet(playerObj.x, playerObj.y, playerObj.angle + Math.PI, playerObj.teamColor, playerObj));
                playerObj.pushBack(2, playerObj.angle);
            } else if (player && playerObj && mouseKey === player.controls.shieldKey) {
                playerObj.activateShield();
            }
        }
    }
});

document.addEventListener('mouseup', (event) => {
    // 统一的事件阻断检查
    if (blockEventIfNeeded(event)) return;

    const mouseKey = `mouse${event.button}`;
    mouseButtonsPressed[mouseKey] = false;

    // 检查所有玩家的鼠标护盾键
    for (let i = 0; i < gameSettings.playerCount; i++) {
        const player = gameSettings.players[i];
        const playerObj = getPlayerObject(i);
        if (player && playerObj && mouseKey === player.controls.shieldKey) {
            playerObj.deactivateShield();
        }
    }
});

let wheelEvents = {};
document.addEventListener('wheel', (event) => {
    // 对于滚轮事件，特殊处理（因为它是passive的）
    if (shouldBlockGameEvents()) {
        event.stopPropagation();
        return;
    }

    lastMouseEventTime = Date.now();

    if (!gameOver) {
        const wheelDirection = event.deltaY > 0 ? 'wheelDown' : 'wheelUp';

        // 检查所有玩家的滚轮键
        for (let i = 0; i < gameSettings.playerCount; i++) {
            const player = gameSettings.players[i];
            const playerObj = getPlayerObject(i);

            if (player && playerObj && wheelDirection === player.controls.shootKey && !playerObj.isShieldActive()) {
                bullets.push(new Bullet(playerObj.x, playerObj.y, playerObj.angle + Math.PI, playerObj.teamColor, playerObj));
                playerObj.pushBack(2, playerObj.angle);
            } else if (player && playerObj && wheelDirection === player.controls.shieldKey) {
                playerObj.activateShield();
                // 滚轮事件自动释放护盾
                setTimeout(() => playerObj.deactivateShield(), 100);
            }
        }
    }
});

// 获取玩家对象
function getPlayerObject(playerIndex) {
    switch (playerIndex) {
        case 0: return player1;
        case 1: return player2;
        case 2: return player3;
        case 3: return player4;
        case 4: return player5;
        case 5: return player6;
        case 6: return player7;
        case 7: return player8;
        case 8: return player9;
        case 9: return player10;
        case 10: return player11;
        case 11: return player12;
        default: return null;
    }
}

// 检查游戏结束条件
function checkGameEndCondition() {
    // 获取所有存活玩家的阵营
    const aliveTeams = new Set();
    const alivePlayers = [];

    for (let i = 0; i < gameSettings.playerCount; i++) {
        const playerObj = getPlayerObject(i);
        if (playerObj && playerObj.isAlive && playerObj.health > 0) {
            aliveTeams.add(playerObj.team);
            alivePlayers.push(playerObj);
        }
    }

    // 如果只剩一个阵营，游戏结束
    if (aliveTeams.size === 1) {
        gameOver = true;
        const winningTeam = Array.from(aliveTeams)[0];
        winner = `阵营 ${winningTeam + 1}`;

        // 计算排行榜数据
        calculateLeaderboards(alivePlayers, winningTeam);
    } else if (aliveTeams.size === 0) {
        // 所有玩家都死亡（极少情况）
        gameOver = true;
        winner = "平局";
    }
}

// 计算排行榜数据
function calculateLeaderboards(alivePlayers, winningTeam) {
    // 获取所有玩家的统计数据
    const allPlayers = [];
    for (let i = 0; i < gameSettings.playerCount; i++) {
        const playerObj = getPlayerObject(i);
        if (playerObj) {
            allPlayers.push(playerObj);
        }
    }

    // 击杀数排行榜
    const killLeaderboard = [...allPlayers].sort((a, b) => b.kills - a.kills);

    // 伤害排行榜
    const damageLeaderboard = [...allPlayers].sort((a, b) => b.damageDealt - a.damageDealt);

    // 阵营击杀排行榜
    const teamKillStats = {};
    const teamDamageStats = {};

    allPlayers.forEach(player => {
        if (!teamKillStats[player.team]) {
            teamKillStats[player.team] = { team: player.team, kills: 0, players: [] };
            teamDamageStats[player.team] = { team: player.team, damage: 0, players: [] };
        }
        teamKillStats[player.team].kills += player.kills;
        teamKillStats[player.team].players.push(player);
        teamDamageStats[player.team].damage += player.damageDealt;
        teamDamageStats[player.team].players.push(player);
    });

    const teamKillLeaderboard = Object.values(teamKillStats).sort((a, b) => b.kills - a.kills);
    const teamDamageLeaderboard = Object.values(teamDamageStats).sort((a, b) => b.damage - a.damage);

    // 保存排行榜数据
    gameStats = {
        winningTeam,
        alivePlayers,
        killLeaderboard,
        damageLeaderboard,
        teamKillLeaderboard,
        teamDamageLeaderboard
    };
}

// 绘制游戏结束屏幕
function drawGameEndScreen() {
    // 绘制地图和涂鸦作为背景
    ctx.drawImage(effectCanvas, 0, 0); // 绘制涂鸦效果
    for (const wall of walls) {
        wall.draw(); // 绘制墙壁
    }

    // 添加淡灰色半透明覆盖层，使文字更清晰
    ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 标题
    ctx.fillStyle = 'rgb(64, 64, 64)'; // 深灰色文字
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${winner} 获胜！`, SCREEN_WIDTH / 2, 60);

    // 显示获胜阵营的玩家
    ctx.fillStyle = 'rgb(64, 64, 64)'; // 深灰色文字
    ctx.font = '24px Arial';
    ctx.fillText(`获胜玩家:`, SCREEN_WIDTH / 2, 100);

    let yPos = 130;
    gameStats.alivePlayers.forEach(player => {
        ctx.fillStyle = player.color;
        ctx.fillText(`玩家 ${player.playerId} (${player.playerName})`, SCREEN_WIDTH / 2, yPos);
        yPos += 30;
    });

    // 排行榜标题
    ctx.fillStyle = 'rgb(64, 64, 64)'; // 深灰色文字
    ctx.font = '20px Arial';
    ctx.fillText('排行榜 (点击切换: 击杀数 / 伤害)', SCREEN_WIDTH / 2, yPos + 20);

    // 绘制排行榜
    drawLeaderboards(SCREEN_WIDTH / 2, yPos + 40);

    // 绘制按钮
    restartButton.draw();
    backToMenuButton.draw();
}

// 排行榜显示模式
let leaderboardMode = 'kills'; // 'kills' 或 'damage'

// 绘制排行榜
function drawLeaderboards(centerX, startY) {
    const leftX = centerX - 150;
    const rightX = centerX + 150;

    // 左侧排行榜
    ctx.fillStyle = 'rgb(64, 64, 64)'; // 深灰色文字
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';

    let leftTitle, leftData;
    if (leaderboardMode === 'kills') {
        leftTitle = '击杀数排行';
        leftData = gameStats.killLeaderboard.slice(0, 8); // 显示前8名
    } else {
        leftTitle = '伤害排行';
        leftData = gameStats.damageLeaderboard.slice(0, 8);
    }

    ctx.fillText(leftTitle, leftX, startY);

    leftData.forEach((player, index) => {
        const y = startY + 30 + index * 25;
        const stat = leaderboardMode === 'kills' ? player.kills : Math.round(player.damageDealt);

        ctx.fillStyle = player.color;
        ctx.fillText(`${index + 1}. 玩家${player.playerId}`, leftX, y);

        ctx.fillStyle = 'rgb(64, 64, 64)'; // 深灰色文字
        ctx.fillText(stat.toString(), leftX + 120, y);
    });

    // 右侧排行榜（阵营）
    ctx.textAlign = 'right';
    let rightTitle, rightData;
    if (leaderboardMode === 'kills') {
        rightTitle = '阵营击杀排行';
        rightData = gameStats.teamKillLeaderboard.slice(0, 6);
    } else {
        rightTitle = '阵营伤害排行';
        rightData = gameStats.teamDamageLeaderboard.slice(0, 6);
    }

    ctx.fillStyle = 'rgb(64, 64, 64)'; // 深灰色文字
    ctx.fillText(rightTitle, rightX, startY);

    rightData.forEach((team, index) => {
        const y = startY + 30 + index * 25;
        const stat = leaderboardMode === 'kills' ? team.kills : Math.round(team.damage);

        ctx.fillStyle = TEAM_COLORS[team.team];
        ctx.fillText(`阵营${team.team + 1}`, rightX - 40, y);

        ctx.fillStyle = 'rgb(64, 64, 64)'; // 深灰色文字
        ctx.fillText(stat.toString(), rightX, y);
    });
}

// 切换排行榜模式
function toggleLeaderboardMode() {
    leaderboardMode = leaderboardMode === 'kills' ? 'damage' : 'kills';
}

// 获取显示值
function getDisplayValue(keyValue) {
    if (keyValue.startsWith('mouse')) {
        const button = parseInt(keyValue.replace('mouse', ''));
        return MOUSE_BUTTON_NAMES[button] || `鼠标按键${button}`;
    } else if (keyValue === 'wheelUp') {
        return '滚轮上滚';
    } else if (keyValue === 'wheelDown') {
        return '滚轮下滚';
    } else {
        return keyValue;
    }
}

// 触摸事件处理
let activeTouches = {}; // 存储当前活跃的触摸点

canvas.addEventListener('touchstart', (event) => {
    // 统一的事件阻断检查
    if (blockEventIfNeeded(event)) return;

    event.preventDefault(); // 阻止默认的触摸行为，如页面滚动
    lastTouchEventTime = Date.now(); // 记录触摸事件时间
    for (const touch of event.changedTouches) {
        const pos = { x: touch.clientX - canvas.getBoundingClientRect().left, y: touch.clientY - canvas.getBoundingClientRect().top };
        activeTouches[touch.identifier] = { x: pos.x, y: pos.y };

        if (gameOver) {
            if (restartButton.isPressed(pos)) {
                initGame();
                break;
            }
            if (backToMenuButton.isPressed(pos)) {
                backToMainMenu();
                break;
            }
            // 检查排行榜切换区域
            if (gameStats && pos.y >= SCREEN_HEIGHT / 2 - 50 && pos.y <= SCREEN_HEIGHT / 2 + 50 &&
                pos.x >= SCREEN_WIDTH / 2 - 200 && pos.x <= SCREEN_WIDTH / 2 + 200) {
                toggleLeaderboardMode();
            }
        } else {
            let handled = false;

            // 检查所有玩家的按钮
            for (let i = 0; i < gameSettings.playerCount; i++) {
                const playerObj = getPlayerObject(i);
                const player = gameSettings.players[i];
                const button = eval(`button${i + 1}`);
                const buttonShield = eval(`button${i + 1}Shield`);

                if (!handled && player && playerObj && button && button.isPressed(pos)) {
                    bullets.push(new Bullet(playerObj.x, playerObj.y, playerObj.angle + Math.PI, playerObj.teamColor, playerObj));
                    playerObj.pushBack(2, playerObj.angle);
                    handled = true;
                } else if (!handled && player && playerObj && buttonShield && buttonShield.isPressed(pos)) {
                    playerObj.activateShield();
                    handled = true;
                }
            }

            if (!handled) {
                // 分配触摸到最近的摇杆
                for (let i = 0; i < gameSettings.playerCount; i++) {
                    const joystick = eval(`joystick${i + 1}`);
                    if (joystick) {
                        const distance = Math.hypot(pos.x - joystick.x, pos.y - joystick.y);
                        if (distance < joystick.radius) {
                            joystick.update(pos);
                            break;
                        }
                    }
                }
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    // 统一的事件阻断检查
    if (blockEventIfNeeded(event)) return;

    event.preventDefault();
    lastTouchEventTime = Date.now();
    if (!gameOver) {
        for (const touch of event.changedTouches) {
            const pos = { x: touch.clientX - canvas.getBoundingClientRect().left, y: touch.clientY - canvas.getBoundingClientRect().top };
            activeTouches[touch.identifier] = { x: pos.x, y: pos.y };

            // 分配触摸到最近的摇杆
            for (let i = 0; i < gameSettings.playerCount; i++) {
                const joystick = eval(`joystick${i + 1}`);
                if (joystick) {
                    const distance = Math.hypot(pos.x - joystick.x, pos.y - joystick.y);
                    if (distance < joystick.radius) {
                        joystick.update(pos);
                        break;
                    }
                }
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (event) => {
    // 统一的事件阻断检查
    if (blockEventIfNeeded(event)) return;

    event.preventDefault();
    lastTouchEventTime = Date.now();
    for (const touch of event.changedTouches) {
        const pos = { x: touch.clientX - canvas.getBoundingClientRect().left, y: touch.clientY - canvas.getBoundingClientRect().top };
        delete activeTouches[touch.identifier];

        // 检查所有玩家的护盾按钮释放
        for (let i = 0; i < gameSettings.playerCount; i++) {
            const playerObj = getPlayerObject(i);
            const player = gameSettings.players[i];
            const buttonShield = eval(`button${i + 1}Shield`);
            if (player && playerObj && buttonShield && buttonShield.isPressed(pos)) {
                playerObj.deactivateShield();
            }
        }

        // 重置摇杆
        for (let i = 0; i < gameSettings.playerCount; i++) {
            const joystick = eval(`joystick${i + 1}`);
            if (joystick) {
                const distance = Math.hypot(pos.x - joystick.x, pos.y - joystick.y);
                if (distance < joystick.radius) {
                    joystick.dx = 0;
                    joystick.dy = 0;
                    break;
                }
            }
        }
    }
}, { passive: false });

// 鼠标事件处理
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    lastMouseEventTime = Date.now();
});

canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    return false;
});

canvas.addEventListener('mousedown', (event) => {
    lastMouseEventTime = Date.now();

    if (gameOver) {
        const canvasRect = canvas.getBoundingClientRect();
        const clickX = event.clientX - canvasRect.left;
        const clickY = event.clientY - canvasRect.top;
        const pos = { x: clickX, y: clickY };

        if (restartButton.isPressed(pos)) {
            initGame();
            return;
        }
        if (backToMenuButton.isPressed(pos)) {
            backToMainMenu();
            return;
        }

        // 检查排行榜切换区域
        if (gameStats && clickY >= SCREEN_HEIGHT / 2 - 50 && clickY <= SCREEN_HEIGHT / 2 + 50 &&
            clickX >= SCREEN_WIDTH / 2 - 200 && clickX <= SCREEN_WIDTH / 2 + 200) {
            toggleLeaderboardMode();
        }
    }
});

// 游戏主循环
function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);

    deltaTime = (currentTime - lastTime) / 1000; // 转换为秒
    lastTime = currentTime;

    // 清空屏幕
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 如果游戏暂停，只显示当前状态，不更新游戏逻辑
    if (gamePaused) {
        // 绘制子弹的路线和爆炸效果
        ctx.drawImage(effectCanvas, 0, 0);

        // 绘制墙
        for (const wall of walls) {
            wall.draw();
        }

    // 绘制玩家
    for (let i = 0; i < gameSettings.playerCount; i++) {
        const playerObj = getPlayerObject(i);
        if (playerObj && playerObj.isAlive) {
            playerObj.draw();
        }
    }

        // 绘制子弹
        for (const bullet of bullets) {
            bullet.draw();
        }

        // 绘制血量
        ctx.fillStyle = BLACK;
        ctx.font = '24px Arial';

        const healthY = 30;
        const healthSpacing = 150;

        for (let i = 0; i < gameSettings.playerCount; i++) {
            const playerObj = getPlayerObject(i);
            const player = gameSettings.players[i];
            const x = 10 + (i * healthSpacing);

            if (player && playerObj && playerObj.isAlive) {
                const playerColor = player.color || PLAYER_COLORS[i % PLAYER_COLORS.length];
                ctx.fillStyle = playerColor;
                ctx.textAlign = 'left';
                ctx.fillText(`P${i + 1}: ${playerObj.health}`, x, healthY);
            }
        }

        // 绘制状态信息
        ctx.font = '20px Arial';

        const statusY = 70;
        const statusSpacing = 150;

        for (let i = 0; i < gameSettings.playerCount; i++) {
            const playerObj = getPlayerObject(i);
            const player = gameSettings.players[i];
            const x = 10 + (i * statusSpacing);

            if (player && playerObj) {
                let statusText;
                if (playerObj.shieldActive) {
                    const remainingTime = Math.max(0, playerObj.shieldDuration - (Date.now() - playerObj.shieldStartTime) / 1000);
                    statusText = `护盾: ${remainingTime.toFixed(1)}s`;
                } else if (playerObj.shieldCooldown > 0) {
                    statusText = `冷却: ${playerObj.shieldCooldown.toFixed(1)}s`;
                } else {
                    statusText = "护盾就绪";
                }

                const playerColor = player.color || PLAYER_COLORS[i % PLAYER_COLORS.length];
                ctx.fillStyle = playerColor;
                ctx.textAlign = 'left';
                ctx.fillText(statusText, x, statusY);
            }
        }

        // 显示暂停状态
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        ctx.fillStyle = WHITE;
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('游戏暂停 - 设置中', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);

        return;
    }

    // 如果游戏结束，只显示结束界面
    if (gameOver) {
        if (gameStats) {
            drawGameEndScreen();
        } else {
            ctx.fillStyle = BLACK;
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${winner} Wins!`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20);
        }
        restartButton.draw();
        return;
    }

    // 如果游戏结束，只显示结束界面
    if (gameOver) {
        if (gameStats) {
            drawGameEndScreen();
        } else {
            ctx.fillStyle = BLACK;
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${winner} Wins!`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20);
        }
        restartButton.draw();
        return;
    }

    // 绘制子弹的路线和爆炸效果
    ctx.drawImage(effectCanvas, 0, 0);

    // 绘制墙
    for (const wall of walls) {
        wall.draw();
    }

    // 处理键盘控制玩家旋转
    for (let i = 0; i < gameSettings.playerCount; i++) {
        const player = gameSettings.players[i];
        const playerObj = getPlayerObject(i);

        if (playerObj && playerObj.isAlive && player.controls.aimMode === 'keys') {
            if (keysPressed[player.controls.leftKey]) playerObj.angle -= 0.1;
            if (keysPressed[player.controls.rightKey]) playerObj.angle += 0.1;
        }
    }

    if (!gameOver) {
        // 更新玩家朝向
        for (let i = 0; i < gameSettings.playerCount; i++) {
            const player = gameSettings.players[i];
            const playerObj = getPlayerObject(i);

            if (playerObj && playerObj.isAlive && player.controls.aimMode === 'mouse') {
                // 鼠标对准模式
                const angleToMouse = Math.atan2(mouseY - playerObj.y, mouseX - playerObj.x);
                playerObj.rotate(angleToMouse);
            } else if (playerObj && playerObj.isAlive) {
                // 摇杆控制
                const joystick = eval(`joystick${i + 1}`);
                if (joystick && (joystick.dx !== 0 || joystick.dy !== 0)) {
                    playerObj.rotate(Math.atan2(joystick.dy, joystick.dx));
                }
            }
        }

        // 移动玩家
        for (let i = 0; i < gameSettings.playerCount; i++) {
            const playerObj = getPlayerObject(i);
            if (playerObj && playerObj.isAlive) {
                playerObj.move(walls);
                playerObj.update(deltaTime);
            }
        }

        // 移动子弹
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            bullet.move(walls);
            // 移除屏幕外的子弹
            if (bullet.x < 0 || bullet.x > SCREEN_WIDTH || bullet.y < 0 || bullet.y > SCREEN_HEIGHT || !bullet.active) {
                // bullet.explode(walls); // 已经在move中处理了爆炸效果
                bullets.splice(i, 1);
            }
        }

        // 检测子弹与玩家的碰撞
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            if (!bullet.isActive()) continue; // 子弹射出后前0.2秒不判定击中

            // 检测防护罩
            let hitShield = false;
            for (let p = 0; p < gameSettings.playerCount; p++) {
                const playerObj = getPlayerObject(p);
                if (playerObj && playerObj.isShieldActive() && Math.hypot(bullet.x - playerObj.x, bullet.y - playerObj.y) < playerObj.shieldRadius) {
                    bullet.explode(walls);
                    bullets.splice(i, 1);
                    playerObj.deactivateShield();
                    playerObj.shieldCooldown = 1;
                    hitShield = true;
                    break;
                }
            }
            if (hitShield) continue;

            // 检查击中其他玩家
            let hitPlayer = false;
            for (let p = 0; p < gameSettings.playerCount; p++) {
                const targetPlayer = getPlayerObject(p);
                if (targetPlayer && bullet.owner !== targetPlayer && Math.hypot(bullet.x - targetPlayer.x, bullet.y - targetPlayer.y) < targetPlayer.size + bullet.radius) {
                    const damage = 10;
                    targetPlayer.health -= damage;
                    targetPlayer.damageTaken += damage;

                    // 记录攻击者的伤害统计
                    bullet.owner.damageDealt += damage;

                    // 如果玩家死亡，记录击杀数
                    if (targetPlayer.health <= 0) {
                        bullet.owner.kills += 1;
                        targetPlayer.isAlive = false;

                        // 从游戏中完全移除死亡玩家
                        const playerIndex = targetPlayer.playerId - 1;
                        eval(`player${playerIndex + 1} = null;`);

                        // 检查是否只剩一个阵营
                        checkGameEndCondition();
                    }

                    bullet.explode(walls);
                    bullets.splice(i, 1);
                    hitPlayer = true;
                    break;
                }
            }
            if (hitPlayer) continue;
        }
    }

    // 绘制玩家
    for (let i = 0; i < gameSettings.playerCount; i++) {
        const playerObj = getPlayerObject(i);
        if (playerObj && playerObj.isAlive) {
            playerObj.draw();
        }
    }

    // 绘制子弹 (子弹轨迹在effectCanvas上)
    for (const bullet of bullets) {
        bullet.draw();
    }

    // 绘制摇杆和按钮
    const now = Date.now();
    const keyboardInactiveTime = (now - lastKeyboardEventTime) / 1000;
    const mouseInactiveTime = (now - lastMouseEventTime) / 1000;
    const touchInactiveTime = (now - lastTouchEventTime) / 1000;

    // 如果检测到触摸事件，显示触控按钮；如果检测到键盘或鼠标事件，隐藏触控按钮
    const shouldShowTouchControls = showTouchControls || (touchInactiveTime <= HIDE_DELAY && (keyboardInactiveTime > HIDE_DELAY && mouseInactiveTime > HIDE_DELAY));

    if (shouldShowTouchControls) {
        for (let i = 0; i < gameSettings.playerCount; i++) {
            const joystick = eval(`joystick${i + 1}`);
            const button = eval(`button${i + 1}`);
            const buttonShield = eval(`button${i + 1}Shield`);

            if (joystick) joystick.draw();
            if (button) button.draw();
            if (buttonShield) buttonShield.draw();
        }
    }

    // 绘制血量
    ctx.fillStyle = BLACK;
    ctx.font = '24px Arial';

    const healthY = 30;
    const healthSpacing = 150;

    for (let i = 0; i < gameSettings.playerCount; i++) {
        const playerObj = getPlayerObject(i);
        const player = gameSettings.players[i];
        const x = 10 + (i * healthSpacing);

        if (player && playerObj && playerObj.isAlive) {
            const playerColor = player.color || PLAYER_COLORS[i % PLAYER_COLORS.length];
            ctx.fillStyle = playerColor;
            ctx.textAlign = 'left';
            ctx.fillText(`P${i + 1}: ${playerObj.health}`, x, healthY);
        }
    }

    // 游戏结束逻辑
    if (gameOver) {
        if (gameStats) {
            // 显示获胜阵营和排行榜
            drawGameEndScreen();
        } else {
            // 兼容旧的游戏结束显示
            ctx.fillStyle = BLACK;
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${winner} Wins!`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20);
        }
        restartButton.draw();
    }

    // 在绘制所有其他元素后调用
    drawStatus();
}

// 启动游戏
initGame();
requestAnimationFrame(gameLoop);
