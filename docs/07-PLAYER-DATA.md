# Player Data

## What's Available

| Available | NOT Available |
|-----------|---------------|
| Mastery rank | Platinum balance |
| Clan name + tier | Mod configurations |
| Total kills, deaths, playtime | Warframe color palettes |
| Top weapons by kills/equip time | Market transaction history |
| Items with XP (approximate inventory) | Kuva/Endo/resource balances |
| Syndicate standing per faction | Friend lists / alliance info |
| Active loadout (equipped gear, no mods) | Real-time session data |
| Intrinsic levels (Railjack + Drifter) | Riven mod stats (only market price data available) |
| Death marks | Private messages |
| Account creation date | |

---

## API Endpoint

**URL:** `https://api.warframestat.us/profile/{username}/stats`

- Proxies DE's raw endpoint and normalizes the response.
- **Case-sensitive usernames.**
- Returns 404 for nonexistent or private profiles. Cannot distinguish the two.
- Timeout: set your client to **10 seconds**. DE's endpoint is slow (3–8s typical).
- Cache for 5 minutes (`TTL.PROFILE`).

DO NOT call `https://content.warframe.com/dynamic/getProfileViewingData.php` directly — inconsistent structure, not recommended.

---

## Response Schema

```json
{
  "displayName": "TennoBoss",
  "playerLevel": 28,
  "guildName": "Void Hunters",
  "guildTier": "Storm",
  "accountCreated": "2018-04-12T00:00:00.000Z",
  "deathMarks": ["/Lotus/Types/Enemies/Corpus/StalkerCorpus"],

  "activePreset": {
    "suit": "/Lotus/Powersuits/Wisp/WispPrime",
    "longGun": "/Lotus/Weapons/Tenno/LongGuns/FelarxPrime/FelarxPrime",
    "pistol": "/Lotus/Weapons/Tenno/Pistols/Laetum/Laetum",
    "melee": "/Lotus/Weapons/Tenno/Melee/Praedos/Praedos",
    "focus": "AP_PRECEPT"
  },

  "loadout": {
    "suits": [{ "uniqueName": "/Lotus/Powersuits/Wisp/WispPrime", "xp": 900000, "polarized": 6 }],
    "longGuns": [...],
    "pistols": [...],
    "melees": [...]
  },

  "xpInfo": [
    { "uniqueName": "/Lotus/Powersuits/Wisp/WispPrime", "xp": 900000 },
    { "uniqueName": "/Lotus/Weapons/Tenno/LongGuns/FelarxPrime/FelarxPrime", "xp": 450000 }
  ],

  "syndicates": [
    { "tag": "SteelMeridianSyndicate", "title": 5, "standing": 125000 },
    { "tag": "NewLokaSyndicate", "title": 2, "standing": 12400 }
  ],

  "intrinsics": {
    "Piloting": 10, "Gunnery": 10, "Engineering": 10, "Tactical": 10, "Command": 10,
    "Combat": 10, "Riding": 10, "Opportunity": 8, "Endurance": 7
  },

  "stats": {
    "secondsPlayed": 8424000,
    "missionsCompleted": 15847,
    "missionsQuit": 312,
    "missionsFailed": 89,
    "totalKills": 8432150,
    "totalDeaths": 4821,
    "totalRevived": 11204,
    "creditsTotal": 2847392000,
    "weaponList": [
      {
        "type": "/Lotus/Weapons/Tenno/LongGuns/FelarxPrime/FelarxPrime",
        "xp": 450000, "kills": 892450, "headshots": 109971, "equiptime": 1224000
      }
    ],
    "enemyList": [{ "type": "/Lotus/Types/Enemies/Grineer/Grunts/GrineerLancer", "kills": 842150 }],
    "abilityUseList": [{ "uniqueName": "/Lotus/Powersuits/Wisp/WispAbility4", "used": 48200 }]
  }
}
```

---

## XPInfo: "Approximate Inventory"

`xpInfo` = every item the player has ever gained XP on.

**What it IS NOT:**
- Does not confirm current ownership (item may have been sold).
- Not a complete inventory (items with 0 XP are absent).

**XP → Rank:**

```
XP_PER_RANK = 15,000
rank = floor(xp / 15000), capped at 30 (standard) or 40 (primed/special)

xp: 450000 → Rank 30/30 (fully ranked standard item)
xp: 900000 → Rank 40/40 (fully ranked high-capacity item)
xp: 225000 → Rank 15/30
xp: 1       → touched once, never ranked
```

**Category detection from uniqueName prefix:**

```
/Lotus/Powersuits/               → Warframe (except Archwing subpath)
/Lotus/Powersuits/Archwing/      → Archwing
/Lotus/Weapons/Tenno/LongGuns/   → Primary
/Lotus/Weapons/Tenno/Pistols/    → Secondary
/Lotus/Weapons/Tenno/Melee/      → Melee
/Lotus/Weapons/Tenno/Archwing/   → Archwing Weapon
/Lotus/Types/Sentinels/          → Companion (Sentinel)
/Lotus/Types/Companions/         → Companion (Animal)
/Lotus/Types/Player/Mechs/       → Necramech
(anything else)                  → Other
```

---

## Focus School Keys

| Key | School |
|-----|--------|
| `AP_POWER` | Madurai |
| `AP_TACTIC` | Naramon |
| `AP_DEFENSE` | Vazarin |
| `AP_UMBRA` | Umbra |
| `AP_WARD` | Unairu |
| `AP_PRECEPT` | Zenurik |

Unknown key or `undefined` → display "None selected".

---

## Syndicate Title Numbers

Title 0–5 maps generically (rank names are flavor text and vary per syndicate):

| Title | Display |
|-------|---------|
| 0 | Unranked / Neutral |
| 1–4 | Rank {n} |
| 5 | Maxed |

---

## Death Marks

`deathMarks[]` = uniqueNames of assassin enemies marking the player.

Display: strip path, map last component to friendly name. Unknown → show last path component with basic formatting (e.g., `StalkerCorpus` → "Stalker (Corpus)").

Common entries:

| uniqueName | Display |
|---|---|
| `/Lotus/Types/Enemies/Corpus/StalkerCorpus` | Stalker |
| `/Lotus/Types/Enemies/Infestation/ZaramanStalker` | Stalker (Infested) |

---

## Privacy & Platform

**Privacy:** Private profiles return 404. Indistinguishable from nonexistent usernames. Error message must mention both possibilities.

**Platform:** DE's endpoint doesn't filter by platform. Same username on multiple platforms → API returns one (likely the older or higher-activity account). The `platform` parameter on tools is included for documentation but currently has no effect on the API call.

---

## Sparse Profiles

New players and private-adjacent profiles may have many absent fields. Always use optional chaining + fallbacks:

```typescript
const mr = profile.playerLevel ?? 0;
const clan = profile.guildName ?? "No clan";
const xpItems = profile.xpInfo ?? [];
const syndicates = profile.syndicates ?? [];
const stats = profile.stats ?? {};
```

When an entire section is absent, show "Not available" rather than crashing or emitting empty output.

---

## Twitch Arsenal Endpoint (NOT IMPLEMENTED)

The Twitch Extension endpoint (`https://content.warframe.com/dynamic/getActiveLoadout.php`) would return full mod configs, arcanes, and riven details but:

1. Requires a Twitch Extension JWT — no public way to generate it.
2. PC-only, requires Twitch account link.
3. Validates `Origin`/`Referer` headers — fragile, breaks when DE updates.

**Not implemented.** Use `activePreset` + `loadout` fields for equipped gear (XP + Forma count only, no mod slots).
