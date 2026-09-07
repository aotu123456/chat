from typing import Iterator, List, Optional

from app.memory import state_store as store
from app.session import Session, SessionManager

manager = SessionManager()


class Coordinator:
    """中央协调器:按存档编排多智能体对话"""

    def __init__(self):
        self.manager = manager

    def _select_agents(self, session: Session,
                       agent_ids: List[str] = None) -> List:
        if not agent_ids:
            return list(session.agents.values())
        return [session.agents[a] for a in agent_ids if a in session.agents]

    def _chat_context(self, session: Session) -> dict:
        return {
            'world_lore': session.world.lore_text(),
            'world_state': session.world.get_state(),
            'player_summary': session.player_summary(),
            'peer_public': session.peer_public_map(),
        }

    def process_chat(self, session: Session, message: str,
                     agent_ids: List[str] = None) -> List[dict]:
        """普通(非流式)多智能体对话"""
        selected = self._select_agents(session, agent_ids)
        if not selected:
            selected = list(session.agents.values())
        ctx = self._chat_context(session)
        player_name = session.player_name()
        store.add_message(session.id, 'user', player_name, message)

        replies = []
        other_context = ""
        for agent in selected:
            reply = agent.generate_response(
                message, ctx['world_lore'], ctx['world_state'],
                other_context, ctx['player_summary'], ctx['peer_public'])
            replies.append({"agent_id": agent.id, "name": agent.name, "content": reply})
            store.add_message(session.id, agent.id, agent.name, reply)
            other_context += f"\n{agent.name}: {reply}"
        session.world.update_world(message, [r["content"] for r in replies])
        store.touch_session(session.id)
        return replies

    def stream_chat(self, session: Session, message: str,
                    agent_ids: List[str] = None) -> Iterator[dict]:
        """
        流式多智能体对话,依次产出事件字典:
        {"type": "agent_reply", "agent_id", "name", "content"(增量)}
        {"type": "world_update", "world"}
        {"type": "done"}
        """
        selected = self._select_agents(session, agent_ids)
        if not selected:
            selected = list(session.agents.values())
        ctx = self._chat_context(session)
        player_name = session.player_name()
        store.add_message(session.id, 'user', player_name, message)

        full_replies = []
        other_context = ""
        for agent in selected:
            collected = ""
            for chunk in agent.stream_response(
                    message, ctx['world_lore'], ctx['world_state'],
                    other_context, ctx['player_summary'], ctx['peer_public']):
                collected += chunk
                yield {"type": "agent_reply", "agent_id": agent.id,
                       "name": agent.name, "content": chunk}
            full_replies.append(collected)
            store.add_message(session.id, agent.id, agent.name, collected)
            other_context += f"\n{agent.name}: {collected}"
        new_world = session.world.update_world(message, full_replies)
        store.touch_session(session.id)
        yield {"type": "world_update", "world": new_world}
        yield {"type": "done"}
