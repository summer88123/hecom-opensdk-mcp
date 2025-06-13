# 红圈CRM+ OpenApi MCP Server


## 快速开始

1. clone项目

```shell
    git clone https://github.com/summer88123/hecom-opensdk-mcp.git
```

2. 安装依赖

```shell
    npm install
```

3. 构建项目

```shell
    npm run build
```

4. 配置MCP Client

> 注意：不同的 MCP Client 外层结构可能不同

```json
{
    "servers": {
        "hecom": {
            "command": "node",
            "args": [
                "yourlocalpath/hecom-opensdk-mcp/dist/index.js"
            ],
            "env": {
                "HECOM_CLIENT_ID":"连接器参数",
                "HECOM_CLIENT_SECRET":"连接器参数",
                "HECOM_USERNAME":"手机号",
                "HECOM_HOST":"地址，默认https://tc.cloud.hecom.cn/"
            }
        }
    }   
}
```