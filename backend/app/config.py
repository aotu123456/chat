import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# --- 项目路径 ---
BASE_DIR = Path(__file__).resolve().parent.parent
CHARACTERS_DIR = BASE_DIR / "characters"
DATA_DIR = BASE_DIR / "data"
CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

# ===== DeepSeek 配置 =====
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
SUPPORTED_DEEPSEEK_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat"]
DEFAULT_LLM_MODEL = os.getenv("DEFAULT_LLM_MODEL", "deepseek-chat")

# ===== 通义万相图像生成配置 =====
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
WANX_API_BASE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
# 图片生成默认参数
IMAGE_SIZE = os.getenv("IMAGE_SIZE", "1024*1024")
IMAGE_N = int(os.getenv("IMAGE_N", "1"))
IMAGE_TIMEOUT = int(os.getenv("IMAGE_TIMEOUT", "90"))

# ===== 记忆与对话历史配置 =====
SHORT_MEMORY_LIMIT = 10
LONG_MEMORY_RETRIEVE_COUNT = 5
WORLD_UPDATE_INTERVAL = 5
LONG_MEMORY_importance_threshold =0.5
# 图像生成时提取的最近消息条数
RECENT_MESSAGES_FOR_IMAGE = 6