# 打包与 CI/CD 操作手册

---

## 1. 前置准备

### 1.1 安装依赖

```bash
npm install
```

### 1.2 生成签名密钥（仅首次）

```bash
npx tauri signer generate -w "%USERPROFILE%\.tauri\aether.key"
# 按提示输入密码（本项目密码：xtcxtc0328021）
```

密钥位置：
- 私钥：`%USERPROFILE%\.tauri\aether.key`  ← **严禁提交到 git**
- 公钥：`%USERPROFILE%\.tauri\aether.key.pub`

### 1.3 配置 .env 文件

项目根目录 `.env`（已 gitignored，复制 `.env.example` 或直接创建）：

```env
TAURI_SIGNING_PRIVATE_KEY_PATH=%USERPROFILE%\.tauri\aether.key
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=xtcxtc0328021
TAURI_UPDATER_PUBLIC_KEY=<从 aether.key.pub 复制的内容>
TAURI_UPDATER_ENDPOINT=https://github.com/xtc002007/Aether/releases/latest/download/latest.json
```

---

## 2. 本地打包

```powershell
scripts\build-release.ps1
```

自动完成：加载密钥 → 生成更新配置 → NSIS + MSI 安装包 → ed25519 签名。

输出位置：`src-tauri/target/release/bundle/`（或 `$CARGO_TARGET_DIR/release/bundle/`）

| 产物 | 说明 |
|------|------|
| `nsis/Aether_0.x.x_x64_setup.exe` | NSIS 安装包 |
| `nsis/Aether_0.x.x_x64_setup.exe.sig` | 签名文件 |
| `msi/Aether_0.x.x_x64_en-US.msi` | MSI 安装包 |
| `msi/Aether_0.x.x_x64_en-US.msi.sig` | 签名文件 |
| `portable/Aether_0.x.x_x64_portable.zip` | 便携版 |

---

## 3. CI/CD 发布流程

### 3.1 GitHub Secrets 配置

仓库 → Settings → Secrets and variables → Actions 添加：

| Secret | 值来源 |
|--------|--------|
| `TAURI_SIGNING_PRIVATE_KEY` | `Get-Content "$env:USERPROFILE\.tauri\aether.key" -Raw` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥密码 |
| `TAURI_UPDATER_PUBLIC_KEY` | `Get-Content "$env:USERPROFILE\.tauri\aether.key.pub" -Raw` |

### 3.2 触发发布

```bash
# 1. 提交代码
git add -A
git commit -m "release: v0.x.x"

# 2. 打 tag 并推送（触发 Actions 自动构建）
git tag v0.x.x
git push origin main --tags
```

### 3.3 CI 自动完成

1. 校验版本一致性（package.json / Cargo.toml / tauri.conf.json / tag）
2. 注入公钥 + 端点到 `tauri.updater.conf.json`
3. 编译前端 + Rust 后端
4. 生成 NSIS 安装包 + ed25519 签名
5. `normalize-release-artifacts.mjs` 标准化产物命名
6. 上传构建产物到 Actions 存储
7. **publish_release 阶段**：下载所有产物 → 生成 `latest.json` → 发布到 GitHub Releases

### 3.4 更新清单 URL

应用内置的更新检查端点：`https://github.com/xtc002007/Aether/releases/latest/download/latest.json`

---

## 4. 发布新版本步骤速查

```bash
# 1. 更新版本号（3 个文件同步）
#    package.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json

# 2. 提交
git add -A && git commit -m "release: v0.x.x"

# 3. 本地测试构建
scripts\build-release.ps1

# 4. 推送触发 CI
git tag v0.x.x && git push origin main --tags

# 5. 去 GitHub Actions 查看进度
#    https://github.com/xtc002007/Aether/actions
```

---

## 5. 注意事项

- **密钥安全**：私钥文件在 repo 外，`.env` 在 `.gitignore` 中，绝不可提交
- **CI 失败排查**：先检查 Secrets 是否完整配置
- **端口冲突**：本地 dev 端口 19924，与构建无关
- **更新测试**：发布后可在应用设置中点击"检查更新"手动触发
