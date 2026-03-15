"""Common Schemas"""

from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class User(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    created_at: datetime
    updated_at: datetime


class Study_Plan(BaseModel):
    user_id: UUID


class Study_Plan_Response(BaseModel):
    id: UUID
    title: str
    description: str
    progress: int
    created_at: datetime
    updated_at: datetime


class Sections(BaseModel):
    study_plan_id: UUID


class Sections_Response(BaseModel):
    id: int
    title: str


class Trivia(BaseModel):
    section_id: int


class Trivia_Response(BaseModel):
    id: int
    question: str
    answer: str
