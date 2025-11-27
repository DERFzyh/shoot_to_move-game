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
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = 15; // 三角形的大小
        this.angle = 0; // 初始角度
        this.health = 100;
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
                    if ((this.color === BLUE && (wall.color === LIGHT_RED || wall.color === WHITE)) ||
                        (this.color === RED && (wall.color === LIGHT_BLUE || wall.color === WHITE))) {
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
    constructor(x, y, angle, color, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 10;
        this.radius = 5;
        this.color = color;
        this.trailColor = (color === BLUE) ? LIGHT_BLUE : LIGHT_RED;
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
                        if ((this.color === BLUE && (wall.color === LIGHT_RED || wall.color === WHITE)) ||
                            (this.color === RED && (wall.color === LIGHT_BLUE || wall.color === WHITE))) {
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

        // 将距离25以内的墙2变为同色
        for (const wall of walls) {
            if (wall.wallType === 2) {
                const distance = Math.hypot(wall.x + WALL_SIZE / 2 - this.x, wall.y + WALL_SIZE / 2 - this.y);
                if (distance <= 25) {
                    wall.color = this.trailColor;
                }
            }
        }
    }
}

// 墙类 (Wall Class)
class Wall {
    constructor(x, y, wallType) {
        this.x = x;
        this.y = y;
        this.wallType = wallType;
        this.color = (wallType === 2) ? WHITE : null; // Type 2 墙默认是白色
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
                walls.push(new Wall((x + 1) * WALL_SIZE, (y + 1) * WALL_SIZE, wallType));
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

// 游戏状态变量
let player1, player2, joystick1, joystick2, button1, button2, button1Shield, button2Shield, restartButton;
let bullets = [];
let walls = [];
let gameOver = false;
let winner = null;
let showTouchControls = true; // 默认显示按钮
let lastKeyboardEventTime = 0; // 记录最后一次键盘事件的时间
const HIDE_DELAY = 5; // 键盘事件后隐藏按钮的延迟时间（秒）

// 游戏初始化
function initGame() {
    player1 = new Player(SCREEN_WIDTH / 4, SCREEN_HEIGHT / 2, BLUE);
    player2 = new Player(3 * SCREEN_WIDTH / 4, SCREEN_HEIGHT / 2, RED);

    joystick1 = new Joystick(100, 150);
    button1 = new Button(50, 250, 100, 50, "Shoot");
    button1Shield = new Button(50, 350, 100, 50, "Shield");

    joystick2 = new Joystick(SCREEN_WIDTH - 100, SCREEN_HEIGHT - 150);
    button2 = new Button(SCREEN_WIDTH - 150, SCREEN_HEIGHT - 250, 100, 50, "Shoot");
    button2Shield = new Button(SCREEN_WIDTH - 150, SCREEN_HEIGHT - 350, 100, 50, "Shield");

    restartButton = new Button(SCREEN_WIDTH / 2 - 50, SCREEN_HEIGHT / 2 + 50, 100, 50, "Restart");

    bullets = [];
    walls = generateMap();
    gameOver = false;
    winner = null;
    effectCtx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT); // 清空效果画布
}

// 绘制状态信息
function drawStatus() {
    ctx.font = '24px Arial';

    // 玩家1状态
    let statusText1;
    if (player1.shieldActive) {
        const remainingTime = Math.max(0, player1.shieldDuration - (Date.now() - player1.shieldStartTime) / 1000);
        statusText1 = `P1 Shield: ${remainingTime.toFixed(1)}s`;
    } else if (player1.shieldCooldown > 0) {
        statusText1 = `P1 Shield CD: ${player1.shieldCooldown.toFixed(1)}s`;
    } else {
        statusText1 = "P1 Shield Ready";
    }
    ctx.fillStyle = BLUE;
    ctx.textAlign = 'left';
    ctx.fillText(statusText1, 10, 50);

    // 玩家2状态
    let statusText2;
    if (player2.shieldActive) {
        const remainingTime = Math.max(0, player2.shieldDuration - (Date.now() - player2.shieldStartTime) / 1000);
        statusText2 = `P2 Shield: ${remainingTime.toFixed(1)}s`;
    } else if (player2.shieldCooldown > 0) {
        statusText2 = `P2 Shield CD: ${player2.shieldCooldown.toFixed(1)}s`;
    } else {
        statusText2 = "P2 Shield Ready";
    }
    ctx.fillStyle = RED;
    ctx.textAlign = 'right';
    ctx.fillText(statusText2, SCREEN_WIDTH - 10, 50);
}

// 键盘事件处理
const keysPressed = {};

document.addEventListener('keydown', (event) => {
    keysPressed[event.key] = true;
    lastKeyboardEventTime = Date.now();

    if (gameOver && event.key === 'r') { // 假设R键重启
        initGame();
        return;
    }

    if (!gameOver) {
        if (event.key === 'w' && !player1.isShieldActive()) {
            bullets.push(new Bullet(player1.x, player1.y, player1.angle + Math.PI, BLUE, player1));
            player1.pushBack(2, player1.angle);
        } else if (event.key === ' ' && !player2.isShieldActive()) { // Spacebar
            bullets.push(new Bullet(player2.x, player2.y, player2.angle + Math.PI, RED, player2));
            player2.pushBack(2, player2.angle);
        } else if (event.key === 't') {
            showTouchControls = !showTouchControls;
        } else if (event.key === 's') { // 玩家1激活防护罩
            player1.activateShield();
        } else if (event.key === 'Shift') { // 玩家2激活防护罩 (左Shift或右Shift)
            player2.activateShield();
        }
    }
});

document.addEventListener('keyup', (event) => {
    keysPressed[event.key] = false;

    if (event.key === 's') {
        player1.deactivateShield();
    } else if (event.key === 'Shift') {
        player2.deactivateShield();
    }
});

// 触摸事件处理
let activeTouches = {}; // 存储当前活跃的触摸点

canvas.addEventListener('touchstart', (event) => {
    event.preventDefault(); // 阻止默认的触摸行为，如页面滚动
    lastKeyboardEventTime = Date.now(); // 触摸事件也视为用户活动
    for (const touch of event.changedTouches) {
        const pos = { x: touch.clientX - canvas.getBoundingClientRect().left, y: touch.clientY - canvas.getBoundingClientRect().top };
        activeTouches[touch.identifier] = { x: pos.x, y: pos.y };

        if (gameOver) {
            if (restartButton.isPressed(pos)) {
                initGame();
                break;
            }
        } else {
            if (button1.isPressed(pos)) {
                bullets.push(new Bullet(player1.x, player1.y, player1.angle + Math.PI, BLUE, player1));
                player1.pushBack(2, player1.angle);
            } else if (button2.isPressed(pos)) {
                bullets.push(new Bullet(player2.x, player2.y, player2.angle + Math.PI, RED, player2));
                player2.pushBack(2, player2.angle);
            } else if (button1Shield.isPressed(pos)) {
                player1.activateShield();
            } else if (button2Shield.isPressed(pos)) {
                player2.activateShield();
            } else if (pos.x < SCREEN_WIDTH / 2) {
                joystick1.update(pos);
            } else {
                joystick2.update(pos);
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    lastKeyboardEventTime = Date.now();
    if (!gameOver) {
        for (const touch of event.changedTouches) {
            const pos = { x: touch.clientX - canvas.getBoundingClientRect().left, y: touch.clientY - canvas.getBoundingClientRect().top };
            activeTouches[touch.identifier] = { x: pos.x, y: pos.y };
            if (pos.x < SCREEN_WIDTH / 2) {
                joystick1.update(pos);
            } else {
                joystick2.update(pos);
            }
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (event) => {
    event.preventDefault();
    lastKeyboardEventTime = Date.now();
    for (const touch of event.changedTouches) {
        const pos = { x: touch.clientX - canvas.getBoundingClientRect().left, y: touch.clientY - canvas.getBoundingClientRect().top };
        delete activeTouches[touch.identifier];

        if (button1Shield.isPressed(pos)) {
            player1.deactivateShield();
        } else if (button2Shield.isPressed(pos)) {
            player2.deactivateShield();
        }

        if (pos.x < SCREEN_WIDTH / 2) {
            joystick1.dx = 0;
            joystick1.dy = 0;
        } else {
            joystick2.dx = 0;
            joystick2.dy = 0;
        }
    }
}, { passive: false });

// 游戏主循环
function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);

    deltaTime = (currentTime - lastTime) / 1000; // 转换为秒
    lastTime = currentTime;

    // 清空屏幕
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 绘制子弹的路线和爆炸效果
    ctx.drawImage(effectCanvas, 0, 0);

    // 绘制墙
    for (const wall of walls) {
        wall.draw();
    }

    // 处理键盘控制玩家旋转
    if (keysPressed['a']) player1.angle -= 0.1;
    if (keysPressed['d']) player1.angle += 0.1;
    if (keysPressed['ArrowLeft']) player2.angle -= 0.1;
    if (keysPressed['ArrowRight']) player2.angle += 0.1;

    if (!gameOver) {
        // 更新玩家朝向
        if (joystick1.dx !== 0 || joystick1.dy !== 0) {
            player1.rotate(Math.atan2(joystick1.dy, joystick1.dx));
        }
        if (joystick2.dx !== 0 || joystick2.dy !== 0) {
            player2.rotate(Math.atan2(joystick2.dy, joystick2.dx));
        }

        // 移动玩家
        player1.move(walls);
        player2.move(walls);
        player1.update(deltaTime);
        player2.update(deltaTime);

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
            if (player1.isShieldActive() && Math.hypot(bullet.x - player1.x, bullet.y - player1.y) < player1.shieldRadius) {
                bullet.explode(walls);
                bullets.splice(i, 1);
                player1.deactivateShield();
                player1.shieldCooldown = 1;
                continue;
            }
            if (player2.isShieldActive() && Math.hypot(bullet.x - player2.x, bullet.y - player2.y) < player2.shieldRadius) {
                bullet.explode(walls);
                bullets.splice(i, 1);
                player2.deactivateShield();
                player2.shieldCooldown = 1;
                continue;
            }

            // 忽略与发射者的碰撞
            if (bullet.owner === player1) {
                if (Math.hypot(bullet.x - player2.x, bullet.y - player2.y) < player2.size + bullet.radius) {
                    player2.health -= 10;
                    bullet.explode(walls);
                    bullets.splice(i, 1);
                    if (player2.health <= 0) {
                        gameOver = true;
                        winner = "Player 1";
                    }
                }
            } else if (bullet.owner === player2) {
                if (Math.hypot(bullet.x - player1.x, bullet.y - player1.y) < player1.size + bullet.radius) {
                    player1.health -= 10;
                    bullet.explode(walls);
                    bullets.splice(i, 1);
                    if (player1.health <= 0) {
                        gameOver = true;
                        winner = "Player 2";
                    }
                }
            }
        }
    }

    // 绘制玩家
    player1.draw();
    player2.draw();

    // 绘制子弹 (子弹轨迹在effectCanvas上)
    for (const bullet of bullets) {
        bullet.draw();
    }

    // 绘制摇杆和按钮
    const currentTimeInSeconds = Date.now() / 1000;
    const keyboardInactiveTime = (currentTimeInSeconds - lastKeyboardEventTime / 1000);
    
    if (showTouchControls || keyboardInactiveTime > HIDE_DELAY) {
        joystick1.draw();
        joystick2.draw();
        button1.draw();
        button2.draw();
        button1Shield.draw();
        button2Shield.draw();
    }

    // 绘制血量
    ctx.fillStyle = BLACK;
    ctx.font = '32px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`P1 Health: ${player1.health}`, 10, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`P2 Health: ${player2.health}`, SCREEN_WIDTH - 10, 30);

    // 游戏结束逻辑
    if (gameOver) {
        ctx.fillStyle = BLACK;
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${winner} Wins!`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20);
        restartButton.draw();
    }

    // 在绘制所有其他元素后调用
    drawStatus();
}

// 启动游戏
initGame();
requestAnimationFrame(gameLoop);
