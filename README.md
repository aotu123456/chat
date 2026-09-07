# multiCHAT 多智能体 RPG 聊天系统

基于 FastAPI 的多智能体文本 RPG:多个 AI 角色在同一世界中对话、推进剧情,并可用通义万相生成场景插画。

## 目录结构

```
multiCHAT/
├── backend/                 # FastAPI 后端
│   ├── app/                 # 核心代码(config/coordinator/agents/memory/utils)
│   ├── characters/          # 内置角色定义(knight.json / mage.json)
│   ├── requirements.txt     # Python 依赖
│   └── run.py               # 启动入口(127.0.0.1:8000)
├── frontend/                # 纯静态前端(由后端直接托管,无需构建)
├── setup.sh                 # 一键环境配置
├── start.sh                 # 启动脚本
└── .env.example             # 环境变量模板(复制为 .env 后填写)
```

## 快速开始(Linux / macOS)

前置要求:已安装 Python 3.9+(推荐 3.10+)。

```bash
git clone <仓库地址> && cd multiCHAT
chmod +x setup.sh start.sh
./setup.sh                      # ① 建 .venv + 安装依赖 + 生成 .env
```

填写密钥:

```bash
vim .env   # 填入真实 DEEPSEEK_API_KEY;图像功能另填 DASHSCOPE_API_KEY
```

启动:

```bash
./start.sh                      # 浏览器访问 http://127.0.0.1:8000
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek 文本模型,https://platform.deepseek.com 获取 |
| `DASHSCOPE_API_KEY` | 否 | 阿里云百炼通义万相图像,https://bailian.console.aliyun.com 获取(勿用 dashscope key) |
| `DEFAULT_LLM_MODEL` | 否 | 默认对话模型,默认 `deepseek-chat` |

说明:`.env` 与运行时数据(`backend/data/`)不入库,克隆后会自动创建/生成。

## 常见问题

- 创建 venv 失败(Debian/Ubuntu):`sudo apt install python3-venv` 后重跑 `./setup.sh`。
- 重复执行 `./setup.sh` 安全:已存在的 `.env` / `.venv` 不会被覆盖。
- 首次启动会联网初始化,生成 `backend/data/chroma_db` 与 `backend/data/rpg_state.db`。
