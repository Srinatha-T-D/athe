from fastapi import (
    FastAPI,
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
    Depends,
    HTTPException,
    Query,
    Header,
    UploadFile,
    File,
    Request,
)
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import json
import asyncio
import bcrypt
import jwt
import redis.asyncio as aioredis
import boto3
from botocore.exceptions import ClientError
from io import BytesIO
from PIL import Image, UnidentifiedImageError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ["JWT_ALGORITHM"]

# Redis is required to fan messages out correctly once there is more than one
# backend replica (see k8s/10-backend-deployment.yaml, which runs 2-8 pods).
# Without it, two users connected to different pods can't message each other.
# Falls back to pure in-memory delivery when unset, which is only safe for a
# single-replica / local dev setup (see docker-compose.yml).
REDIS_URL = os.environ.get("REDIS_URL")
REDIS_CHANNEL = "athe:ws:events"
redis_client = (
    aioredis.from_url(REDIS_URL, decode_responses=True) if REDIS_URL else None
)

# ---- Media (image / gif / audio) upload config ----
# Video is intentionally never in ALLOWED_MEDIA_TYPES - the app supports
# images, gifs, and short audio clips only, not video.
S3_BUCKET = os.environ.get("S3_BUCKET")
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
# Local-disk fallback so `docker compose up` works without any AWS
# credentials configured; set S3_BUCKET in production (see k8s/02-configmap.yaml).
LOCAL_MEDIA_DIR = ROOT_DIR / "media_uploads"
s3_client = boto3.client("s3", region_name=AWS_REGION) if S3_BUCKET else None

MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB
MAX_AUDIO_BYTES = 15 * 1024 * 1024  # 15 MB

ALLOWED_MEDIA_TYPES = {
    "image/jpeg": ("image", ".jpg"),
    "image/png": ("image", ".png"),
    "image/gif": ("image", ".gif"),
    "image/webp": ("image", ".webp"),
    "audio/mpeg": ("audio", ".mp3"),
    "audio/wav": ("audio", ".wav"),
    "audio/x-wav": ("audio", ".wav"),
    "audio/ogg": ("audio", ".ogg"),
    "audio/mp4": ("audio", ".m4a"),
    "audio/x-m4a": ("audio", ".m4a"),
}

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

if not S3_BUCKET:
    LOCAL_MEDIA_DIR.mkdir(exist_ok=True)
    app.mount("/media", StaticFiles(directory=str(LOCAL_MEDIA_DIR)), name="media")


# ---- Pydantic Models ----
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    place: str
    gender: str
    country: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GuestRequest(BaseModel):
    name: str
    place: str
    gender: str
    country: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    place: Optional[str] = None
    gender: Optional[str] = None
    country: Optional[str] = None


class RoomCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class MessageSend(BaseModel):
    content: str
    receiver_id: Optional[str] = None
    room_id: Optional[str] = None


# ---- Utility Functions ----
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_token(user_id: str, is_guest: bool = False) -> str:
    payload = {
        "user_id": user_id,
        "is_guest": is_guest,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(token: str = Query(None)):
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Update last_active
    await db.users.update_one(
        {"id": payload["user_id"]},
        {
            "$set": {
                "last_active": datetime.now(timezone.utc).isoformat(),
                "is_online": True,
            }
        },
    )
    return user


def get_user_from_header(authorization: str = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")
    token = authorization.split(" ")[1]
    return decode_token(token)


# ---- Health Endpoints ----
# /api/health: cheap liveness check - process is up and serving requests.
# /api/health/ready: readiness check - dependencies (DB, Redis) are reachable,
# used by the k8s readinessProbe to decide whether to route traffic to a pod.
@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/health/ready")
async def health_ready():
    try:
        await client.admin.command("ping")
    except Exception as e:
        logger.error(f"Readiness check failed - MongoDB unreachable: {e}")
        raise HTTPException(status_code=503, detail="database unavailable")
    if redis_client:
        try:
            await redis_client.ping()
        except Exception as e:
            logger.error(f"Readiness check failed - Redis unreachable: {e}")
            raise HTTPException(status_code=503, detail="redis unavailable")
    return {"status": "ready"}


# ---- Auth Routes ----
@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": req.email,
        "password_hash": hash_password(req.password),
        "name": req.name,
        "place": req.place,
        "gender": req.gender,
        "country": req.country,
        "is_guest": False,
        "is_online": True,
        "last_active": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_token(user_id)
    user_response = {k: v for k, v in user.items() if k not in ["_id", "password_hash"]}
    return {"token": token, "user": user_response}


@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "is_online": True,
                "last_active": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    token = create_token(user["id"])
    user_response = {k: v for k, v in user.items() if k not in ["_id", "password_hash"]}
    return {"token": token, "user": user_response}


@api_router.post("/auth/guest")
async def guest_login(req: GuestRequest):
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": None,
        "password_hash": None,
        "name": req.name,
        "place": req.place,
        "gender": req.gender,
        "country": req.country,
        "is_guest": True,
        "is_online": True,
        "last_active": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_token(user_id, is_guest=True)
    user_response = {k: v for k, v in user.items() if k not in ["_id", "password_hash"]}
    return {"token": token, "user": user_response}


@api_router.get("/auth/me")
async def get_current_profile(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    user = await db.users.find_one(
        {"id": payload["user_id"]}, {"_id": 0, "password_hash": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one(
        {"id": payload["user_id"]},
        {
            "$set": {
                "last_active": datetime.now(timezone.utc).isoformat(),
                "is_online": True,
            }
        },
    )
    return {"user": user}


@api_router.put("/auth/profile")
async def update_profile(req: ProfileUpdate, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if updates:
        updates["last_active"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": payload["user_id"]}, {"$set": updates})
    user = await db.users.find_one(
        {"id": payload["user_id"]}, {"_id": 0, "password_hash": 0}
    )
    return {"user": user}


@api_router.post("/auth/logout")
async def logout(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return {"message": "Logged out"}
    token = authorization.split(" ")[1]
    try:
        payload = decode_token(token)
        await db.users.update_one(
            {"id": payload["user_id"]}, {"$set": {"is_online": False}}
        )
    except Exception:
        pass
    return {"message": "Logged out"}


# ---- Users Routes ----
@api_router.get("/users")
async def list_users(
    authorization: str = Header(None),
    gender: Optional[str] = None,
    place: Optional[str] = None,
    country: Optional[str] = None,
    online_only: Optional[bool] = None,
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    current_user_id = payload["user_id"]

    query = {}
    if gender:
        query["gender"] = {"$regex": gender, "$options": "i"}
    if place:
        query["place"] = {"$regex": place, "$options": "i"}
    if country:
        query["country"] = {"$regex": country, "$options": "i"}
    if online_only:
        query["is_online"] = True

    users = await db.users.find(
        query, {"_id": 0, "password_hash": 0, "email": 0}
    ).to_list(200)
    # Exclude current user from list
    users = [u for u in users if u["id"] != current_user_id]

    # Get unread counts per sender for the current user
    unread_pipeline = [
        {"$match": {"receiver_id": current_user_id, "is_read": False, "room_id": None}},
        {"$group": {"_id": "$sender_id", "count": {"$sum": 1}}},
    ]
    unread_cursor = db.messages.aggregate(unread_pipeline)
    unread_map = {}
    async for doc in unread_cursor:
        unread_map[doc["_id"]] = doc["count"]

    # Attach unread_count to each user
    for u in users:
        u["unread_count"] = unread_map.get(u["id"], 0)

    total_count = len(users)
    return {"users": users, "total_count": total_count}


@api_router.get("/users/{user_id}")
async def get_user(user_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    decode_token(authorization.split(" ")[1])
    user = await db.users.find_one(
        {"id": user_id}, {"_id": 0, "password_hash": 0, "email": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


# ---- Rooms Routes ----
@api_router.get("/rooms")
async def list_rooms(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    decode_token(authorization.split(" ")[1])
    rooms = await db.rooms.find({}, {"_id": 0}).to_list(100)
    return {"rooms": rooms}


@api_router.post("/rooms")
async def create_room(req: RoomCreate, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    payload = decode_token(authorization.split(" ")[1])
    room_id = str(uuid.uuid4())
    room = {
        "id": room_id,
        "name": req.name,
        "description": req.description,
        "created_by": payload["user_id"],
        "members": [payload["user_id"]],
        "is_predefined": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rooms.insert_one(room)
    room_response = {k: v for k, v in room.items() if k != "_id"}
    return {"room": room_response}


@api_router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    payload = decode_token(authorization.split(" ")[1])
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if payload["user_id"] not in room.get("members", []):
        await db.rooms.update_one(
            {"id": room_id}, {"$addToSet": {"members": payload["user_id"]}}
        )
    return {"message": "Joined room"}


@api_router.get("/rooms/{room_id}")
async def get_room(room_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    decode_token(authorization.split(" ")[1])
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    # Get member details
    members = await db.users.find(
        {"id": {"$in": room.get("members", [])}},
        {"_id": 0, "password_hash": 0, "email": 0},
    ).to_list(100)
    room["member_details"] = members
    return {"room": room}


# ---- Messages Routes ----
@api_router.get("/messages/{other_user_id}")
async def get_dm_messages(other_user_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    payload = decode_token(authorization.split(" ")[1])
    user_id = payload["user_id"]
    messages = (
        await db.messages.find(
            {
                "room_id": None,
                "$or": [
                    {"sender_id": user_id, "receiver_id": other_user_id},
                    {"sender_id": other_user_id, "receiver_id": user_id},
                ],
            },
            {"_id": 0},
        )
        .sort("timestamp", 1)
        .to_list(500)
    )
    # Mark as read
    await db.messages.update_many(
        {"sender_id": other_user_id, "receiver_id": user_id, "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {"messages": messages}


@api_router.get("/rooms/{room_id}/messages")
async def get_room_messages(room_id: str, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    decode_token(authorization.split(" ")[1])
    messages = (
        await db.messages.find({"room_id": room_id}, {"_id": 0})
        .sort("timestamp", 1)
        .to_list(500)
    )
    return {"messages": messages}


@api_router.get("/messages/unread/count")
async def get_unread_count(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    payload = decode_token(authorization.split(" ")[1])
    count = await db.messages.count_documents(
        {"receiver_id": payload["user_id"], "is_read": False, "room_id": None}
    )
    return {"unread_count": count}


# ---- Heartbeat for session ----
@api_router.post("/heartbeat")
async def heartbeat(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    payload = decode_token(authorization.split(" ")[1])
    await db.users.update_one(
        {"id": payload["user_id"]},
        {
            "$set": {
                "last_active": datetime.now(timezone.utc).isoformat(),
                "is_online": True,
            }
        },
    )
    return {"status": "alive"}


# ---- Media upload (images, gifs, audio only - no video) ----
@api_router.post("/media/upload")
async def upload_media(
    request: Request, file: UploadFile = File(...), authorization: str = Header(None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token")
    payload = decode_token(authorization.split(" ")[1])
    user_id = payload["user_id"]

    declared_type = (file.content_type or "").lower()
    if declared_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Only images, gifs, and audio clips are allowed (no video).",
        )
    category, ext = ALLOWED_MEDIA_TYPES[declared_type]
    size_limit = MAX_IMAGE_BYTES if category == "image" else MAX_AUDIO_BYTES

    body = await file.read()
    if len(body) > size_limit:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size for {category} is {size_limit // (1024*1024)}MB.",
        )
    if len(body) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Defends against a renamed/mislabeled file (e.g. a video renamed to
    # .jpg) by actually decoding it as the claimed type rather than trusting
    # the client-supplied Content-Type header alone.
    if category == "image":
        try:
            img = Image.open(BytesIO(body))
            img.verify()
        except UnidentifiedImageError:
            raise HTTPException(status_code=400, detail="File is not a valid image")
        except Exception:
            raise HTTPException(status_code=400, detail="File is not a valid image")

    key = f"uploads/{user_id}/{uuid.uuid4()}{ext}"

    if s3_client:
        try:
            s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=key,
                Body=body,
                ContentType=declared_type,
            )
            url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"
        except ClientError as e:
            logger.error(f"S3 upload failed: {e}")
            raise HTTPException(
                status_code=502, detail="Upload failed, please try again"
            )
    else:
        local_path = LOCAL_MEDIA_DIR / key.replace("uploads/", "")
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(body)
        # Must be an absolute URL, not a relative one: the frontend
        # (localhost:3000) and backend (localhost:8000) are different
        # origins in local dev, so a relative "/media/..." path would
        # resolve against the frontend's origin instead of the backend's,
        # where the file actually lives, and 404 there.
        url = f"{str(request.base_url).rstrip('/')}/media/{key.replace('uploads/', '')}"

    return {
        "url": url,
        "attachment_type": category,
        "attachment_name": file.filename,
        "size": len(body),
    }


# ---- Seed predefined rooms ----
@app.on_event("startup")
async def seed_rooms():
    # Create indexes before seeding: with more than one gunicorn/uvicorn
    # worker process (WEB_CONCURRENCY > 1), every worker runs this startup
    # hook independently and concurrently. Creating the unique index first
    # means MongoDB itself rejects any duplicate insert at the database
    # level, so the upsert below is race-safe regardless of worker count.
    await db.users.create_index("id", unique=True)
    await db.messages.create_index(
        [("sender_id", 1), ("receiver_id", 1), ("timestamp", 1)]
    )
    await db.messages.create_index("room_id")
    await db.rooms.create_index("id", unique=True)

    predefined = [
        {
            "id": "room-general",
            "name": "General",
            "description": "Chat about anything",
            "created_by": "system",
            "members": [],
            "is_predefined": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": "room-tech",
            "name": "Tech Talk",
            "description": "Technology discussions",
            "created_by": "system",
            "members": [],
            "is_predefined": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": "room-fun",
            "name": "Fun Zone",
            "description": "Memes, jokes & good vibes",
            "created_by": "system",
            "members": [],
            "is_predefined": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": "room-music",
            "name": "Music Lounge",
            "description": "Share and discuss music",
            "created_by": "system",
            "members": [],
            "is_predefined": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]
    for room in predefined:
        # Atomic upsert instead of find-then-insert: two workers racing to
        # seed the same room simply upsert the same document instead of
        # both trying to insert a duplicate.
        await db.rooms.update_one(
            {"id": room["id"]},
            {"$setOnInsert": room},
            upsert=True,
        )
    logger.info("Predefined rooms seeded")

    if redis_client:
        manager._pubsub_task = asyncio.create_task(manager.start_pubsub_listener())
    else:
        logger.warning(
            "REDIS_URL not set - WebSocket delivery will only work correctly "
            "with a single backend replica."
        )


# ---- WebSocket Connection Manager ----
# With multiple backend replicas (see HPA, minReplicas=2), a user's WebSocket
# may be held by any pod. Delivery therefore never assumes the recipient is
# connected to *this* process: every outbound message is published on a
# shared Redis channel, and every pod (including the sender's) is subscribed
# to it and only actually writes to the socket if it happens to be holding
# that user's connection locally. Without REDIS_URL set, it degrades to
# direct in-memory delivery, which only works correctly with a single replica.
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}  # user_id -> WebSocket
        self._pubsub_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "is_online": True,
                    "last_active": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        await self.broadcast_status(user_id, True)

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)

    async def _write_local(self, user_id: str, payload: dict) -> bool:
        conn = self.active_connections.get(user_id)
        if not conn:
            return False
        try:
            await conn.send_text(json.dumps(payload))
            return True
        except Exception:
            return False

    async def send_personal(self, user_id: str, message: dict):
        if redis_client:
            envelope = {"kind": "direct", "target_user_id": user_id, "payload": message}
            await redis_client.publish(REDIS_CHANNEL, json.dumps(envelope))
        else:
            await self._write_local(user_id, message)

    async def broadcast_status(self, user_id: str, is_online: bool):
        message = {"type": "status", "user_id": user_id, "is_online": is_online}
        if redis_client:
            envelope = {
                "kind": "broadcast",
                "exclude_user_id": user_id,
                "payload": message,
            }
            await redis_client.publish(REDIS_CHANNEL, json.dumps(envelope))
        else:
            for uid in list(self.active_connections.keys()):
                if uid != user_id:
                    await self._write_local(uid, message)

    async def send_to_room(self, room_id: str, message: dict, exclude_user: str = None):
        room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
        if room:
            for member_id in room.get("members", []):
                if member_id != exclude_user:
                    await self.send_personal(member_id, message)

    async def start_pubsub_listener(self):
        """Runs for the lifetime of the process, delivering messages published
        by any pod (including this one) to locally-held connections."""
        if not redis_client:
            return
        backoff = 1
        while True:
            try:
                pubsub = redis_client.pubsub()
                await pubsub.subscribe(REDIS_CHANNEL)
                logger.info("Subscribed to Redis pub/sub channel for WebSocket fan-out")
                backoff = 1
                async for message in pubsub.listen():
                    if message.get("type") != "message":
                        continue
                    try:
                        envelope = json.loads(message["data"])
                    except (TypeError, ValueError):
                        continue
                    if envelope.get("kind") == "broadcast":
                        exclude = envelope.get("exclude_user_id")
                        for uid in list(self.active_connections.keys()):
                            if uid != exclude:
                                await self._write_local(uid, envelope["payload"])
                    else:
                        target = envelope.get("target_user_id")
                        if target:
                            await self._write_local(target, envelope["payload"])
            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(
                    f"Redis pub/sub listener error, reconnecting in {backoff}s: {e}"
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30)


manager = ConnectionManager()


@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket, user_id: str, token: str = Query(None)
):
    if not token:
        await websocket.close(code=4001)
        return
    try:
        payload = decode_token(token)
        if payload["user_id"] != user_id:
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            msg_data = json.loads(data)

            if msg_data.get("type") == "dm":
                # Direct message
                message = {
                    "id": str(uuid.uuid4()),
                    "sender_id": user_id,
                    "receiver_id": msg_data["receiver_id"],
                    "room_id": None,
                    "content": msg_data.get("content", ""),
                    "attachment_url": msg_data.get("attachment_url"),
                    "attachment_type": msg_data.get("attachment_type"),
                    "attachment_name": msg_data.get("attachment_name"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "is_read": False,
                    "sender_name": msg_data.get("sender_name", "Unknown"),
                }
                await db.messages.insert_one(message)
                msg_response = {k: v for k, v in message.items() if k != "_id"}
                msg_response["type"] = "dm"
                # Send to receiver
                await manager.send_personal(msg_data["receiver_id"], msg_response)
                # Send back to sender for confirmation
                await manager.send_personal(user_id, msg_response)

            elif msg_data.get("type") == "room":
                # Room message
                message = {
                    "id": str(uuid.uuid4()),
                    "sender_id": user_id,
                    "receiver_id": None,
                    "room_id": msg_data["room_id"],
                    "content": msg_data.get("content", ""),
                    "attachment_url": msg_data.get("attachment_url"),
                    "attachment_type": msg_data.get("attachment_type"),
                    "attachment_name": msg_data.get("attachment_name"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "is_read": False,
                    "sender_name": msg_data.get("sender_name", "Unknown"),
                }
                await db.messages.insert_one(message)
                msg_response = {k: v for k, v in message.items() if k != "_id"}
                msg_response["type"] = "room"
                await manager.send_to_room(msg_data["room_id"], msg_response)

            elif msg_data.get("type") == "typing":
                # Typing indicator
                if msg_data.get("receiver_id"):
                    await manager.send_personal(
                        msg_data["receiver_id"],
                        {
                            "type": "typing",
                            "user_id": user_id,
                            "sender_name": msg_data.get("sender_name", ""),
                        },
                    )

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await db.users.update_one({"id": user_id}, {"$set": {"is_online": False}})
        await manager.broadcast_status(user_id, False)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(user_id)
        await db.users.update_one({"id": user_id}, {"$set": {"is_online": False}})
        await manager.broadcast_status(user_id, False)


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    if manager._pubsub_task:
        manager._pubsub_task.cancel()
        try:
            await manager._pubsub_task
        except asyncio.CancelledError:
            pass
    if redis_client:
        await redis_client.close()
    client.close()
