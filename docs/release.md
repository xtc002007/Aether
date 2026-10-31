# Aether 发布与更新配置

本文件 **仅** 记录 Aether 专属参数。通用架构与操作流程见 monorepo 文档：

- [桌面工具集成指南（新工具总览）](../../../docs/desktop-tools-integration-guide.md)
- [打包与自动更新（通用）](../../../docs/tauri-package-update/system.md)
- [发布操作手册（通用）](../../../docs/tauri-package-update/operations.md)

---

## 应用参数

| 项 | 值 |
|----|-----|
| App Slug | `aether` |
| 产品名 | `Aether` |
| 环境变量前缀 | `AETHER_` |
| 开源仓库 (源码+Release) | [xtc002007/Aether](https://github.com/xtc002007/Aether) (Public) |
| winget 标识符 | `NexusTools.Aether` |
| 签名密钥 | `signing/aether.key` / `signing/aether.key.pub` |
| 本地 dev 端口 | `19924` |

> **开源模式特点**：Aether 作为开源标杆工具，直接在自身 Public 仓库维护源码与发布 Release，无需拆分 `-src`，CI 直接发布至本仓库并由 winget 抓取。

## 分发与更新端点

- **应用内自动更新（NexusTools API）**  
  `https://pbithxqiu7.execute-api.us-east-2.amazonaws.com/dev/api/apps/aether/updates/latest?platform=windows-x64`
- **官网下载**  
  `/api/apps/aether/download?platform=windows-x64` → 302 至 S3 `releases/aether/latest/Aether_latest_windows_x64_setup.exe`
- **GitHub 访客公开下载**  
  `https://github.com/xtc002007/Aether/releases/latest`
- **winget 命令行安装**  
  `winget install NexusTools.Aether`

## `.env` 示例

```env
AETHER_SIGNING_PRIVATE_KEY_PATH=signing/aether.key
AETHER_SIGNING_PUBLIC_KEY_PATH=signing/aether.key.pub
AETHER_SIGNING_PRIVATE_KEY_PASSWORD=<your-password>
AETHER_UPDATER_ENDPOINT=https://pbithxqiu7.execute-api.us-east-2.amazonaws.com/dev/api/apps/aether/updates/latest?platform=windows-x64
```

## GitHub Secrets (配置在 Aether 仓)

| Secret | 说明 |
|--------|------|
| `AETHER_SIGNING_PRIVATE_KEY` | Tauri updater minisign 签名私钥 |
| `AETHER_SIGNING_PRIVATE_KEY_PASSWORD` | 签名密钥密码 |
| `AETHER_UPDATER_PUBLIC_KEY` | 客户端更新公钥 |
| `NEXUSTOOLS_CONFIG_KEY` | 同步 manifest 到 API 平台 |
| `PAT_TOKEN` | CI 拉取 NexusTools-shared SDK |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | CI 上传安装包到 S3 `releases/` |
| `WINGET_PAT` | `winget-releaser` 自动向 `microsoft/winget-pkgs` 提 PR |
| `AZURE_TRUSTED_SIGNING_*` | Windows Authenticode 代码签名（防 SmartScreen 拦截） |

## 本地命令

```powershell
scripts\build-release.ps1
npm run test:updater
npm run tauri:dev
```

## 安装包命名

- `Aether_{version}_windows_x64_setup.exe` — 自动更新用
- `Aether_{version}_windows_x64_en-US.msi`
- `Aether_{version}_windows_x64_portable.zip`

密钥说明见 [signing/README.md](../signing/README.md)。
