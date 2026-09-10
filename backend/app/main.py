import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.config import BASE_DIR
from app.coordinator import Coordinator
from app.models import (ChatRequest, ImageGenerateRequest, SessionCreate,
                        SessionUpdate)
from app.memory import state_store as store
from app.session import validate_session
from app.utils.llm_client import generate_image

app = FastAPI(title="multiCHAT 多智能体 RPG 聊天系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

coordinator = Coordinator()


def _get_session(sid: str):
    session = coordinator.manager.get(sid)
    if not session:
        raise HTTPException(404, "存档不存在")
    return session


# ===================== 基础信息 =====================
@app.get("/api/health")
def health():
    return {"app": "multiCHAT", "status": "running"}


# ===================== 存档 =====================
@app.get("/api/sessions")
def list_sessions():
    return coordinator.manager.list()


@app.post("/api/sessions")
def create_session(req: SessionCreate):
    errors = validate_session(req)
    if errors:
        raise HTTPException(400, {"errors": errors})
    sid = coordinator.manager.create(req)
    return {"id": sid, "name": req.name}


@app.get("/api/sessions/{sid}")
def get_session(sid: str):
    data = coordinator.manager.detail(sid)
    if not data:
        raise HTTPException(404, "存档不存在")
    return data


@app.patch("/api/sessions/{sid}")
def patch_session(sid: str, req: SessionUpdate):
    session = _get_session(sid)
    if req.name is not None and req.name.strip():
        session.name = req.name.strip()
    if req.synopsis is not None:
        session.synopsis = req.synopsis.strip()
    coordinator.manager.rename(sid, session.name, session.synopsis)
    return {"success": True, "name": session.name, "synopsis": session.synopsis}


@app.delete("/api/sessions/{sid}")
def delete_session(sid: str):
    coordinator.manager.delete(sid)
    return {"success": True}


@app.get("/api/sessions/{sid}/messages")
def get_messages(sid: str):
    if not coordinator.manager.get(sid):
        raise HTTPException(404, "存档不存在")
    return store.get_messages(sid)


# ===================== 对话 =====================
@app.post("/api/sessions/{sid}/chat")
def chat(sid: str, req: ChatRequest):
    """普通(非流式)多智能体对话"""
    session = _get_session(sid)
    replies = coordinator.process_chat(session, req.message, req.agent_ids)
    return {"replies": replies, "world": session.world.get_state()}


@app.post("/api/sessions/{sid}/chat/stream")
def chat_stream(sid: str, req: ChatRequest):
    """SSE 流式多智能体对话"""
    session = _get_session(sid)

    def event_stream():
        yield "event: start\ndata: {}\n\n"
        try:
            for evt in coordinator.stream_chat(session, req.message, req.agent_ids):
                if evt["type"] == "agent_reply":
                    yield f"event: agent_reply\ndata: {json.dumps(evt, ensure_ascii=False)}\n\n"
                elif evt["type"] == "world_update":
                    yield f"event: world_update\ndata: {json.dumps(evt, ensure_ascii=False)}\n\n"
                elif evt["type"] == "done":
                    yield f"event: done\ndata: {json.dumps(evt, ensure_ascii=False)}\n\n"
        except Exception as e:
            print(f"流式对话失败: {e}")
            yield f"event: error\ndata: {json.dumps({'type': 'error', 'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ===================== 图片生成 =====================
@app.post("/api/sessions/{sid}/image")
def session_image(sid: str, req: ImageGenerateRequest):
    """调用通义万相生成当前场景图片"""
    session = _get_session(sid)
    if not req.prompt:
        world = session.world.get_state()
        lore = session.world.lore_text()
        recent = store.get_messages(sid, limit=8)
        context = "\n".join(f"{m['name']}: {m['content']}" for m in recent)
        prompt = (
            f"根据以下世界设定和最近对话生成一张 RPG 场景插画,画面风格为奇幻游戏场景。\n"
            f"【世界设定】\n{lore}\n"
            f"【当前状况】时间:{world.get('time')},天气:{world.get('weather')},"
            f"地点:{world.get('location')}\n"
            f"【最近对话】\n{context}"
        )
    else:
        prompt = req.prompt
    return generate_image(prompt)


# ===================== 前端静态文件 =====================
FRONTEND_DIR = BASE_DIR.parent / "frontend"
FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"
FRONTEND_STATIC_DIR = FRONTEND_DIST_DIR if FRONTEND_DIST_DIR.exists() else FRONTEND_DIR
if FRONTEND_STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_STATIC_DIR), html=True), name="frontend")
