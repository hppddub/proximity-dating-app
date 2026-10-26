# Experimental encounter protocol v1

This protocol identifies enrolled test installations. It does not prove distance,
human identity, conversation, or resistance to a live relay. No real profiles.

Service: `7b9e1000-29c4-4a91-8c65-66d9384a1000`.
HELLO write: `7b9e1001-29c4-4a91-8c65-66d9384a1000`.
REPLY read: `7b9e1002-29c4-4a91-8c65-66d9384a1000`.
FINISH write: `7b9e1003-29c4-4a91-8c65-66d9384a1000`.

All messages are compact UTF-8 JSON. Exchange uses framed chunks compatible with
the negotiated ATT payload: writes are `[sequence byte][last byte][data]`, starting
at sequence 0; maximum message 4096 bytes and 30 seconds. REPLY is read using normal
GATT long reads with offsets. A new HELLO replaces the previous per-peer exchange.
Never log Bluetooth addresses; use them only as ephemeral in-memory transport keys.

An enrolled installation receives a random API bearer token and a distinct 32-byte
hex proof key. Store these in OS secure storage. The server issues minute-slot
random aliases covering the 30-minute session, so a locked device can rotate
locally without a periodic network wakeup. Aliases expire with their slots plus
30 seconds of tolerance. Fixed service membership remains observable.

HELLO: `{alias,nonce,at}`. `nonce` is 16 random bytes lowercase hex; `at` is Unix ms.
REPLY: `{alias,nonce,at,sig}`. Central is side A, peripheral B.
Transcript is exactly UTF-8:
`v1|aliasA|aliasB|nonceA|nonceB|atA|atB`.
Each side signs with HMAC-SHA256 using its own proof key; sig is lowercase hex.
FINISH and POST `/v1/encounters` use:
`{a:HELLO,b:REPLY,sigA}`.
The peripheral and central can each submit the same proof. The server verifies
both signatures, alias slots, session membership, timestamp freshness (30 seconds),
and nonce replay. Receipt time is authoritative for dwell; an identical proof never
extends freshness or dwell. This trusts the controlled clients' timestamps and
does not protect against colluding enrolled devices fabricating proximity.

Repeat a complete exchange about every 10 seconds while the OS allows it. Dwell
requires multiple independent proofs spanning 30 seconds, with no gap above 30
seconds. A connection kept alive forever is not a supported background strategy.
Mark unsupported refresh/lifecycle behavior in findings rather than simulating it.

API uses bearer auth except health, invite redemption and loopback demo routes.
Session aliases are never a public lookup key. Offers and profiles require account
authorization. Generic push contains only an offer reference and expiry. Local
diagnostic alerts and loopback simulation are separate from remote push evidence.

Diagnostics: `{v:1,at,event,trial?,build?,detail?}` JSONL, no keys, tokens, names,
addresses or coordinates. Raw diagnostics expire after seven days. Observer trial
records describe entry/departure and display times independently of radio events.
