# Aether Signing Keys

本目录存放 Aether 桌面端自动更新的 ed25519 签名密钥，**不得提交到 git**。

## 文件命名

| 文件 | 说明 |
|------|------|
| `aether.key` | 私钥（本地打包签名用） |
| `aether.key.pub` | 公钥（注入客户端校验更新包） |

后续新增工具请在其项目内使用相同约定：`signing/<app-slug>.key`。

## 首次生成

```powershell
npx tauri signer generate -w "signing/aether.key"
```

## 从旧路径迁移

```powershell
scripts\migrate-signing.ps1
```

默认从 `%USERPROFILE%\.tauri\aether.key*` 复制到本目录。

## `.env` 配置

```env
AETHER_SIGNING_PRIVATE_KEY_PATH=signing/aether.key
AETHER_SIGNING_PUBLIC_KEY_PATH=signing/aether.key.pub
AETHER_SIGNING_PRIVATE_KEY_PASSWORD=<your-password>
AETHER_UPDATER_ENDPOINT=https://github.com/xtc002007/Aether/releases/latest/download/latest.json
```

公钥也可不写进 `.env`，构建脚本会自动读取 `signing/aether.key.pub`。

## CI / GitHub Secrets

| Secret | 说明 |
|--------|------|
| `AETHER_SIGNING_PRIVATE_KEY` | 私钥文件全文 |
| `AETHER_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码 |
| `AETHER_UPDATER_PUBLIC_KEY` | 公钥文件全文 |
