from pydantic import BaseModel


class GithubRepoItem(BaseModel):
    id: int  # GitHub's internal repo ID
    full_name: str
    description: str | None
    private: bool
    default_branch: str
    clone_url: str
    stargazers_count: int
    language: str | None
    updated_at: str | None
