# Tauri 桌面应用打包与自动更新系统实现文档

> 参考 [Markra](https://github.com/murongg/markra) 项目的架构设计，基于 Tauri 2.x 实现 Windows 平台安装包生成与自动更新。

---

## 1. 系统架构

```
┌─ React UI ──────────────────────────────┐
│  useAutoUpdater.ts → 6h 周期检查/下载    │
│  App.tsx → 头部更新状态指示器             │
└────────────────┬────────────────────────┘
                 │
┌─ TypeScript Runtime ────────────────────┐
│  updater.ts → 封装 @tauri-apps/plugin   │
│  代理回退(Clash/V2Ray 5个端口) → 直连   │
└────────────────┬────────────────────────┘
                 │
┌─ Rust 原生层 ───────────────────────────┐
│  tauri-plugin-updater → 下载/ed25519    │
│  验签/安装(installMode: passive)         │
└─────────────────────────────────────────┘
```

## 2. Rust 后端配置

### 2.1 Cargo.toml 添加依赖

```toml
[dependencies]
tauri-plugin-process = "2"
tauri-plugin-updater = "2"
```

### 2.2 main.rs 注册插件

```rust
.plugin(tauri_plugin_process::init())
.plugin(tauri_plugin_updater::Builder::new().build())
```

### 2.3 capabilities 添加权限

```json
{
  "permissions": [
    "process:allow-restart",
    "updater:default"
  ]
}
```

## 3. 前端更新逻辑

### 3.1 npm 依赖

```json
"@tauri-apps/plugin-updater": "^2.10.1"
"@tauri-apps/plugin-process": "^2.3.1"
```

### 3.2 updater.ts — 核心更新引擎

封装 `@tauri-apps/plugin-updater` 的 `check()` 和 `downloadAndInstall()` API，提供代理回退机制：

```typescript
const localUpdaterProxyUrls = [
  "http://127.0.0.1:7890",  // Clash
  "http://127.0.0.1:7897",  // Clash Verge
  "http://127.0.0.1:1087",  // V2Ray
  "http://127.0.0.1:10809", // Clash Meta
  "http://127.0.0.1:6152"   // Other
];

async function checkWithLocalProxyFallback() {
  for (const proxy of localUpdaterProxyUrls) {
    try { return await check({ proxy }); } catch {}
  }
  return check(); // 直连
}
```

返回 `NativeAppUpdate` 对象，包含 `downloadAndInstall(callbacks)`（带进度回调）和 `restart()`（调用 `relaunch()`）。

### 3.3 useAutoUpdater.ts — React Hook

```typescript
function useAutoUpdater(enabled = true, options = {}) {
  // 状态: updateAvailable, checking, downloading, readyToRestart, error
  // 启动时立即检查 → 每6小时自动检查 → 静默下载 → 就绪重启
  // 返回: checkForUpdates, downloadUpdate, restartApp
}
```

## 4. tauri.conf.json 配置

```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico"]
  },
  "plugins": {
    "updater": {
      "endpoints": [],
      "pubkey": "",
      "windows": { "installMode": "passive" }
    }
  }
}
```

> `endpoints` 和 `pubkey` 在 CI 构建时由 `tauri.updater.conf.json` 动态注入，不在源码中硬编码。

## 5. 签名密钥管理

### 5.1 生成密钥

```bash
npx tauri signer generate -w signing/aether.key --password "your-password"
```

输出两个文件：
- `signing/aether.key` — 私钥（保密，绝不可提交到 git）
- `signing/aether.key.pub` — 公钥（用于构建时注入应用）

### 5.2 密钥安全策略

| 资产 | 存储位置 | 保护措施 |
|------|----------|----------|
| 私钥 | `signing/aether.key`（项目内，gitignore） | 不在版本库中 |
| 公钥 | `.env` 文件 + GitHub Secrets | `.env*` 在 `.gitignore` |
| 密码 | `.env` 文件 | `.env*` 在 `.gitignore` |
| 构建配置 | `tauri.updater.conf.json` | 构建脚本生成，`.gitignore` 排除 |

## 6. 安装包生成

### 6.1 Windows 安装包格式

| 格式 | 来源 |
|------|------|
| `*_setup.exe` | Tauri NSIS 工具链 |
| `*.msi` | Tauri WiX 工具链 |
| `*_portable.zip` | `normalize-release-artifacts.mjs` 脚本手动打包（exe + DLLs） |

### 6.2 本地构建

```powershell
# 1. 配置 .env 文件（已 gitignored）
# 2. 运行构建脚本
scripts/build-release.ps1
```

脚本自动完成：加载 `.env` → 读取私钥 → 生成 `tauri.updater.conf.json` → `npx tauri build` → 签名安装包 → 清理临时配置。

### 6.3 构建脚本内部流程

```
加载 .env → 从 `AETHER_SIGNING_PRIVATE_KEY_PATH` 读取私钥 → 设置 `TAURI_SIGNING_PRIVATE_KEY` 供 Tauri CLI 签名
         → 生成 tauri.updater.conf.json
         → npx tauri build --config tauri.updater.conf.json
         → Tauri 输出:
             release\bundle\nsis\Product_v0.x.x_x64-setup.exe + .sig
             release\bundle\msi\Product_v0.x.x_x64_en-US.msi + .sig
         → 清理 tauri.updater.conf.json
```

## 7. 更新清单 (`latest.json`)

由 CI 中的 `generate-updater-manifest.mjs` 生成，托管在 GitHub Releases：

```json
{
  "version": "0.1.0",
  "notes": "release notes...",
  "pub_date": "2026-06-04T00:00:00.000Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<ed25519 base64>",
      "url": "https://github.com/owner/repo/releases/latest/download/Product_0.1.0_windows_x64_setup.exe"
    }
  }
}
```

## 8. 更新流程

```
应用启动 → useAutoUpdater 检查 → 有更新?
  ├─ 否 → 等待 6h → 再次检查
  └─ 是 → 后台静默下载 (进度回调 → UI 显示进度条)
         → 下载完成 → 显示"重启更新"按钮
         → 用户点击 → relaunch() → 新版安装
```

## 9. 发布脚本说明

| 脚本 | 作用 |
|------|------|
| `normalize-release-artifacts.mjs` | 重命名安装包为规范格式，生成 portable ZIP |
| `create-updater-metadata.mjs` | 匹配包与签名文件，生成平台元数据 |
| `generate-updater-manifest.mjs` | 合并所有平台元数据为 `latest.json` |
| `resolve-tauri-build-args.mjs` | pre-release 强制 `--bundles nsis` |

## 10. 关键文件清单

| 文件 | 用途 |
|------|------|
| `src-tauri/tauri.conf.json` | bundle 目标 + updater 占位配置 |
| `src-tauri/Cargo.toml` | Rust 依赖声明 |
| `src-tauri/src/main.rs` | updater/process 插件注册 |
| `src-tauri/capabilities/default.json` | 权限声明 |
| `src/updater.ts` | 更新核心引擎 + 代理回退 |
| `src/hooks/useAutoUpdater.ts` | React 周期检查 hook |
| `.github/workflows/release.yml` | Windows CI/CD |
| `scripts/build-release.ps1` | 本地构建脚本 |
| `scripts/release/*.mjs` | 发布流水线脚本 |
| `.env` | 密钥配置（gitignored） |
