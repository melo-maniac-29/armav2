from pydantic import BaseModel
from datetime import datetime


class IssueOut(BaseModel):
    id: str
    repo_id: str
    run_id: str
    file_path: str
    line_number: int | None
    severity: str
    issue_type: str
    title: str
    description: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class IssuePatchRequest(BaseModel):
    status: str  # open | dismissed


class AnalysisSummary(BaseModel):
    total: int
    by_severity: dict[str, int]
    run_id: str | None


class IssueListResponse(BaseModel):
    issues: list[IssueOut]
    total: int
    by_severity: dict[str, int]
