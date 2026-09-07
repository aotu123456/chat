from typing import Dict, List, Optional

from app.agents.individual import IndividualAgent, char_public_summary
from app.agents.world import WorldAgent
from app.memory import state_store as store
from app.models import SessionCreate


def _initial_world_state(world_def: dict) -> dict:
    locations = world_def.get('locations') or []
    return {
        'time': world_def.get('time') or '中午',
        'weather': world_def.get('weather') or '晴朗',
        'location': (world_def.get('current_location')
                     or (locations[0]['name'] if locations else '未知')),
        'recent_events': list(world_def.get('initial_events', [])),
        'active_characters': [],
    }


def validate_session(payload: SessionCreate) -> List[str]:
    """语义校验,返回错误列表(空列表 = 通过)"""
    errors = []
    if not payload.name.strip():
        errors.append('存档名称不能为空')
    if not payload.world.name.strip():
        errors.append('世界名称不能为空')
    if not payload.world.history.strip():
        errors.append('世界历史背景不能为空')
    if not payload.player.name.strip():
        errors.append('我的角色(扮演角色)名称不能为空')
    if not (payload.player.public.appearance or '').strip():
        errors.append('我的角色缺少公开外貌描述(appearance)')
    ids = set()
    for c in payload.characters:
        if not c.name.strip():
            errors.append('存在未命名的角色')
            continue
        if not (c.public.appearance or '').strip():
            errors.append(f"角色「{c.name}」缺少公开外貌描述(appearance)")
        cid = c.id or c.name
        if cid in ids:
            errors.append(f"角色标识重复:{cid}")
        ids.add(cid)
    return errors


class Session:
    """运行中的存档:持有世界、角色智能体、玩家定义"""

    def __init__(self, data: dict):
        self.id = data['id']
        self.name = data['name']
        self.synopsis = data.get('synopsis', '')
        self.world_def = data.get('world_initial', {})
        self.player = data.get('player', {})
        self.agents: Dict[str, IndividualAgent] = {}
        player_name = self.player.get('name', '玩家')
        for c in data.get('characters', []):
            a = IndividualAgent(self.id, c, player_name=player_name)
            self.agents[a.id] = a
        self.world = WorldAgent(self.id, self.world_def, data.get('world_state', {}))

    def player_name(self) -> str:
        return self.player.get('name', '玩家')

    def player_summary(self) -> str:
        return char_public_summary(self.player)

    def peer_public_map(self) -> dict:
        """所有角色的公开摘要(每个智能体组装提示词时自行排除自己)"""
        return {aid: char_public_summary(a.defn) for aid, a in self.agents.items()}

    def detail(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'synopsis': self.synopsis,
            'genre': self.world_def.get('genre', ''),
            'world': {
                'initial': self.world_def,
                'state': self.world.get_state(),
            },
            'characters': [
                {'id': a.id, 'name': a.name, 'avatar': a.defn.get('avatar', ''),
                 'title': a.defn.get('title', ''), 'description': a.defn.get('public', {}).get('appearance', ''),
                 'status': a.status}
                for a in self.agents.values()
            ],
            'player': self.player,
        }


class SessionManager:
    """存档管理器:CRUD + 运行时会话懒加载缓存"""

    def __init__(self):
        self._cache: Dict[str, Session] = {}

    # ---------- CRUD ----------
    def create(self, payload: SessionCreate) -> str:
        world_def = payload.world.model_dump()
        world_state = _initial_world_state(world_def)
        characters = [c.model_dump() for c in payload.characters]
        for c in characters:
            if not c.get('id'):
                c['id'] = c['name']
        player = payload.player.model_dump()
        if not player.get('id'):
            player['id'] = player['name']
        sid = store.create_session(
            name=payload.name.strip(),
            synopsis=payload.synopsis.strip(),
            world_initial=world_def,
            world_state=world_state,
            characters=characters,
            player=player,
        )
        return sid

    def list(self) -> list:
        items = store.list_sessions()
        result = []
        for it in items:
            data = store.load_session_data(it['id']) or {}
            chars = data.get('characters', [])
            result.append({
                **it,
                'character_count': len(chars),
                'avatars': [c.get('avatar', '🎭') for c in chars][:6],
                'player_avatar': (data.get('player') or {}).get('avatar', '🧙'),
                'message_count': store.count_messages(it['id']),
            })
        return result

    def detail(self, sid: str) -> Optional[dict]:
        session = self.get(sid)
        if not session:
            return None
        data = session.detail()
        data['messages'] = store.get_messages(sid)
        return data

    def rename(self, sid: str, name: str = None, synopsis: str = None):
        store.update_session_meta(sid, name, synopsis)

    def delete(self, sid: str):
        store.delete_session(sid)
        self._cache.pop(sid, None)
        from app.memory.vector_store import delete_session_collections
        delete_session_collections(sid)

    # ---------- 运行时 ----------
    def get(self, sid: str) -> Optional[Session]:
        if sid in self._cache:
            return self._cache[sid]
        data = store.load_session_data(sid)
        if not data:
            return None
        session = Session(data)
        self._cache[sid] = session
        return session
