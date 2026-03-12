from pydantic import BaseModel


class SearchResponse(BaseModel):
    file_path: str
    chunk_name: str
    chunk_type: str
    chunk_text: str
    similarity: float
