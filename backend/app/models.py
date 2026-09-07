from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ===================== 角色定义 =====================
class PublicInfo(BaseModel):
    """公开区:他人可直接感知的信息(注入所有智能体提示词)"""
    appearance: str = ""
    speech_style: str = ""
    personality: List[str] = []
    public_background: str = ""
    public_attributes: Dict[str, Any] = {}


class PrivateInfo(BaseModel):
    """私密区:NPC 仅进入自身提示词;玩家对一切 AI 隐藏"""
    background: str = ""
    goals: List[str] = []
    secrets: str = ""
    attributes: Dict[str, Any] = {}
    skills: List[str] = []
    inventory: List[Dict[str, str]] = []


class CharacterCreate(BaseModel):
    """角色定义(NPC 与玩家共用同一 schema)"""
    id: str = ""
    name: str
    title: str = ""
    race: str = ""
    occupation: str = ""
    age: int = 0
    gender: str = ""
    avatar: str = ""
    public: PublicInfo = PublicInfo()
    private: PrivateInfo = PrivateInfo()
    status: Dict[str, Any] = {}
    relationships: Dict[str, str] = {}
    model: str = ""


# ===================== 世界定义 =====================
class Location(BaseModel):
    name: str
    desc: str = ""


class Faction(BaseModel):
    name: str
    desc: str = ""
    attitude: str = "中立"


class WorldCreate(BaseModel):
    """世界定义(对全部智能体公开共享)"""
    name: str
    description: str = ""
    genre: str = ""
    tone: str = ""
    era: str = ""
    time: str = "中午"
    season: str = ""
    calendar: str = ""
    locations: List[Location] = []
    current_location: str = ""
    weather: str = "晴朗"
    climate: str = ""
    races: List[str] = []
    factions: List[Faction] = []
    laws: str = ""
    culture: str = ""
    magic_system: str = ""
    economy: str = ""
    history: str = ""
    central_conflict: str = ""
    plot_hooks: List[str] = []
    initial_events: List[str] = []


# ===================== 存档 =====================
class SessionCreate(BaseModel):
    name: str
    synopsis: str = ""
    world: WorldCreate
    characters: List[CharacterCreate] = Field(min_length=1)
    player: CharacterCreate


class SessionUpdate(BaseModel):
    name: Optional[str] = None
    synopsis: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    agent_ids: Optional[List[str]] = None


class ImageGenerateRequest(BaseModel):
    prompt: Optional[str] = None
