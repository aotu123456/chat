import time
from typing import Iterator, List

from app.config import (DEFAULT_LLM_MODEL, LONG_MEMORY_RETRIEVE_COUNT,
                        SHORT_MEMORY_LIMIT)
from app.memory.state_store import load_agent_state, save_agent_state
from app.memory.vector_store import add_memory, search_memories
from app.utils.llm_client import call_llm, stream_llm


def char_public_summary(c: dict) -> str:
    """生成角色公开摘要(供其他智能体感知,不含任何私密信息)"""
    pub = c.get('public') or {}
    ident = ' '.join(x for x in [c.get('title'), c.get('race'), c.get('occupation')] if x)
    parts = []
    if c.get('name'):
        parts.append(f"名字:{c['name']}")
    if ident:
        parts.append(f"身份:{ident}")
    if pub.get('appearance'):
        parts.append(f"外貌:{pub['appearance']}")
    if pub.get('speech_style'):
        parts.append(f"说话风格:{pub['speech_style']}")
    if pub.get('personality'):
        parts.append(f"性格:{'/'.join(pub['personality'])}")
    if pub.get('public_background'):
        parts.append(f"公开背景:{pub['public_background']}")
    if pub.get('public_attributes'):
        attrs = ', '.join(f"{k}:{v}" for k, v in pub['public_attributes'].items())
        parts.append(f"外显特征:{attrs}")
    if c.get('relationships'):
        rels = ', '.join(f"{k}:{v}" for k, v in c['relationships'].items())
        parts.append(f"关系:{rels}")
    return '; '.join(parts) if parts else "(没有更多公开信息)"


class IndividualAgent:
    """
    个体智能体(会话内)
    :param session_id: 所属存档
    :param char_def: 角色完整定义(身份/公开/私密/状态/关系)
    :param player_name: 玩家(扮演者)名称
    """

    def __init__(self, session_id: str, char_def: dict, player_name: str = "玩家",
                 model: str = None):
        self.session_id = session_id
        self.defn = char_def
        self.id = char_def.get('id') or char_def.get('name', 'agent')
        self.name = char_def.get('name', '未命名')
        self.player_name = player_name
        self.model = model or char_def.get('model') or DEFAULT_LLM_MODEL
        status, short_memory = load_agent_state(session_id, self.id)
        if status is None:
            status = char_def.get('status', {})
            short_memory = []
        self.status = status
        self.short_memory = short_memory

    # ---------- 记忆 ----------
    def _persist(self):
        save_agent_state(self.session_id, self.id, self.status, self.short_memory)

    def add_to_short_memory(self, role: str, content: str):
        """添加消息到短期记忆,并且自动剪裁"""
        self.short_memory.append({
            'role': role,
            'content': content,
            'time': time.time()
        })
        if len(self.short_memory) > SHORT_MEMORY_LIMIT:
            self.short_memory = self.short_memory[-SHORT_MEMORY_LIMIT:]
        self._persist()

    def add_long_term_memory(self, text: str, importance: float = 0.5):
        """把重要文本存入长期记忆向量库"""
        if not text or len(text.strip()) <= 10:
            return
        add_memory(self.session_id, self.id, text,
                   metadata={'importance': importance, 'time': time.time()})

    def get_relevant_long_term_memories(self, query: str) -> List[str]:
        return search_memories(self.session_id, self.id, query,
                               n_results=LONG_MEMORY_RETRIEVE_COUNT) or []

    # ---------- 提示词组装 ----------
    def _build_self_text(self) -> str:
        """自身完整设定(含私密,仅自己可见)"""
        c = self.defn
        pub = c.get('public') or {}
        pri = c.get('private') or {}
        lines = [f"角色名称:{self.name}"]
        if c.get('title'):
            lines.append(f"称号:{c['title']}")
        if c.get('race'):
            lines.append(f"种族:{c['race']}")
        if c.get('occupation'):
            lines.append(f"职业:{c['occupation']}")
        if c.get('age'):
            lines.append(f"年龄:{c['age']}")
        if c.get('gender'):
            lines.append(f"性别:{c['gender']}")
        lines.append(f"外貌:{pub.get('appearance') or '未知'}")
        if pub.get('speech_style'):
            lines.append(f"说话风格:{pub['speech_style']}")
        if pub.get('personality'):
            lines.append(f"性格:{'/'.join(pub['personality'])}")
        if pub.get('public_background'):
            lines.append(f"公开背景:{pub['public_background']}")
        if pub.get('public_attributes'):
            attrs = ', '.join(f"{k}:{v}" for k, v in pub['public_attributes'].items())
            lines.append(f"外显特征:{attrs}")
        lines.append(f"当前状态:{self.status}")

        priv = []
        if pri.get('background'):
            priv.append(f"背景故事:{pri['background']}")
        if pri.get('goals'):
            priv.append(f"目标:{'; '.join(pri['goals'])}")
        if pri.get('secrets'):
            priv.append(f"秘密:{pri['secrets']}")
        if pri.get('attributes'):
            priv.append(f"属性:{', '.join(f'{k}:{v}' for k, v in pri['attributes'].items())}")
        if pri.get('skills'):
            priv.append(f"技能:{'/'.join(pri['skills'])}")
        if pri.get('inventory'):
            inv = '、'.join(
                f"{it.get('name', '')}" + (f"({it.get('desc', '')})" if it.get('desc') else "")
                for it in pri['inventory'])
            priv.append(f"随身物品:{inv}")
        if priv:
            lines.append("\n【你的秘密设定】(只有你自己知道,对任何人都要保密)\n" +
                         "\n".join(f"- {p}" for p in priv))
        return "\n".join(lines)

    def _build_short_memory_text(self, max_items: int = 5) -> str:
        recent = self.short_memory[-max_items:]
        if not recent:
            return '无对话'
        lines = []
        for msg in recent:
            role = msg['role']
            display_role = self.name if role in (self.name, self.id) else self.player_name
            lines.append(f"[{display_role}] {msg['content']}")
        return "\n".join(lines)

    def _build_prompts(self, user_input: str, world_lore: str, world_state: dict,
                       other_context: str, player_summary: str,
                       peer_public: dict) -> tuple:
        """组装 system_prompt / user_prompt(有限视角)"""
        long_memories = self.get_relevant_long_term_memories(user_input)
        long_mem_text = ("\n".join(f"-{mem}" for mem in long_memories)
                         if long_memories else "无长期记忆")
        short_mem_text = self._build_short_memory_text(max_items=5)

        peers = [t for aid, t in peer_public.items() if aid != self.id]
        peer_text = "\n".join(f"- {t}" for t in peers) if peers else "无其他角色"

        system_prompt = f"""你正在扮演一个角色,请严格遵循以下设定进行对话,不要跳出角色。

{self._build_self_text()}

【世界设定】(所有角色共知的背景)
{world_lore}

【当前世界状况】
- 时间:{world_state.get('time', '未知')}
- 天气:{world_state.get('weather', '未知')}
- 地点:{world_state.get('location', '未知')}
- 最近事件:{', '.join(world_state.get('recent_events', [])) or '无'}
- 在场角色:{', '.join(world_state.get('active_characters', [])) or '未知'}

【其他角色】(你了解到的公开信息)
{peer_text}

【玩家】(正在与你对话的人,这是你对其的全部了解,不要臆测其他信息)
{player_summary}

【短期记忆】(最近的对话)
{short_mem_text}

【长期记忆】(与当前话题相关的过往重要信息)
{long_mem_text}

你的任务是:针对玩家的输入,以 {self.name} 的身份给出自然、贴切的回复。
规则:
1. 回复应当简洁,通常不超过80字,只输出对话内容,不要任何解释或标注。
2. 你不知道的事情不要装作知道,不要提及你并未掌握的信息。
3. 你的秘密设定绝不能向任何人透露。
"""

        user_prompt = f"""玩家({self.player_name})说:{user_input}
{f'其他角色的发言:{other_context}' if other_context else ''}
请给出 {self.name} 的回复:"""
        return system_prompt, user_prompt

    # ---------- 回复 ----------
    def generate_response(self, user_input: str, world_lore: str, world_state: dict,
                          other_context: str, player_summary: str,
                          peer_public: dict) -> str:
        system_prompt, user_prompt = self._build_prompts(
            user_input, world_lore, world_state, other_context, player_summary, peer_public)
        reply = call_llm(prompt=user_prompt, system_prompt=system_prompt, model=self.model)
        self._record_exchange(user_input, reply)
        return reply

    def stream_response(self, user_input: str, world_lore: str, world_state: dict,
                        other_context: str, player_summary: str,
                        peer_public: dict) -> Iterator[str]:
        system_prompt, user_prompt = self._build_prompts(
            user_input, world_lore, world_state, other_context, player_summary, peer_public)
        full = ""
        for chunk in stream_llm(prompt=user_prompt, system_prompt=system_prompt, model=self.model):
            full += chunk
            yield chunk
        self._record_exchange(user_input, full)

    def _record_exchange(self, user_input: str, reply: str):
        self.add_to_short_memory('user', user_input)
        self.add_to_short_memory(self.name, reply)
        if len(reply) > 20 or any(word in reply for word in ["记住", "重要", "关键", "别忘了"]):
            memory_text = f"{self.name} 在对话中说: {reply}"
            self.add_long_term_memory(memory_text)

    def update_status(self, new_status: dict) -> None:
        self.status.update(new_status)
        self._persist()

    def __repr__(self):
        return f'IndividualAgent(id={self.id}, name={self.name})'
