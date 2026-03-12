import asyncio
from backend.app.db import AsyncSessionLocal
from backend.app.core.security import hash_password
from sqlalchemy import text


async def reset():
    h = hash_password("arma1234")
    async with AsyncSessionLocal() as db:
        await db.execute(
            text("UPDATE users SET hashed_password=:h WHERE email='allenbobby2003@gmail.com'"),
            {"h": h},
        )
        await db.commit()
    print("Done, hash prefix:", h[:20])


asyncio.run(reset())
