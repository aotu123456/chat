# 存档 / 短期记忆 / 消息 (SQLite)
import json
import time
import uuid
from pathlib import Path

from sqlalchemy import (Column, Float, Integer, String, Text, create_engine,
                        inspect, text)
from sqlalchemy.orm import declarative_base, sessionmaker

DATA_DIR = Path(__file__).parent.parent.parent / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / 'rpg_state.db'

Base = declarative_base()
engine = create_engine(f'sqlite:///{DB_PATH}',
                       connect_args={'check_same_thread': False})
Session = sessionmaker(bind=engine)


class SessionModel(Base):
    """存档:世界定义 + 世界运行时状态 + 角色定义 + 玩家定义"""
    __tablename__ = 'sessions'
    id = Column(String, primary_key=True)
    name = Column(String, default='')
    synopsis = Column(String, default='')
    genre = Column(String, default='')
    world_initial_json = Column(Text, default='{}')
    world_state_json = Column(Text, default='{}')
    characters_json = Column(Text, default='[]')
    player_json = Column(Text, default='{}')
    created_at = Column(Float, default=0)
    updated_at = Column(Float, default=0)


class AgentStateModel(Base):
    """智能体短期记忆表(按存档隔离)"""
    __tablename__ = 'agent_state'
    session_id = Column(String, primary_key=True)
    agent_id = Column(String, primary_key=True)
    status_json = Column(Text, default='{}')
    short_memory_json = Column(Text, default='[]')


class MessageModel(Base):
    """聊天记录(按存档隔离)"""
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, index=True)
    role = Column(String, default='')
    name = Column(String, default='')
    content = Column(Text, default='')
    created_at = Column(Float, default=0)


def _migrate():
    """丢弃旧版单会话表结构(agent_state/world_state),保证新 schema 生效"""
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    with engine.begin() as conn:
        if 'agent_state' in tables:
            cols = {c['name'] for c in insp.get_columns('agent_state')}
            if 'session_id' not in cols:
                conn.execute(text('DROP TABLE agent_state'))
                print('已迁移: 丢弃旧版 agent_state 表')
        if 'world_state' in tables:
            conn.execute(text('DROP TABLE world_state'))
            print('已迁移: 丢弃旧版 world_state 表')


_migrate()
Base.metadata.create_all(engine)


# ===================== 存档 CRUD =====================
def create_session(name: str, synopsis: str, world_initial: dict,
                   world_state: dict, characters: list, player: dict) -> str:
    sid = 's_' + uuid.uuid4().hex[:12]
    now = time.time()
    db = Session()
    row = SessionModel(
        id=sid, name=name, synopsis=synopsis,
        genre=world_initial.get('genre', ''),
        world_initial_json=json.dumps(world_initial, ensure_ascii=False),
        world_state_json=json.dumps(world_state, ensure_ascii=False),
        characters_json=json.dumps(characters, ensure_ascii=False),
        player_json=json.dumps(player, ensure_ascii=False),
        created_at=now, updated_at=now,
    )
    db.add(row)
    db.commit()
    db.close()
    return sid


def list_sessions() -> list:
    db = Session()
    rows = db.query(SessionModel).order_by(SessionModel.updated_at.desc()).all()
    result = [{
        'id': r.id, 'name': r.name, 'synopsis': r.synopsis, 'genre': r.genre,
        'created_at': r.created_at, 'updated_at': r.updated_at,
    } for r in rows]
    db.close()
    return result


def load_session_data(sid: str) -> dict:
    db = Session()
    row = db.query(SessionModel).filter(SessionModel.id == sid).first()
    db.close()
    if not row:
        return None
    return {
        'id': row.id, 'name': row.name, 'synopsis': row.synopsis, 'genre': row.genre,
        'world_initial': json.loads(row.world_initial_json or '{}'),
        'world_state': json.loads(row.world_state_json or '{}'),
        'characters': json.loads(row.characters_json or '[]'),
        'player': json.loads(row.player_json or '{}'),
        'created_at': row.created_at, 'updated_at': row.updated_at,
    }


def update_session_meta(sid: str, name: str = None, synopsis: str = None):
    db = Session()
    row = db.query(SessionModel).filter(SessionModel.id == sid).first()
    if row:
        if name is not None:
            row.name = name
        if synopsis is not None:
            row.synopsis = synopsis
        row.updated_at = time.time()
        db.commit()
    db.close()


def touch_session(sid: str):
    db = Session()
    row = db.query(SessionModel).filter(SessionModel.id == sid).first()
    if row:
        row.updated_at = time.time()
        db.commit()
    db.close()


def delete_session(sid: str):
    db = Session()
    db.query(MessageModel).filter(MessageModel.session_id == sid).delete()
    db.query(AgentStateModel).filter(AgentStateModel.session_id == sid).delete()
    db.query(SessionModel).filter(SessionModel.id == sid).delete()
    db.commit()
    db.close()


# ===================== 世界运行时状态 =====================
def save_world_state(sid: str, status: dict):
    db = Session()
    row = db.query(SessionModel).filter(SessionModel.id == sid).first()
    if row:
        row.world_state_json = json.dumps(status, ensure_ascii=False)
        row.updated_at = time.time()
        db.commit()
    db.close()


# ===================== 智能体状态/短期记忆 =====================
def save_agent_state(sid: str, agent_id: str, status: dict, short_memory_json: list):
    db = Session()
    existing = (db.query(AgentStateModel)
                .filter(AgentStateModel.session_id == sid, AgentStateModel.agent_id == agent_id)
                .first())
    if existing:
        existing.status_json = json.dumps(status, ensure_ascii=False)
        existing.short_memory_json = json.dumps(short_memory_json, ensure_ascii=False)
    else:
        db.add(AgentStateModel(
            session_id=sid, agent_id=agent_id,
            status_json=json.dumps(status, ensure_ascii=False),
            short_memory_json=json.dumps(short_memory_json, ensure_ascii=False),
        ))
    db.commit()
    db.close()
    return {'session_id': sid, 'agent_id': agent_id}


def load_agent_state(sid: str, agent_id: str):
    db = Session()
    existing = (db.query(AgentStateModel)
                .filter(AgentStateModel.session_id == sid, AgentStateModel.agent_id == agent_id)
                .first())
    if existing:
        try:
            status = json.loads(existing.status_json) if existing.status_json else {}
        except json.JSONDecodeError:
            status = {}
        try:
            short_memory = json.loads(existing.short_memory_json) if existing.short_memory_json else []
        except json.JSONDecodeError:
            short_memory = []
        if not isinstance(short_memory, list):
            short_memory = []
        db.close()
        return status, short_memory
    db.close()
    return None, None


# ===================== 消息 =====================
def add_message(sid: str, role: str, name: str, content: str):
    db = Session()
    db.add(MessageModel(session_id=sid, role=role, name=name,
                        content=content, created_at=time.time()))
    db.commit()
    db.close()


def get_messages(sid: str, limit: int = 500) -> list:
    db = Session()
    rows = (db.query(MessageModel)
            .filter(MessageModel.session_id == sid)
            .order_by(MessageModel.id.asc())
            .limit(limit)
            .all())
    result = [{
        'role': r.role, 'name': r.name, 'content': r.content, 'created_at': r.created_at,
    } for r in rows]
    db.close()
    return result


def count_messages(sid: str) -> int:
    db = Session()
    n = db.query(MessageModel).filter(MessageModel.session_id == sid).count()
    db.close()
    return n
