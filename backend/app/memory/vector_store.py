# 长期记忆 (ChromaDB, 按存档隔离)
import hashlib
import uuid
from pathlib import Path

import numpy as np
from chromadb import EmbeddingFunction

import chromadb

DATA_DIR = Path(__file__).parent.parent.parent / 'data'
CHROMA_PATH = DATA_DIR / 'chroma_db'
CHROMA_PATH.mkdir(parents=True, exist_ok=True)

DIM = 128


class HashEmbeddingFunction(EmbeddingFunction):
    """轻量离线哈希嵌入函数(避免下载 ONNX 模型)"""

    def __call__(self, input):
        result = []
        for doc in input:
            vec = np.zeros(DIM, dtype=np.float32)
            for token in doc.split():
                h = hashlib.md5(token.encode("utf-8")).digest()
                idx = int.from_bytes(h[:2], "big") % DIM
                vec[idx] += 1.0 if h[2] % 2 == 0 else -1.0
            result.append(vec)
        return result


client = chromadb.PersistentClient(path=str(CHROMA_PATH))
_embedding_fn = HashEmbeddingFunction()


def _coll_name(sid: str, agent_id: str) -> str:
    """ChromaDB 集合名仅允许 [a-zA-Z0-9._-],中文角色名需哈希"""
    h = hashlib.md5(agent_id.encode('utf-8')).hexdigest()[:8]
    return f"{sid}__{h}"


def get_collection(sid: str, agent_id: str):
    return client.get_or_create_collection(name=_coll_name(sid, agent_id),
                                           embedding_function=_embedding_fn)


def add_memory(sid: str, agent_id: str, text: str, metadata: dict = None):
    coll = get_collection(sid, agent_id)
    doc_id = str(uuid.uuid4())
    coll.add(
        documents=[text],
        metadatas=[metadata] if metadata is not None else [{}],
        ids=[doc_id],
    )


def search_memories(sid: str, agent_id: str, query: str, n_results: int = 5):
    coll = get_collection(sid, agent_id)
    results = coll.query(query_texts=[query], n_results=n_results)
    if results and results['documents']:
        return results['documents'][0]
    return None


def delete_session_collections(sid: str):
    try:
        for c in client.list_collections():
            if c.name.startswith(f"{sid}__"):
                client.delete_collection(c.name)
    except Exception as e:
        print(f"删除存档向量集合失败: {e}")
