# BIDE 必德

Python 编写的美股看板与行情、回测服务。

- 关注列表、星标、订单记录和行情展示
- 行情缓存、指标分析与策略回测
- Logto 登录及用户独立会话
- 面向 AI 客户端的只读 MCP，按用户授权访问个人数据

博客独立为 [NOTE](https://github.com/fujioky/note)，登录组件为 [fujioky-auth](https://github.com/fujioky/fujioky-auth)。

## 开发

首次克隆需初始化子模块：

```sh
git clone --recurse-submodules https://github.com/fujioky/bide.git
```

已有仓库运行 `git submodule update --init --recursive`。子模块固定到已提交的版本。

应用位于 `app/`，行情服务位于 `quant/`，AI 服务位于 `agent/`。
安装各目录的依赖；BIDE 还需安装 `packages/fujioky-auth`。配置通过环境变量提供。

## 部署

`deploy/` 提供容器部署示例。域名及主机名均为占位值，请按自己的环境配置。密钥、用户数据和运维记录不随源码发布。

## 测试

各测试模块需独立运行 pytest，避免模块加载时的环境配置互相影响。
