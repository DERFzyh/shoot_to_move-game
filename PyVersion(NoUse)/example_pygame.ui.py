import pygame
import math
import time
import random

# 初始化pygame
pygame.init()

# 屏幕尺寸
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))

# 颜色
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)
BLUE = (0, 0, 255)
LIGHT_RED = (255, 100, 100)
LIGHT_BLUE = (100, 100, 255)
GRAY = (128, 128, 128)
DARK_GRAY = (64, 64, 64)
LIGHT_GRAY = (192, 192, 192)

# 字体
font = pygame.font.Font(None, 48)

# 游戏时钟
clock = pygame.time.Clock()

# 创建一个全局的Surface来记录子弹的路线和爆炸效果
effect_surface = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)

# 墙的尺寸
WALL_SIZE = 20

# 玩家类（三角形）
class Player:
    def __init__(self, x, y, color):
        self.x = x
        self.y = y
        self.color = color
        self.size = 15  # 三角形的大小
        self.angle = 0  # 初始角度
        self.health = 100
        self.speed_x = 0  # 水平速度
        self.speed_y = 0  # 垂直速度
        self.friction = 0.95  # 摩擦力
        self.shield_active = False
        self.shield_start_time = 0
        self.shield_duration = 5  # 将防护罩持续时间改为5秒
        self.shield_radius = 25  # 防护罩半径
        self.shield_remaining_time = 0  # 添加剩余时间属性
        self.shield_cooldown = 0  # 添加冷却时间属性
        self.shield_button_pressed = False  # 新增：记录按钮是否被按住

    def draw(self):
        # 计算三角形的三个顶点
        point1 = (self.x + math.cos(self.angle) * self.size,
                  self.y + math.sin(self.angle) * self.size)
        point2 = (self.x + math.cos(self.angle + 2 * math.pi / 3) * self.size,
                  self.y + math.sin(self.angle + 2 * math.pi / 3) * self.size)
        point3 = (self.x + math.cos(self.angle + 4 * math.pi / 3) * self.size,
                  self.y + math.sin(self.angle + 4 * math.pi / 3) * self.size)
        pygame.draw.polygon(screen, self.color, [point1, point2, point3])

        # 在三角形顶部添加绿色方向指示
        direction_point = (self.x + math.cos(self.angle) * (self.size + 5),
                          self.y + math.sin(self.angle) * (self.size + 5))
        pygame.draw.circle(screen, (0, 255, 0), (int(direction_point[0]), int(direction_point[1])), 3)

        # 绘制防护罩
        if self.is_shield_active():
            elapsed_time = time.time() - self.shield_start_time
            shield_alpha = min(255, int(255 * (1 - elapsed_time / self.shield_duration)))
            shield_surface = pygame.Surface((self.shield_radius * 2, self.shield_radius * 2), pygame.SRCALPHA)
            shield_color = (*self.color, shield_alpha)
            pygame.draw.circle(shield_surface, shield_color, 
                             (self.shield_radius, self.shield_radius), self.shield_radius, 2)
            screen.blit(shield_surface, (self.x - self.shield_radius, self.y - self.shield_radius))

    def rotate(self, angle):
        self.angle = angle

    def move(self, walls):
        # 更新位置
        new_x = self.x + self.speed_x
        new_y = self.y + self.speed_y

        # 检测与墙的碰撞
        collision = False
        for wall in walls:
            if (wall.x <= new_x <= wall.x + WALL_SIZE and
                wall.y <= new_y <= wall.y + WALL_SIZE):
                if wall.wall_type == 1 or wall.wall_type == 3:
                    collision = True
                elif wall.wall_type == 2:
                    if (self.color == BLUE and wall.color in [LIGHT_RED, WHITE]) or \
                       (self.color == RED and wall.color in [LIGHT_BLUE, WHITE]):
                        collision = True
        if not collision:
            self.x = new_x
            self.y = new_y

        # 应用摩擦力
        self.speed_x *= self.friction
        self.speed_y *= self.friction

        # 边界检测
        if self.x < 0:
            self.x = 0
        elif self.x > SCREEN_WIDTH:
            self.x = SCREEN_WIDTH
        if self.y < 0:
            self.y = 0
        elif self.y > SCREEN_HEIGHT:
            self.y = SCREEN_HEIGHT

    def push_back(self, force, angle):
        # 向指定方向推进
        self.speed_x += math.cos(angle) * force
        self.speed_y += math.sin(angle) * force

    def activate_shield(self):
        if not self.shield_active and self.shield_cooldown <= 0:
            self.shield_active = True
            self.shield_button_pressed = True  # 设置按钮为按下状态
            if self.shield_remaining_time <= 0:
                self.shield_start_time = time.time()
            else:
                self.shield_start_time = time.time() - (self.shield_duration - self.shield_remaining_time)

    def deactivate_shield(self):
        if self.shield_active:
            self.shield_active = False
            self.shield_button_pressed = False  # 设置按钮为松开状态
            self.shield_remaining_time = max(0, self.shield_duration - (time.time() - self.shield_start_time))

    def is_shield_active(self):
        if not self.shield_active or not self.shield_button_pressed:  # 增加按钮状态检查
            return False
        elapsed_time = time.time() - self.shield_start_time
        if elapsed_time >= self.shield_duration:
            self.deactivate_shield()
            self.shield_cooldown = 1
            return False
        return True

    def update(self, dt):
        # 更新冷却时间
        if self.shield_cooldown > 0:
            self.shield_cooldown -= dt

# 子弹类
class Bullet:
    def __init__(self, x, y, angle, color, owner):
        self.x = x
        self.y = y
        self.angle = angle
        self.speed = 10
        self.radius = 5
        self.color = color
        self.trail_color = LIGHT_BLUE if color == BLUE else LIGHT_RED
        self.creation_time = time.time()  # 子弹创建时间
        self.trail = [(x, y)]  # 子弹的行进路线
        self.active = True  # 子弹是否活跃
        self.owner = owner  # 子弹的发射者

    def move(self, walls):
        if self.active:
            new_x = self.x + math.cos(self.angle) * self.speed
            new_y = self.y + math.sin(self.angle) * self.speed

            # 检测与墙的碰撞
            collision = False
            for wall in walls:
                if (wall.x <= new_x <= wall.x + WALL_SIZE and
                    wall.y <= new_y <= wall.y + WALL_SIZE):
                    if wall.wall_type == 1:
                        collision = True
                    elif wall.wall_type == 2:
                        if (self.color == BLUE and wall.color in [LIGHT_RED, WHITE]) or \
                           (self.color == RED and wall.color in [LIGHT_BLUE, WHITE]):
                            collision = True
                    elif wall.wall_type == 3:
                        # 计算碰撞点
                        collision_point = (wall.x + WALL_SIZE // 2, wall.y + WALL_SIZE // 2)
                        # 计算入射角
                        incident_angle = self.angle
                        # 计算墙的法线角度
                        wall_normal = math.atan2(new_y - collision_point[1], new_x - collision_point[0])
                        # 计算反射角
                        reflection_angle = 2 * wall_normal - incident_angle
                        # 更新子弹的角度
                        self.angle = reflection_angle
                        return  # 反弹后直接返回，不更新位置
            if collision:
                self.explode(walls)
                self.active = False
            else:
                self.x = new_x
                self.y = new_y
                self.trail.append((int(self.x), int(self.y)))  # 记录子弹的行进路线

    def draw(self):
        if self.active:
            # 绘制子弹的行进路线
            if len(self.trail) >= 2:
                pygame.draw.lines(effect_surface, self.trail_color, False, self.trail, self.radius * 2)
            # 绘制子弹
            pygame.draw.circle(screen, self.color, (int(self.x), int(self.y)), self.radius)

    def is_active(self):
        # 子弹射出后前0.2秒不判定击中
        return time.time() - self.creation_time >= 0.2

    def explode(self, walls):
        # 子弹消失时绘制一个圆形区域
        pygame.draw.circle(effect_surface, self.trail_color, (int(self.x), int(self.y)), 30)
        # 将距离25以内的墙2变为同色
        for wall in walls:
            if wall.wall_type == 2:
                distance = math.hypot(wall.x + WALL_SIZE // 2 - self.x, wall.y + WALL_SIZE // 2 - self.y)
                if distance <= 25:
                    wall.color = self.trail_color

# 墙类
class Wall:
    def __init__(self, x, y, wall_type):
        self.x = x
        self.y = y
        self.wall_type = wall_type
        self.color = WHITE if wall_type == 2 else None

    def draw(self):
        if self.wall_type == 1:
            pygame.draw.rect(screen, GRAY, (self.x, self.y, WALL_SIZE, WALL_SIZE))
            pygame.draw.rect(screen, DARK_GRAY, (self.x, self.y, WALL_SIZE, WALL_SIZE), 2)
        elif self.wall_type == 2:
            pygame.draw.rect(screen, self.color, (self.x, self.y, WALL_SIZE, WALL_SIZE))
            pygame.draw.rect(screen, LIGHT_GRAY, (self.x, self.y, WALL_SIZE, WALL_SIZE), 2)
        elif self.wall_type == 3:
            pygame.draw.rect(screen, LIGHT_GRAY, (self.x, self.y, WALL_SIZE, WALL_SIZE))
            pygame.draw.rect(screen, WHITE, (self.x, self.y, WALL_SIZE, WALL_SIZE), 2)

# 虚拟摇杆类
class Joystick:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = 30  # 减小摇杆的判定范围
        self.inner_radius = 15
        self.dx = 0
        self.dy = 0

    def draw(self):
        pygame.draw.circle(screen, BLACK, (self.x, self.y), self.radius, 2)
        pygame.draw.circle(screen, BLACK, (self.x + self.dx * self.radius, self.y + self.dy * self.radius), self.inner_radius)

    def update(self, pos):
        dx = pos[0] - self.x
        dy = pos[1] - self.y
        distance = math.hypot(dx, dy)
        if distance > self.radius:
            dx = dx * self.radius / distance
            dy = dy * self.radius / distance
        self.dx = dx / self.radius
        self.dy = dy / self.radius

# 触控按钮类
class Button:
    def __init__(self, x, y, width, height, text):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text

    def draw(self):
        pygame.draw.rect(screen, BLACK, self.rect, 2)
        text_surface = font.render(self.text, True, BLACK)
        text_rect = text_surface.get_rect(center=self.rect.center)
        screen.blit(text_surface, text_rect)

    def is_pressed(self, pos):
        return self.rect.collidepoint(pos)

# 生成随机地图
def generate_map():
    walls = []
    # 地图边缘固定为墙1
    for x in range(0, SCREEN_WIDTH, WALL_SIZE):
        walls.append(Wall(x, 0, 1))
        walls.append(Wall(x, SCREEN_HEIGHT - WALL_SIZE, 1))
    for y in range(WALL_SIZE, SCREEN_HEIGHT - WALL_SIZE, WALL_SIZE):
        walls.append(Wall(0, y, 1))
        walls.append(Wall(SCREEN_WIDTH - WALL_SIZE, y, 1))

    # 初始化迷宫网格
    grid_width = (SCREEN_WIDTH // WALL_SIZE) - 2
    grid_height = (SCREEN_HEIGHT // WALL_SIZE) - 2
    grid = [[1 for _ in range(grid_width)] for _ in range(grid_height)]

    # 修改后的DFS函数
    def dfs(x, y):
        # 添加边界检查
        if x < 0 or x >= grid_width or y < 0 or y >= grid_height:
            return
            
        grid[y][x] = 0  # 标记为通路
        # 同时标记相邻的3个单元格为通路
        if x + 1 < grid_width:
            grid[y][x + 1] = 0
        if y + 1 < grid_height:
            grid[y + 1][x] = 0
        if x + 1 < grid_width and y + 1 < grid_height:
            grid[y + 1][x + 1] = 0

        directions = [(0, 3), (3, 0), (0, -3), (-3, 0)]  # 将步长改为3
        random.shuffle(directions)
        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if 0 <= nx < grid_width and 0 <= ny < grid_height and grid[ny][nx] == 1:
                # 打通中间的墙，保持2个单元格的间隔
                mid_x = x + dx // 3
                mid_y = y + dy // 3
                if 0 <= mid_x < grid_width and 0 <= mid_y < grid_height:
                    grid[mid_y][mid_x] = 0
                    if mid_x + 1 < grid_width:
                        grid[mid_y][mid_x + 1] = 0
                    if mid_y + 1 < grid_height:
                        grid[mid_y + 1][mid_x] = 0
                    if mid_x + 1 < grid_width and mid_y + 1 < grid_height:
                        grid[mid_y + 1][mid_x + 1] = 0
                dfs(nx, ny)

    # 从随机起点开始生成迷宫
    start_x = random.randint(0, (grid_width - 1) // 2) * 2
    start_y = random.randint(0, (grid_height - 1) // 2) * 2
    dfs(start_x, start_y)

    # 将迷宫网格转换为墙，并随机分配墙的类型
    for y in range(grid_height):
        for x in range(grid_width):
            if grid[y][x] == 1:
                # 随机选择墙的类型
                wall_type = random.choices([1, 2, 3], weights=[1, 3, 1])[0]
                walls.append(Wall((x + 1) * WALL_SIZE, (y + 1) * WALL_SIZE, wall_type))

    # 减少死胡同的数量
    for y in range(1, grid_height - 1):
        for x in range(1, grid_width - 1):
            if grid[y][x] == 0:
                # 检查当前点是否是死胡同
                neighbors = [
                    grid[y - 1][x],  # 上
                    grid[y + 1][x],  # 下
                    grid[y][x - 1],  # 左
                    grid[y][x + 1],  # 右
                ]
                if neighbors.count(1) >= 3:  # 如果当前点有3面是墙，则打通一个方向
                    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
                    random.shuffle(directions)
                    for dx, dy in directions:
                        nx, ny = x + dx, y + dy
                        if grid[ny][nx] == 1:
                            grid[ny][nx] = 0
                            # 移除对应的墙
                            for wall in walls[:]:
                                if wall.x == (nx + 1) * WALL_SIZE and wall.y == (ny + 1) * WALL_SIZE:
                                    walls.remove(wall)
                            break

    # 随机打通30处不在边缘的墙
    for _ in range(30):
        # 获取所有不在边缘的墙
        non_edge_walls = [wall for wall in walls 
                         if wall.x > WALL_SIZE and wall.x < SCREEN_WIDTH - WALL_SIZE * 2
                         and wall.y > WALL_SIZE and wall.y < SCREEN_HEIGHT - WALL_SIZE * 2]
        
        # 筛选出在上下两侧或左右两侧都没有墙的墙
        removable_walls = []
        for wall in non_edge_walls:
            # 找到对应的网格坐标
            grid_x = (wall.x // WALL_SIZE) - 1
            grid_y = (wall.y // WALL_SIZE) - 1
            
            # 检查上下两侧是否有墙
            has_wall_above = grid[grid_y - 1][grid_x] == 1 if grid_y - 1 >= 0 else False
            has_wall_below = grid[grid_y + 1][grid_x] == 1 if grid_y + 1 < grid_height else False
            
            # 检查左右两侧是否有墙
            has_wall_left = grid[grid_y][grid_x - 1] == 1 if grid_x - 1 >= 0 else False
            has_wall_right = grid[grid_y][grid_x + 1] == 1 if grid_x + 1 < grid_width else False
            
            # 如果上下两侧或左右两侧都没有墙，则加入可移除列表
            if not (has_wall_above or has_wall_below) or not (has_wall_left or has_wall_right):
                removable_walls.append(wall)
        
        # 随机选择一个符合条件的墙
        if removable_walls:  # 确保列表不为空
            wall_to_remove = random.choice(removable_walls)
            # 找到对应的网格坐标
            grid_x = (wall_to_remove.x // WALL_SIZE) - 1
            grid_y = (wall_to_remove.y // WALL_SIZE) - 1
            
            # 移除选中的墙
            for dx in range(2):
                for dy in range(2):
                    if 0 <= grid_x + dx < grid_width and 0 <= grid_y + dy < grid_height:
                        grid[grid_y + dy][grid_x + dx] = 0
            walls.remove(wall_to_remove)
            
            # 查找并移除紧贴的另一堵符合条件的墙
            # 检查上下方向
            if not (has_wall_above or has_wall_below):
                # 检查上方
                if grid_y - 1 >= 0 and grid[grid_y - 1][grid_x] == 1:
                    adjacent_wall = next((w for w in walls if w.x == wall_to_remove.x and w.y == wall_to_remove.y - WALL_SIZE), None)
                    if adjacent_wall:
                        for dx in range(2):
                            if 0 <= grid_x + dx < grid_width:
                                grid[grid_y - 1][grid_x + dx] = 0
                        walls.remove(adjacent_wall)
                # 检查下方
                elif grid_y + 1 < grid_height and grid[grid_y + 1][grid_x] == 1:
                    adjacent_wall = next((w for w in walls if w.x == wall_to_remove.x and w.y == wall_to_remove.y + WALL_SIZE), None)
                    if adjacent_wall:
                        for dx in range(2):
                            if 0 <= grid_x + dx < grid_width:
                                grid[grid_y + 1][grid_x + dx] = 0
                        walls.remove(adjacent_wall)
            
            # 检查左右方向
            elif not (has_wall_left or has_wall_right):
                # 检查左侧
                if grid_x - 1 >= 0 and grid[grid_y][grid_x - 1] == 1:
                    adjacent_wall = next((w for w in walls if w.x == wall_to_remove.x - WALL_SIZE and w.y == wall_to_remove.y), None)
                    if adjacent_wall:
                        for dy in range(2):
                            if 0 <= grid_y + dy < grid_height:
                                grid[grid_y + dy][grid_x - 1] = 0
                        walls.remove(adjacent_wall)
                # 检查右侧
                elif grid_x + 1 < grid_width and grid[grid_y][grid_x + 1] == 1:
                    adjacent_wall = next((w for w in walls if w.x == wall_to_remove.x + WALL_SIZE and w.y == wall_to_remove.y), None)
                    if adjacent_wall:
                        for dy in range(2):
                            if 0 <= grid_y + dy < grid_height:
                                grid[grid_y + dy][grid_x + 1] = 0
                        walls.remove(adjacent_wall)

    # 将所有不在边缘的墙变为type2
    for wall in walls:
        if wall.x > WALL_SIZE and wall.x < SCREEN_WIDTH - WALL_SIZE * 2 and \
           wall.y > WALL_SIZE and wall.y < SCREEN_HEIGHT - WALL_SIZE * 2:
            wall.wall_type = 2
            wall.color = WHITE  # 确保颜色也更新为type2的颜色

    return walls



# 检测是否有触摸屏
has_touchscreen = pygame.display.get_num_displays() > 0 and pygame.display.get_driver() == 'android'

# 初始化玩家、摇杆和按钮
player1 = Player(SCREEN_WIDTH // 4, SCREEN_HEIGHT // 2, BLUE)
player2 = Player(3 * SCREEN_WIDTH // 4, SCREEN_HEIGHT // 2, RED)

# 调整摇杆和按钮位置
# 左侧：从上到下 - 摇杆、射击、防护罩
joystick1 = Joystick(100, 150)  # 上移
button1 = Button(50, 250, 100, 50, "Shoot")  # 射击按钮
button1_shield = Button(50, 350, 100, 50, "Shield")  # 防护罩按钮

# 右侧：从下到上 - 摇杆、射击、防护罩
joystick2 = Joystick(SCREEN_WIDTH - 100, SCREEN_HEIGHT - 150)  # 下移
button2 = Button(SCREEN_WIDTH - 150, SCREEN_HEIGHT - 250, 100, 50, "Shoot")  # 射击按钮
button2_shield = Button(SCREEN_WIDTH - 150, SCREEN_HEIGHT - 350, 100, 50, "Shield")  # 防护罩按钮

restart_button = Button(SCREEN_WIDTH // 2 - 50, SCREEN_HEIGHT // 2 + 50, 100, 50, "Restart")

bullets = []
walls = generate_map()
game_over = False
winner = None

# 重置游戏状态
def reset_game():
    global player1, player2, bullets, game_over, winner, effect_surface, walls
    player1 = Player(SCREEN_WIDTH // 4, SCREEN_HEIGHT // 2, BLUE)
    player2 = Player(3 * SCREEN_WIDTH // 4, SCREEN_HEIGHT // 2, RED)
    bullets = []
    walls = generate_map()
    game_over = False
    winner = None
    effect_surface = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)

def draw_status():
    # 使用更小的字体
    status_font = pygame.font.Font(None, 32)
    
    # 玩家1状态
    if player1.shield_active:
        remaining_time = max(0, player1.shield_duration - (time.time() - player1.shield_start_time))
        status_text1 = f"P1 Shield: {remaining_time:.1f}s"
    elif player1.shield_cooldown > 0:
        status_text1 = f"P1 Shield CD: {player1.shield_cooldown:.1f}s"
    else:
        status_text1 = "P1 Shield Ready"
    
    # 玩家2状态
    if player2.shield_active:
        remaining_time = max(0, player2.shield_duration - (time.time() - player2.shield_start_time))
        status_text2 = f"P2 Shield: {remaining_time:.1f}s"
    elif player2.shield_cooldown > 0:
        status_text2 = f"P2 Shield CD: {player2.shield_cooldown:.1f}s"
    else:
        status_text2 = "P2 Shield Ready"
    
    # 绘制玩家1状态（去除背景框）
    text_surface1 = status_font.render(status_text1, True, BLUE)
    screen.blit(text_surface1, (10, 50))
    
    # 绘制玩家2状态（去除背景框）
    text_surface2 = status_font.render(status_text2, True, RED)
    screen.blit(text_surface2, (SCREEN_WIDTH - text_surface2.get_width() - 10, 50))

# 修改全局变量
show_touch_controls = True  # 默认显示按钮
last_keyboard_event_time = 0  # 记录最后一次键盘事件的时间
HIDE_DELAY = 5  # 键盘事件后隐藏按钮的延迟时间（秒）

# 游戏主循环
running = True
while running:
    screen.fill(WHITE)

    # 绘制子弹的路线和爆炸效果
    screen.blit(effect_surface, (0, 0))

    # 绘制墙
    for wall in walls:
        wall.draw()

    # 处理事件
    keys = pygame.key.get_pressed()  # 获取当前按下的键
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.FINGERDOWN:  # 移除has_touchscreen判断
            pos = (int(event.x * SCREEN_WIDTH), int(event.y * SCREEN_HEIGHT))
            if game_over:
                if restart_button.is_pressed(pos):
                    reset_game()
            else:
                if button1.is_pressed(pos):
                    bullets.append(Bullet(player1.x, player1.y, player1.angle + math.pi, BLUE, player1))
                    player1.push_back(2, player1.angle)
                elif button2.is_pressed(pos):
                    bullets.append(Bullet(player2.x, player2.y, player2.angle + math.pi, RED, player2))
                    player2.push_back(2, player2.angle)
                elif button1_shield.is_pressed(pos):
                    player1.activate_shield()
                elif button2_shield.is_pressed(pos):
                    player2.activate_shield()
                else:
                    if pos[0] < SCREEN_WIDTH // 2:
                        joystick1.update(pos)
                    else:
                        joystick2.update(pos)
        elif event.type == pygame.FINGERMOTION:  # 移除has_touchscreen判断
            pos = (int(event.x * SCREEN_WIDTH), int(event.y * SCREEN_HEIGHT))
            if not game_over:
                if pos[0] < SCREEN_WIDTH // 2:
                    joystick1.update(pos)
                else:
                    joystick2.update(pos)
        elif event.type == pygame.FINGERUP:  # 移除has_touchscreen判断
            pos = (int(event.x * SCREEN_WIDTH), int(event.y * SCREEN_HEIGHT))
            if button1_shield.is_pressed(pos):
                player1.deactivate_shield()  # 玩家1松开防护罩
            elif button2_shield.is_pressed(pos):
                player2.deactivate_shield()  # 玩家2松开防护罩
            
            if event.x * SCREEN_WIDTH < SCREEN_WIDTH // 2:
                joystick1.dx = 0
                joystick1.dy = 0
                
            else:
                joystick2.dx = 0
                joystick2.dy = 0
        elif event.type == pygame.KEYUP:
            if event.key == pygame.K_s:  
                player1.deactivate_shield()
            elif event.key == pygame.K_RSHIFT or event.key == pygame.K_LSHIFT:  
                # 松开按钮时关闭防护罩
                player2.deactivate_shield()     
                 
        elif event.type == pygame.KEYDOWN:
            last_keyboard_event_time = time.time()
            if event.key == pygame.K_w and not player1.is_shield_active():
                bullets.append(Bullet(player1.x, player1.y, player1.angle + math.pi, BLUE, player1))
                player1.push_back(2, player1.angle)
            elif event.key == pygame.K_SPACE and not player2.is_shield_active():
                bullets.append(Bullet(player2.x, player2.y, player2.angle + math.pi, RED, player2))
                player2.push_back(2, player2.angle)
            elif event.key == pygame.K_t:
                show_touch_controls = not show_touch_controls
            elif event.key == pygame.K_s:  # 玩家1激活防护罩
                player1.activate_shield()

            elif event.key == pygame.K_RSHIFT or event.key == pygame.K_LSHIFT:  # 玩家2激活防护罩
                player2.activate_shield()

    # 键盘控制玩家移动
    if keys[pygame.K_a]:  # 玩家1左转
        player1.angle -= 0.1
    if keys[pygame.K_d]:  # 玩家1右转
        player1.angle += 0.1
    if keys[pygame.K_LEFT]:  # 玩家2左转
        player2.angle -= 0.1
    if keys[pygame.K_RIGHT]:  # 玩家2右转
        player2.angle += 0.1

    if not game_over:
        # 更新玩家朝向
        if joystick1 and (joystick1.dx != 0 or joystick1.dy != 0):
            player1.rotate(math.atan2(joystick1.dy, joystick1.dx))
        if joystick2 and (joystick2.dx != 0 or joystick2.dy != 0):
            player2.rotate(math.atan2(joystick2.dy, joystick2.dx))

        # 移动玩家
        player1.move(walls)
        player2.move(walls)

        # 移动子弹
        for bullet in bullets:
            bullet.move(walls)

        # 检测子弹与玩家的碰撞
        for bullet in bullets[:]:
            if bullet.is_active():  # 子弹射出后前0.2秒不判定击中
                # 检测防护罩
                if player1.is_shield_active() and math.hypot(bullet.x - player1.x, bullet.y - player1.y) < player1.shield_radius:
                    bullet.explode(walls)
                    bullets.remove(bullet)
                    player1.deactivate_shield()
                    player1.shield_cooldown = 1  # 被击碎时开始冷却
                    continue
                if player2.is_shield_active() and math.hypot(bullet.x - player2.x, bullet.y - player2.y) < player2.shield_radius:
                    bullet.explode(walls)
                    bullets.remove(bullet)
                    player2.deactivate_shield()
                    player2.shield_cooldown = 1  # 被击碎时开始冷却
                    continue
                # 忽略与发射者的碰撞
                if bullet.owner == player1:
                    if math.hypot(bullet.x - player2.x, bullet.y - player2.y) < player2.size + bullet.radius:
                        player2.health -= 10
                        bullet.explode(walls)  # 子弹消失时绘制圆形区域
                        bullets.remove(bullet)
                        if player2.health <= 0:
                            game_over = True
                            winner = "Player 1"
                elif bullet.owner == player2:
                    if math.hypot(bullet.x - player1.x, bullet.y - player1.y) < player1.size + bullet.radius:
                        player1.health -= 10
                        bullet.explode(walls)  # 子弹消失时绘制圆形区域
                        bullets.remove(bullet)
                        if player1.health <= 0:
                            game_over = True
                            winner = "Player 2"

        # 移除屏幕外的子弹
        for bullet in bullets[:]:
            if bullet.x < 0 or bullet.x > SCREEN_WIDTH or bullet.y < 0 or bullet.y > SCREEN_HEIGHT:
                bullet.explode(walls)  # 子弹消失时绘制圆形区域
                bullets.remove(bullet)

    # 绘制玩家
    player1.draw()
    player2.draw()

    # 绘制子弹
    for bullet in bullets:
        bullet.draw()

    # 绘制摇杆
    if show_touch_controls:
        joystick1.draw()
        joystick2.draw()
        button1.draw()
        button2.draw()
        button1_shield.draw()
        button2_shield.draw()

    # 绘制血量
    health_text = font.render(f"P1 Health: {player1.health}", True, BLACK)
    screen.blit(health_text, (10, 10))
    health_text = font.render(f"P2 Health: {player2.health}", True, BLACK)
    screen.blit(health_text, (SCREEN_WIDTH - 150, 10))

    # 游戏结束逻辑
    if game_over:
        # 显示胜利信息
        winner_text = font.render(f"{winner} Wins!", True, BLACK)
        screen.blit(winner_text, (SCREEN_WIDTH // 2 - 70, SCREEN_HEIGHT // 2 - 20))
        # 显示重启按钮
        restart_button.draw()

    # 在绘制所有其他元素后调用
    draw_status()
    
    # 更新屏幕
    pygame.display.flip()

    # 控制帧率
    clock.tick(30)



    # 在主循环中添加时间计算
    dt = clock.tick(60) / 1000  # 获取每帧的时间（秒）

    # 更新玩家状态
    player1.update(dt)
    player2.update(dt)

    # 在主循环中添加判断逻辑
    current_time = time.time()
    #print(f"current_time = {current_time} last_keyboard_event_time = {last_keyboard_event_time} HIDE_DELAY = {HIDE_DELAY} show_touch_controls = {show_touch_controls}")
    if current_time - last_keyboard_event_time < HIDE_DELAY :
        show_touch_controls = False
        #print("show_touch_controls = False")
    else:
        show_touch_controls = True

# 退出游戏
pygame.quit()