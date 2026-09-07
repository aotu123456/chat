import json
from typing import List

from app.config import DEFAULT_LLM_MODEL, WORLD_UPDATE_INTERVAL
from app.memory.state_store import save_world_state
from app.utils.llm_client import call_llm

TIME_CHOICES = "清晨/上午/中午/下午/傍晚/夜晚"


class WorldAgent:
    """世界监管智能体(会话内):维护世界运行时状态,基于世界设定更新"""

    def __init__(self, session_id: str, world_def: dict, initial_state: dict,
                 model: str = None):
        self.session_id = session_id
        self.defn = world_def or {}
        self.state = dict(initial_state or {})
        self.model = model or DEFAULT_LLM_MODEL
        self._tick = 0

    def get_state(self) -> dict:
        return self.state

    def lore_text(self) -> str:
        """把世界完整设定转成提示词文本(全体智能体共享)"""
        d = self.defn
        lines = [f"世界名:{d.get('name', '')}"]
        genre_tone = ' · '.join(x for x in [d.get('genre'), d.get('tone')] if x)
        if genre_tone:
            lines.append(f"题材/基调:{genre_tone}")
        era = ' · '.join(x for x in [d.get('era'), d.get('calendar')] if x)
        if era:
            lines.append(f"时代:{era}")
        if d.get('description'):
            lines.append(f"简介:{d['description']}")
        if d.get('history'):
            lines.append(f"历史:{d['history']}")
        if d.get('central_conflict'):
            lines.append(f"核心冲突:{d['central_conflict']}")
        if d.get('locations'):
            locs = '、'.join(f"{l.get('name', '')}({l.get('desc', '')})"
                             for l in d['locations'])
            lines.append(f"地点:{locs}")
        if d.get('factions'):
            facs = '、'.join(
                f"{f.get('name', '')}({f.get('desc', '')},态度:{f.get('attitude', '中立')})"
                for f in d['factions'])
            lines.append(f"势力:{facs}")
        if d.get('races'):
            lines.append(f"种族:{'/'.join(d['races'])}")
        if d.get('laws'):
            lines.append(f"律法:{d['laws']}")
        if d.get('culture'):
            lines.append(f"文化:{d['culture']}")
        if d.get('magic_system'):
            lines.append(f"魔法体系:{d['magic_system']}")
        if d.get('economy'):
            lines.append(f"经济:{d['economy']}")
        if d.get('plot_hooks'):
            lines.append(f"剧情线索:{'; '.join(d['plot_hooks'])}")
        return "\n".join(lines)

    def update_world(self, user_input: str, replies: List[str]) -> dict:
        """用 LLM 根据对话内容提取事件并更新世界运行时状态(每 WORLD_UPDATE_INTERVAL 次)"""
        self._tick += 1
        if self._tick % WORLD_UPDATE_INTERVAL != 0:
            return self.state

        speakers = "\n".join(replies) if replies else "（无人回应）"
        prompt = f"""请根据以下对话内容,更新 RPG 世界的运行时状态。

【世界设定】
{self.lore_text()}

【当前世界状况】
{json.dumps(self.state, ensure_ascii=False, indent=2)}

玩家说:{user_input}
角色发言:
{speakers}

请只输出一个 JSON 对象(不要任何额外文字),格式如下:
{{
  "time": "{TIME_CHOICES} 中的其中一个",
  "weather": "天气描述",
  "location": "当前地点(从世界设定中的地点选择,或对话中明确提到的新地点)",
  "recent_events": ["最近发生的事件,最多3条"],
  "active_characters": ["在场角色名,最多3个"]
}}
只根据对话中明确或合理推断的信息更新,没有变化的字段保持原值。"""
        try:
            result = call_llm(prompt=prompt, model=self.model, max_tokens=256)
            result = result.strip()
            if result.startswith("```"):
                result = result.strip("`")
                if result.startswith("json"):
                    result = result[4:]
            start, end = result.find('{'), result.rfind('}')
            if start != -1 and end != -1:
                result = result[start:end + 1]
            new_state = json.loads(result)
            for key in ("time", "weather", "location", "recent_events", "active_characters"):
                if key in new_state:
                    self.state[key] = new_state[key]
            save_world_state(self.session_id, self.state)
        except Exception as e:
            print(f"世界状态更新失败: {e}")
        return self.state
