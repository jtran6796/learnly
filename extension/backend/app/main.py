from argon2 import PasswordHasher
from dotenv import load_dotenv
from fastapi import FastAPI
import os
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv("../.env")
app = FastAPI()
engine = create_async_engine(os.getenv("DATABASE_URL"))
ph = PasswordHasher()


class UserCreate(BaseModel):
    email: str
    password: str


@app.post("/users")
async def create_user(user: UserCreate) -> None:
    hashed_password = ph.hash(user.password)
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                INSERT INTO users(email, hash_password)
                VALUES (:email, :hash_password)
                RETURNING *
        """),
            {"email": user.email, "hash_password": hashed_password},
        )
        await conn.commit()
        new_user = result.first()
        return {"user": dict(new_user._mapping)}
