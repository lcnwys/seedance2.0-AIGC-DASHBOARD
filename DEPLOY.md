# Seedance 2.0 Wan 2.7 AIGC Dashboard 部署文档

## 1. 适用版本

本部署文档对应 `Seedance 2.0 Wan 2.7 AIGC Dashboard` 开源版分支。

开源版特点：

- 聚焦图片 / 视频创作主流程
- 接入火山引擎 + 阿里云两家模型厂商
- 保留团队维度 API Key 配置
- 不在主交互里提供主体库 / 故事板能力

## 2. 环境要求

- Node.js 18.17+，推荐 Node.js 20
- npm 9+
- 内存 1GB 起步，推荐 2GB+
- 磁盘 5GB+

## 3. 必备环境变量

先复制：

```bash
cp .env.example .env
```

至少补齐这些字段：

```bash
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-with-a-long-random-secret"
ENCRYPTION_KEY="replace-with-a-stable-secret-used-for-team-api-key-encryption"

APP_PUBLIC_BASE_URL="https://your-domain.com"
TASK_WEBHOOK_SECRET="replace-with-a-random-webhook-secret"

TOS_ACCESS_KEY_ID=""
TOS_ACCESS_KEY_SECRET=""
TOS_REGION=""
TOS_BUCKET=""
TOS_ENDPOINT=""
TOS_PUBLIC_BASE_URL=""

OSS_ACCESS_KEY_ID=""
OSS_ACCESS_KEY_SECRET=""
OSS_REGION=""
OSS_BUCKET=""
OSS_ENDPOINT=""
OSS_PUBLIC_BASE_URL=""

REMOTE_ASSET_MAX_BYTES="5368709120"

DEFAULT_SUPER_ADMIN_EMAIL="admin@example.com"
DEFAULT_SUPER_ADMIN_PASSWORD="replace-with-your-own-strong-password"
DEFAULT_SUPER_ADMIN_NAME="系统管理员"
DEFAULT_TEAM_INITIAL_BUDGET_YUAN=""
```

说明：

- 团队 API Key 不建议写到全局环境变量里。
- 用户登录后台后，可按团队分别配置火山 / 阿里云 API Key。
- `APP_PUBLIC_BASE_URL` 用于回调地址和公开访问地址推导，生产环境建议填写完整域名。
- `JWT_SECRET`、`ENCRYPTION_KEY`、`TASK_WEBHOOK_SECRET` 都应由你自己生成并长期稳定保存。
- 只有在你明确填写 `DEFAULT_SUPER_ADMIN_EMAIL` 和 `DEFAULT_SUPER_ADMIN_PASSWORD` 后，系统才会自动创建首个超级管理员账号。
- `DEFAULT_TEAM_INITIAL_BUDGET_YUAN` 可选，用来给新注册团队初始化一笔预算；填写后，注册人会自动拿到同等可用额度。
- 如果旧版本已经用默认逻辑加密过团队 API Key，请在升级时把 `ENCRYPTION_KEY` 设置成旧环境里的同一个值。

## 4. 本地开发

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

启动后访问 `http://localhost:3000`（dev 模式默认端口）。

生产环境构建后使用 `npm start` 启动，端口为 `8080`。

如果你是项目维护者，后续继续改 Prisma schema 时，建议使用：

```bash
npx prisma migrate dev --name your_change_name
```

## 5. 宝塔面板部署

### 5.1 上传代码

```bash
cd /www/wwwroot
git clone <your-repo-url> seedance2.0-wan2.7-AIGC-Dashboard
cd seedance2.0-wan2.7-AIGC-Dashboard
```

### 5.2 安装依赖并构建

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

### 5.3 PM2 启动

```bash
pm2 start npm --name seedance2-wan27-dashboard -- start
pm2 save
```

### 5.4 Nginx 反向代理

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

上传文件较大时，建议额外配置：

```nginx
client_max_body_size 100M;
```

## 6. 常规 Linux 服务器部署

### 6.1 安装运行环境

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
npm install -g pm2
```

### 6.2 拉取代码并初始化

```bash
mkdir -p /opt/seedance2-wan27-dashboard
cd /opt/seedance2-wan27-dashboard
git clone <your-repo-url> .

npm install
npx prisma generate
npx prisma migrate deploy
npm run build
```

### 6.3 PM2 配置

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'seedance2-wan27-dashboard',
    script: 'npm',
    args: 'start',
    cwd: '/opt/seedance2-wan27-dashboard',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    }
  }]
}
EOF

pm2 start ecosystem.config.js
pm2 save
```

### 6.4 Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3000s;
    }
}
```

## 7. 首次部署后的后台配置

启动完成后，建议按这个顺序操作：

1. 先在 `.env` 里显式填写 `DEFAULT_SUPER_ADMIN_EMAIL` 和 `DEFAULT_SUPER_ADMIN_PASSWORD`
2. 启动系统后，用这组你自己配置的账号登录
3. 进入后台后确认系统管理员权限正常
4. 注册或创建你的正式团队管理员账号
5. 打开设置页，配置火山引擎 / 阿里云 API Key 与对象存储
6. 验证图片 / 视频生成链路
7. 验证对象存储上传（TOS 或 OSS）、任务刷新、统计页面是否正常

## 8. 端口与回调建议

### 端口说明

- 默认启动端口：`8080`
- 本地开发访问：`http://localhost:8080`
- 生产环境请在 Nginx 反向代理中配置 `8080` 端口

### 回调与轮询建议

项目已兼容”回调 + 轮询补偿”的思路，但你仍应遵循：

- 本地开发优先轮询
- 生产环境优先回调
- 回调失败时允许手动刷新和定时同步
- 有公网域名时优先使用完整域名

## 9. 数据库

默认使用 SQLite，数据库文件位于根目录：

```text
./dev.db
```

适合：

- 单机部署
- 演示版
- 小团队内部使用

如果后续要做：

- 多团队高并发
- 更复杂计费
- 企业级 SaaS

建议迁移到 PostgreSQL。

## 10. 发布到 GitHub 前建议

### 建议保留

- README
- DEPLOY
- LICENSE
- `.env.example`

### 建议自行替换

- 仓库名
- 首页文案
- 演示地址
- 联系方式
- 商务支持描述

### 建议公开前确认

- `.env` 没有被提交
- 没有真实 API Key
- 没有真实私有回调地址
- 没有示例超级管理员密码沿用到线上
- README 中联系方式是你希望公开的内容

## 11. 更新部署

```bash
git pull
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart seedance2-wan27-dashboard
```
