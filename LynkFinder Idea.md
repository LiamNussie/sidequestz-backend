Here’s a tight architecture that matches what you described (no DB history of coords, realtime, ~500 m, online/offline).

Recommended stack
Realtime transport: WebSocket namespace (e.g. /lynkFinder) — same idea as /chat: JWT on connect, rate-limit updates server-side.

Where “online + position” lives: Redis, not Mongo.

GEOADD keyed something like lynkfinder:online with member = userId, score = lon/lat (Redis GEO API).
GEORADIUS ... 500 m to answer “who is near this user?” in O(log N + K) for small K — good enough at scale with sensible caps (e.g. max 100 results).
When user goes offline or disconnects: ZREM (and any companion keys). Nothing durable; optional short TTL hash user:{id}:meta (avatar, name) if you want map labels without touching “location history” in your main DB.
Multi-instance / horizontal scale: Redis + Socket.IO Redis adapter so every node sees the same geo set and can emit to the right sockets.

“Never saved” vs “broadcast only”
Mongo: store only a durable preference if you want (“lynkFinder enabled” in profile) — not coordinates.
Coordinates: only in Redis GEO (and optionally in-memory on the gateway for the last ping of this connection). Treat Redis as ephemeral cache, not source of truth for history: no append-only log of points, no analytics table unless you add it later on purpose.
Realtime location flow
Client sends location { lat, lng } (and maybe accuracy) on a throttled interval (e.g. 2–5 s) or when movement > 30–50 m (reduces battery and server load).

Server: validate JWT + opt-in flag (from Redis or profile bit), GEOADD, then either:

A) Push nearby snapshot to this client only (GEORADIUS around them), throttled (e.g. max every 2 s), or
B) Push deltas to clients who are in overlapping 500 m (harder; snapshot is simpler for MVP).
Heartbeat / TTL: if no update for 30–60 s, drop the user from GEOADD set (or use a Redis key with TTL that you refresh each ping) so ghosts disappear without relying on disconnect alone.

Going offline
Client emits offline or disconnect → server ZREM + stop broadcasting them.
Optionally broadcast userLeft { userId } to previous neighbors (requires knowing old cell/neighbors — easiest is periodic full nearby refresh for MVP).
Optimization checklist
Throttle updates per user (hard cap in the gateway).
Cap GEORADIUS count (COUNT) and distance (fixed 500 m).
Don’t write coords to your main DB; don’t log raw lat/lng at info level.
Auth every message; never trust client “I’m near X” without your own geo math on stored last position for that user only in Redis.
Why not “only broadcast, no store”?
Pure broadcast mesh (no shared store) doesn’t scale across servers and makes “who is within 500 m” expensive. Redis GEO is the usual compromise: not your product DB, no history, TTL + delete on offline, fast radius queries.

If you want the next step in-repo, we can add a lynkFinder gateway + Redis module (or in-memory MVP if you’re single-node only) wired the same way as chat.




==================================================================




What was implemented
Global RedisModule (REDIS client, default REDIS_URL → redis://127.0.0.1:6379).
LynkFinderModule — Socket.IO namespace /lynkFinder, JWT on connect (same token options as chat).
Ephemeral location: Redis GEOADD + per-user SET … EX ttl heartbeat (lynkfinder:geo:online / lynkfinder:hb:<userId>). No Mongo persistence of coordinates.
Radius: LYNKFINDER_RADIUS_M (default 500).
Throttle: min time between accepted updates per user (LYNKFINDER_MIN_UPDATE_INTERVAL_MS, default 3000).
Socket registry: multi-tab support — Redis entry removed only when the last socket for that user leaves / goes offline.
Client events

Emit	Body	Behavior
goOnline
none
Opt-in for this socket
goOffline
none
Remove this socket; clear Redis when last socket
updateLocation
{ lat, lng }
Requires goOnline on this socket; may return { throttled: true }

Server → client: nearby { peers }, peerLocation { userId, lat, lng }, peerLeft { userId }.
Those are three different WebSocket messages the server pushes to the client after you connect to /lynkFinder. They mean different things:

1. nearby (usually only to you)
When: Right after your updateLocation is accepted (not throttled).
Who gets it: The same socket that sent updateLocation (you).
What it is: A snapshot list of people around you right now: each entry has userId, how far they are (distanceM), and their lat / lng.
Use it to: Draw everyone on the map in one shot (or refresh the list).

2. peerLocation (to other users)
When: Someone else moves (their updateLocation was accepted).
Who gets it: Every nearby participant’s sockets (not the sender’s), so people who should see that user on the map get an update.
What it is: One user moved: { userId, lat, lng } — no full list, just “this person is now here.”
Use it to: Move one pin on the map without rebuilding everything.

3. peerLeft (to other users)
When: A user goes offline / disconnects and their presence is removed from Redis (when their last tab/socket left).
Who gets it: People who were close enough to care (neighbors computed before they were removed).
What it is: { userId } — “this person is no longer on the map.”
Use it to: Remove one pin.

Short mental model

nearby = “here’s everyone around me” (full picture for you).
peerLocation = “someone else moved.”
peerLeft = “someone else disappeared.”

Env: REDIS_URL, LYNKFINDER_RADIUS_M, LYNKFINDER_PRESENCE_TTL_SECONDS, LYNKFINDER_MIN_UPDATE_INTERVAL_MS (see configuration.ts / env.validation.ts).






==================================================

Here’s a practical way to do Redis when the API is on Render or Railway.

1. Run Redis as its own service (don’t bake it into the Nest container)
Both platforms expect: Web service = your Nest app, Redis = separate add-on or service. You only point the app at Redis with REDIS_URL.

Railway
In the same project, Add service → Database → Redis (or pick a Redis template).
Railway injects a REDIS_URL (or similar) on the Redis service; link that variable to your Nest service (Variables → reference the Redis plugin’s URL).
In your Nest service env, ensure REDIS_URL is set to that value (often redis://… or rediss://… if TLS).
Your code already reads REDIS_URL via config (redis.url).

Render
Create a Redis instance from the Render dashboard (or use a managed provider they integrate with—names change over time; look for “Redis” / “Key Value”).
Copy the Internal Redis URL for services in the same region (best: private, no public exposure).
On your Web Service → Environment, set REDIS_URL to that URL.
If Render only gives a public URL with TLS, use rediss:// and whatever port they specify.

Cross‑platform option (works on both)
Use Upstash (or Redis Cloud, etc.): create a database, copy the URL, set REDIS_URL on Render/Railway. Fine for small/medium traffic; latency depends on region—pick the same region as the API.


=======================================================
LYNK REQUESTS
=======================================================

Here’s what was added and how it fits together.

REST (JWT)
Method	Path	Purpose
GET
/lynk-requests/users/:userId/preview
name, gender, avatar (+ id) for map tap (not yourself).
GET
/lynk-requests/incoming
Pending requests to you (page, limit).
GET
/lynk-requests/outgoing
Pending requests from you.
GET
/lynk-dm/conversations/:conversationId/messages
DM history (page, limit).
WebSocket /lynkRequests (realtime requests)
Client → server	Payload
sendRequest
{ "toUserId": "<ObjectId>" }
respondToRequest
{ "requestId": "<ObjectId>", "action": "accept" | "decline" }
Server → client	Payload
lynkRequestIncoming
{ requestId, fromUser: { id, name, gender, avatar } }
lynkRequestOutcome
{ requestId, status, conversationId? (if accepted), peer: { id, name, gender, avatar } } (both parties).
On connect, the socket is registered so incoming requests can be pushed in realtime. Push + in-app also use LYNK_REQUEST_RECEIVED. On accept, the original sender gets LYNK_REQUEST_ACCEPTED (with conversationId). On decline, they get LYNK_REQUEST_DECLINED (in-app only, skipPush: true).

WebSocket /lynkDm (1:1 chat after accept)
Client → server	Payload
joinDm
{ "conversationId": "<ObjectId>" }
leaveDm
{ "conversationId": "<ObjectId>" }
sendDmMessage
{ "conversationId": "<ObjectId>", "text": "…" }
Server → client	Payload
dmNewMessage
{ id, conversationId, senderId, body, createdAt }
Accept creates or reuses a LynkDmConversation (two participants, sorted, unique). Messages live in LynkDmMessage (Mongo only; not Lynkup chat).

Data / rules
One pending request per ordered pair (from → to): partial unique index on pending.
No new request if a DM conversation already exists between the two users.
Mongo duplicate 11000 → conflict “pending request already exists…”.
Files / wiring
LynkRequestsModule registered in AppModule. Notification types: lynk_request_received, lynk_request_accepted, lynk_request_declined.

Connect to /lynkRequests while on the map flow, and to /lynkDm when chatting; use the conversationId from lynkRequestOutcome after accept.