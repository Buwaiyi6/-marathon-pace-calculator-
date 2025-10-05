# 马拉松配速计算器 - 部署指南

## 项目简介

这是一个马拉松配速计算工具，帮助跑者根据目标成绩计算配速策略，或根据当前配速预测完赛时间。

## 部署到腾讯云

### 1. 安装 Serverless Cloud Framework

```bash
# 安装 Serverless Cloud Framework
npm install -g serverless-cloud-framework
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
# 复制示例文件
cp .env.example .env
```

然后编辑 `.env` 文件，填入您的腾讯云API密钥：

```bash
# .env file
TENCENT_SECRET_ID=您的SecretId
TENCENT_SECRET_KEY=您的SecretKey
TENCENT_APPID=1380439897
```

> **获取API密钥**：请到 [腾讯云API密钥管理](https://console.cloud.tencent.com/cam/capi) 获取您的 `SecretId` 和 `SecretKey`。

### 3. 部署

在项目根目录运行以下命令：

```bash
scf deploy
```

部署过程中会弹出二维码，扫码授权即可完成部署。

### 4. 查看部署状态

```bash
scf info
```

### 5. 访问网站

部署成功后，您可以通过以下方式访问：
- 腾讯云控制台 → 对象存储 → 存储桶 `buwaiyi-1380439897` → 静态网站
- 或使用部署命令返回的访问地址

### 6. 移除部署（如需要）

```bash
scf remove
```

## 项目信息

- **存储桶名称**: buwaiyi-1380439897
- **部署区域**: ap-shanghai (上海)
- **账号ID**: 100044375367
- **APPID**: 1380439897

## 注意事项

1. 确保您的存储桶已开启静态网站托管功能
2. 如果遇到权限问题，请检查API密钥权限设置
3. 首次部署可能需要几分钟时间
