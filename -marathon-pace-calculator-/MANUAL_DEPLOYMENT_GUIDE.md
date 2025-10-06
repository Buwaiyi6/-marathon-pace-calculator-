# V6版本手动部署指南

## 🚨 当前状态

由于网络连接问题，无法自动推送到GitHub。以下是手动完成部署的详细步骤。

## 📋 部署前准备

### ✅ 已完成的工作
- [x] 代码修改完成
- [x] 更新日志创建完成 (`CHANGELOG_V6.md`)
- [x] 部署说明创建完成 (`DEPLOYMENT_V6.md`)
- [x] Git提交完成 (commits: 85a3c6f, 3455721)
- [x] V6.0标签创建完成
- [x] GitHub Actions工作流配置完成

### 📁 文件状态
```
-marathon-pace-calculator-/
├── CHANGELOG_V6.md          # V6版本更新日志
├── DEPLOYMENT_V6.md         # 部署说明文档
├── MANUAL_DEPLOYMENT_GUIDE.md # 本文件
├── index.html               # 主页面文件
├── script.js                # JavaScript逻辑
├── style.css                # 样式文件
└── ...其他文件
```

## 🔧 手动部署步骤

### 步骤1: 检查网络连接
```bash
# 测试GitHub连接
ping github.com

# 如果ping不通，检查网络设置或使用VPN
```

### 步骤2: 推送代码到GitHub
```bash
# 确保在正确的目录
cd "-marathon-pace-calculator-"

# 检查Git状态
git status

# 推送主分支
git push origin main

# 推送V6.0标签
git push origin v6.0
```

### 步骤3: 验证推送成功
```bash
# 检查远程分支状态
git log --oneline -5

# 检查标签
git tag -l
```

### 步骤4: 触发GitHub Pages部署
推送完成后，GitHub Actions会自动：
1. 检测到main分支的更新
2. 运行部署工作流
3. 将`-marathon-pace-calculator-`目录部署到GitHub Pages

### 步骤5: 检查部署状态
1. 访问GitHub仓库: `https://github.com/Buwaiyi6/-marathon-pace-calculator-`
2. 点击"Actions"标签页
3. 查看"Deploy to GitHub Pages"工作流状态
4. 等待部署完成（通常需要2-5分钟）

## 🌐 访问新版本

部署完成后，可以通过以下链接访问V6版本：

### 主要链接
- **GitHub Pages**: `https://buwaiyi6.github.io/-marathon-pace-calculator-/`
- **直接访问**: `https://buwaiyi6.github.io/-marathon-pace-calculator-/index.html`

### 版本信息
- **版本号**: V6.0
- **标签**: v6.0
- **部署时间**: 待完成
- **主要特性**: 移动端优化、界面完善、响应式设计

## 🧪 测试清单

### 桌面端测试
- [ ] 滚轮向上/向下滚动正常
- [ ] 点击滚轮选择数字正常
- [ ] 输入框与滚轮同步正常
- [ ] 响应式布局调整正常
- [ ] 输入框与滚轮框宽度对齐

### 移动端测试
- [ ] 触摸拖动滚轮正常
- [ ] 滚轮归位功能正常
- [ ] 输入框宽度对齐正常
- [ ] 触摸交互体验良好
- [ ] 屏幕尺寸变化时布局正常

## 🔧 调试功能

V6版本包含以下调试功能，可在浏览器控制台中使用：

```javascript
// 手动修复滚轮对齐
window.fixWheelAlignment();

// 测试滚轮行为
window.testWheelBehavior();

// 测试向上滚动
window.testUpward();

// 测试向下滚动
window.testDownward();
```

## 🚨 故障排除

### 如果推送失败
1. 检查网络连接
2. 尝试使用VPN
3. 检查GitHub认证状态
4. 尝试使用SSH而不是HTTPS

### 如果部署失败
1. 检查GitHub Actions工作流日志
2. 确认`.github/workflows/deploy-to-pages.yml`文件正确
3. 检查GitHub Pages设置

### 如果页面无法访问
1. 等待几分钟让CDN更新
2. 清除浏览器缓存
3. 检查GitHub Pages状态页面

## 📞 联系信息

如果在部署过程中遇到问题，请检查：
1. 网络连接状态
2. GitHub仓库权限
3. GitHub Actions工作流配置
4. 浏览器控制台错误信息

---

**创建时间**: 2024年12月
**版本**: V6.0
**状态**: 准备就绪，等待网络连接恢复后手动推送
