# Markra Windows 打包与自动升级说明

## 项目类型

Tauri 2.x 桌面应用（Rust 后端 + React/TypeScript/Vite 前端），pnpm workspace 管理。

---

## 一、打包为 Windows 安装包

### 构建命令

```bash
pnpm tauri build
```

### Windows 安装包格式

| 格式 | 说明 |
|------|------|
| `.exe` | NSIS 安装包（默认安装程序） |
| `.msi` | WiX MSI 安装包 |
| `_portable.zip` | 便携版（免安装，直接解压运行） |

> CI 中 pre-release 版本强制 `--bundles nsis`，跳过 MSI 以加快构建。

### 关键配置

**`apps/desktop/src-tauri/tauri.conf.json`** 中 bundle 相关配置：

- `bundle.active: true`
- `bundle.targets: "all"` — 生成所有平台格式（Windows 下即 NSIS + MSI）
- 注册 `.md` / `.markdown` 文件关联
- 图标、产品名称等元数据

### CI/CD 发布流水线

**`.github/workflows/release.yml`** 分两阶段：

**阶段 1 — 构建（Windows 矩阵）：**

1. 检出代码（release tag + main 分支的发布脚本）
2. 校验版本一致性（`package.json` / `tauri.conf.json` / `Cargo.toml` / Git tag）
3. 动态生成 `tauri.updater.conf.json`：
   - `createUpdaterArtifacts: true`
   - 更新 endpoint URL（`latest.json`）
   - ed25519 公钥（从 GitHub Secrets 注入）
   - Windows 安装模式：`"passive"`
4. 运行 `tauri-apps/tauri-action@v0.6.0` 执行构建
5. **`normalize-release-artifacts.mjs`** 标准化文件名：
   - `Markra_{version}_windows_x64_setup.exe`
   - `Markra_{version}_windows_x64.msi`
   - `Markra_{version}_windows_x64_portable.zip`
   - Windows portable ZIP 手动打包（exe + DLLs）
6. **`create-updater-metadata.mjs`** 生成 `release-metadata.json`（签名 + 文件名）
7. 上传 artifacts 到 GitHub Actions 存储

**阶段 2 — 发布：**

1. 下载所有平台 artifacts
2. 生成 Release Notes
3. **`generate-updater-manifest.mjs`** 合并所有 `release-metadata.json` 为 `latest.json`
4. 通过 `softprops/action-gh-release@v2` 发布到 GitHub Releases

---

## 二、Windows 自动更新机制

采用 **Tauri 官方 `tauri-plugin-updater` 插件** + **ed25519 非对称签名验证**。

### 架构层次

```
React UI 层 (packages/app)
  └── useAutoUpdater.ts → UpdateProgressToast.tsx
        ↓
TypeScript 运行时层 (apps/desktop)
  └── runtime/tauri/updater.ts — 封装 @tauri-apps/plugin-updater API
        ↓
Rust 原生层 (apps/desktop/src-tauri)
  └── tauri_plugin_updater — 下载 / ed25519 验签 / 安装
```

### 更新流程

1. **启动自动检查**：`useAutoUpdater` hook 在应用启动时立即检查
2. **周期检查**：每 6 小时自动检查一次
3. **后台静默下载**：发现更新后自动下载，下载期间通过 `UpdateProgressToast.tsx` 显示进度
4. **重启安装**：下载完成后弹出"立即重启"Toast，用户点击后调用 `relaunch()`
5. **手动检查**：通过设置页面或原生菜单"Check for Updates"触发

### Windows 更新包

Windows 平台的更新包直接使用 NSIS 安装包（`.exe`），url 指向 GitHub Releases 上的 `Markra_{version}_windows_x64_setup.exe`。下载完成后由 Tauri 插件自动执行安装程序完成升级。

### 更新清单 (`latest.json`) 结构

```json
{
  "version": "0.6.4",
  "notes": "release notes...",
  "pub_date": "2026-06-03T00:00:00.000Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<ed25519 签名>",
      "url": "https://github.com/murongg/markra/releases/latest/download/Markra_0.6.4_windows_x64_setup.exe"
    }
  }
}
```

### 网络代理回退

`apps/desktop/src/runtime/tauri/updater.ts` 实现了本地代理探测机制，自动尝试以下代理端口：

- Clash: 7890
- Clash Verge: 7897
- V2Ray: 1087
- Clash Meta: 10809
- 其他: 6152

全部失败后再直连，专为国内网络环境设计。

### 安全机制

- **ed25519 签名**：私钥存储在 GitHub Secrets（`TAURI_SIGNING_PRIVATE_KEY`），公钥在构建时注入应用
- **TLS 传输**：更新包通过 HTTPS 从 GitHub Releases 分发
- **验签安装**：Tauri 框架在安装前验证签名完整性

### 用户控制

- `autoUpdateEnabled` 默认 `true`，可在设置页面关闭
- 关闭后不再自动检查，但手动检查仍可用

---

## 三、关键文件

| 文件 | 用途 |
|------|------|
| `apps/desktop/src-tauri/tauri.conf.json` | Tauri 主配置（bundle 目标、updater endpoint） |
| `apps/desktop/src-tauri/Cargo.toml` | Rust 依赖（`tauri-plugin-updater = "2.10.1"`） |
| `apps/desktop/src-tauri/src/lib.rs` | Rust 入口，注册 updater 插件 |
| `apps/desktop/src-tauri/capabilities/main.json` | 权限声明（`updater:default`） |
| `apps/desktop/src/runtime/tauri/updater.ts` | 核心更新逻辑（检查/代理回退/下载/重启） |
| `packages/app/src/hooks/useAutoUpdater.ts` | React hook（周期检查/下载/重启流程） |
| `packages/app/src/components/UpdateProgressToast.tsx` | 下载进度 UI |
| `packages/app/src/components/SettingsSections.tsx` | 设置页面（自动更新开关、手动检查按钮） |
| `.github/workflows/release.yml` | CI/CD 发布流水线 |
| `scripts/release/generate-updater-manifest.mjs` | 生成 `latest.json` 清单 |
| `scripts/release/normalize-release-artifacts.mjs` | 标准化安装包文件名 |
| `scripts/release/create-updater-metadata.mjs` | 生成各平台签名和包名元数据 |
