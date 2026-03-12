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


class PrJobOut(BaseModel):
    id: str
    repo_id: str
    issue_id: str
    branch_name: str | None
    patch_text: str | None
    status: str
    error_msg: str | None
    sandbox_log: str | None
    sandbox_result: str | None
    github_pr_number: int | None
    github_pr_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PrJobListResponse(BaseModel):
    jobs: list[PrJobOut]
    total: int


class FeatureRequestOut(BaseModel):
    id: str
    repo_id: str
    user_id: str
    description: str
    branch_name: str | None
    plan_json: str | None
    patches_json: str | None
    status: str
    error_msg: str | None
    sandbox_log: str | None
    sandbox_result: str | None
    github_pr_number: int | None
    github_pr_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FeatureRequestListResponse(BaseModel):
    requests: list[FeatureRequestOut]
    total: int
