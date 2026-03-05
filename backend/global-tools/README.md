# 全局Tools (Global Tools)

此目录存放全局Tools配置，这些工具可被所有 Agent 使用。

## 目录结构

```
global-tools/
├── <tool-id>.json      # 工具配置文件
├── scripts/            # 脚本类型工具的脚本文件
│   └── <script-file>
└── mcp-servers/        # MCP Server 配置文件
    └── <server-id>.json
```

## 工具配置格式

每个工具配置是一个 JSON 文件，包含以下字段：

```json
{
  "id": "tool-id",
  "name": "tool_name",
  "description": "工具功能描述，帮助 LLM 理解何时使用此工具",
  "parameters": [
    {
      "name": "param1",
      "type": "string",
      "description": "参数描述",
      "required": true
    }
  ],
  "handler": {
    "type": "http",
    "url": "https://api.example.com/endpoint?param={{param1}}",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer {{apiKey}}"
    }
  },
  "enabled": true
}
```

## Handler 类型

### HTTP Handler

发起 HTTP 请求，URL/Header/Body 中可使用 `{{paramName}}` 占位符：

```json
{
  "type": "http",
  "url": "https://api.example.com/{{resource}}",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "bodyTemplate": "{\"query\": \"{{query}}\"}"
}
```

## 管理方式

1. **通过设置页面管理**：在应用设置页面的「全局Tools」板块可以添加、编辑、删除全局Tools
2. **通过 API 管理**：
   - `GET /api/global-tools` - 列出所有全局Tools
   - `POST /api/global-tools` - 创建全局Tools
   - `PUT /api/global-tools/:toolId` - 更新全局Tools
   - `DELETE /api/global-tools/:toolId` - 删除全局Tools
3. **直接编辑文件**：在此目录下创建/编辑 JSON 文件

## MCP Server 集成

支持通过 MCP (Model Context Protocol) 连接外部工具服务器。MCP Server 配置文件位于 `mcp-servers/` 子目录。

### MCP Server 配置格式

```json
{
  "id": "server-id",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-xxx", "arg1"],
  "env": {
    "API_KEY": "your-api-key"
  },
  "enabled": true
}
```

配置字段说明：
- `id`: MCP Server 唯一标识
- `command`: 启动命令（如 npx, node, python 等）
- `args`: 命令参数数组
- `env`: 可选的环境变量
- `enabled`: 是否启用（默认 true）

### 文件系统访问示例

内置的 `filesystem.json` 配置可让 Agent 访问本地文件系统：

```json
{
  "id": "filesystem",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:/Projects"],
  "enabled": true
}
```

启用后，Agent 将获得以下工具：
- `read_file` - 读取文件内容
- `read_multiple_files` - 批量读取文件
- `write_file` - 写入文件
- `create_directory` - 创建目录
- `list_directory` - 列出目录内容
- `move_file` - 移动/重命名文件
- `search_files` - 搜索文件
- `get_file_info` - 获取文件信息

> **安全提示**：请谨慎配置允许访问的目录路径，避免暴露敏感文件。

### 其他常用 MCP Server

- `@modelcontextprotocol/server-github` - GitHub 仓库访问
- `@modelcontextprotocol/server-postgres` - PostgreSQL 数据库访问
- `@modelcontextprotocol/server-slack` - Slack 消息访问

更多 MCP Server 参见: https://modelcontextprotocol.io/

## 与 Agent 专属工具的区别

- **全局Tools**：存放在 `global-tools/` 目录，所有 Agent 都可以使用
- **Agent 专属工具**：存放在 `agents/<agent-id>/tools/` 目录，仅该 Agent 可以使用

全局Tools在 LLM 调用时，描述会自动添加 `[全局]` 前缀以便区分。
