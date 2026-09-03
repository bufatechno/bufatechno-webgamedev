# Multiplayer Networking — Web Games

Client prediction, server reconciliation, entity interpolation, lag compensation. For browser FPS/voxel/RPG.

## 1. Architecture Choice

| Model | Use when | Stack |
|---|---|---|
| **Authoritative server** | Competitive FPS, anti-cheat needed | Node.js + `ws` / `colyseus` / `geckos.io`, 20 Hz tick |
| **Peer P2P** | Coop 2-4 players, low cost | WebRTC `peerjs`, `trystero` |
| **Relay / rollback** | Fighting, lockstep | `ggpo` concept ported JS |

Default for skill: **authoritative WebSocket server (Node ws) + client prediction**.

## 2. Message Protocol

```js
// Shared — minimal binary-friendly JSON
// Client → Server: {t, seq, input:{up,down,left,right,fire, yaw,pitch}}
// Server → Client: {t, state:{players:[{id,x,y,z,yaw,health}], projectiles:[], events:[]}}
const WS_URL = (location.protocol==='https:'?'wss:':'ws:')+'//'+location.host;
const ws = new WebSocket(WS_URL);
ws.onmessage = (e)=>{
  const msg = JSON.parse(e.data);
  if(msg.state) applyServerState(msg);
};
function sendInput(seq, input){
  ws.send(JSON.stringify({seq, input, t: performance.now()}));
}
```

## 3. Client Prediction + Reconciliation (FPS)

```js
let seq=0;
const pendingInputs=[]; // {seq, input, dt}
const serverStateQueue=[];

function updateClient(STEP){
  // Capture input
  const input = sampleInput(); // {move:{x,z}, yaw, pitch, fire}
  pendingInputs.push({seq, input, dt:STEP});
  sendInput(seq, input);
  // Predict
  applyInput(player, input, STEP);
  physicsStep(STEP);
  seq++;
}

function applyServerState(msg){
  // Server is authoritative — rewind & replay
  const server = msg.state;
  // Snap to server pos
  player.position.copy(server.players[myId].pos);
  player.velocity.copy(server.players[myId].vel);
  // Discard acked inputs
  const ack = msg.ackSeq;
  while(pendingInputs.length && pendingInputs[0].seq <= ack) pendingInputs.shift();
  // Replay remaining
  for(const p of pendingInputs){
    applyInput(player, p.input, p.dt);
    physicsStep(p.dt);
  }
  // Interpolate other players
  otherPlayers.forEach(p=> p.targetPos.copy(server.players[p.id].pos));
}
```

## 4. Entity Interpolation (Other Players)

```js
function updateOthers(delta){
  otherPlayers.forEach(p=>{
    p.position.lerp(p.targetPos, 1 - Math.pow(0.01, delta*60)); // exponential
    p.quaternion.slerp(p.targetQuat, 0.2);
  });
}
// Add jitter buffer: queue server states 100ms behind, interpolate between two snapshots
const BUFFER_MS=100;
function getInterpolatedState(renderTime){
  // Find two server snapshots around renderTime
}
```

## 5. Lag Compensation (Hitscan)

Server rewinds target positions to `t - ping/2`:

```js
// Server stores history: player pos per tick (ring buffer 1s)
function serverHitscan(shooterId, origin, dir, t){
  const ping = clients[shooterId].ping;
  const rewindT = t - ping/2;
  const targetPos = history.interpolate(shooterId, rewindT); // or victim history
  const hit = raycast(origin, dir, targetPos);
  if(hit) broadcast({event:'hit', victim:hit.id, damage:25});
}
```

Client also predicts hit VFX immediately for responsiveness, server validates.

## 6. Tick Rates & Bandwidth

- Server tick 20 Hz (50ms), client render 60 Hz — send input 20 Hz, interpolate.
- Compress: quantize pos `Math.round(x*100)/100`, yaw `Math.round(yaw*127/Math.PI)`, bitmask input.
- Use `ArrayBuffer` + `DataView` if >32 players.
- `navigator.connection.effectiveType` to adapt: `4g` → 20 Hz, `3g` → 10 Hz.

## 7. Lobbies & Rooms (Colyseus example)

```js
// Server: npm i colyseus @colyseus/ws-transport
import { Server, Room } from 'colyseus';
class GameRoom extends Room {
  onCreate(){ this.setState({players:new Map()}); this.onMessage("input",(c,msg)=>{ this.state.players.get(c.sessionId).queue.push(msg); }); }
  onJoin(c){ this.state.players.set(c.sessionId,{x:0,y:1.7,z:0}); }
  onLeave(c){ this.state.players.delete(c.sessionId); }
}
// Client: import * as Colyseus from 'colyseus.js'; const client=new Colyseus.Client(WS_URL); const room=await client.joinOrCreate("game");
```

## 8. Cheat Prevention Checklist

- [ ] Server authoritative position — never trust client `pos`.
- [ ] Rate-limit inputs (ignore >30/sec).
- [ ] Validate speed: `distance / dt < MAX_SPEED*1.2`.
- [ ] Hitscan validated server-side via rewind.
- [ ] No sensitive logic in client (damage, inventory).

## 9. Fallback for Skill One-Shot

If user wants multiplayer but no server file allowed:
- Use `BroadcastChannel` for local multi-tab demo.
- Or WebRTC `trystero` (tracker-based, no server) — 1 line host+join.
- Document: "One-shot deliverable uses local prediction + mock server in `src/systems/Net.js` — replace with real `ws` for deploy".

## 10. Deployment

- Host server on Fly.io / Railway / Cloudflare Workers (WebSocket).
- Client static on Vercel/Netlify — env `VITE_WS_URL=wss://...`.
- Add `public/manifest.json` + `ws` reconnect logic with exponential backoff.
