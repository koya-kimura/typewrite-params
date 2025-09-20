# Flow Vol8 Backend

Lightweight Hono + SQLite service for storing art generation parameter presets and thumbnails.

## Stack

- Framework: Hono (TypeScript)
- DB: SQLite (via `sqlite` + `sqlite3` driver)
- Images: `sharp` (PNG -> WebP), `file-type` (MIME sniffing + signature fallback)
- Validation: Zod (`artSubmissionSchema`)
- Auth: In-memory session tokens (Bearer) + CSRF token + admin flag
- Tests: Vitest (unit/integration) + scripted E2E

## Data Model

Table `art_creations` (migrations auto-run on startup):

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
user_id TEXT NOT NULL
name TEXT UNIQUE NOT NULL
parameters_json TEXT NOT NULL
thumbnail_path TEXT NULL
created_at TEXT NOT NULL DEFAULT datetime('now')
updated_at TEXT NOT NULL DEFAULT datetime('now')
```

## Auth & CSRF Flow

1. `POST /api/login` -> returns `{ success, token, csrf, expiresAt, user:{ id, admin } }`.
2. Include `Authorization: Bearer <token>` on protected routes.
3. Include `x-csrf-token: <csrf>` header for POST / DELETE routes.
4. Session TTL: 2h (in-memory). Re-login to refresh.
5. Admin-only deletion endpoints require `user.admin === true`.

## Endpoints (Current)

| Method | Path | Auth | CSRF | Admin | Description |
|--------|------|------|------|-------|-------------|
| POST | /api/login | No | No | - | Issue token + csrf |
| POST | /api/art | Yes | Yes | No | Upsert by `name` (parameters + optional thumbnail) |
| GET | /api/art | No | No | No | List recent (limit clamp 500) |
| GET | /api/art/:identifier | No | No | No | Lookup by user (latest) else by name |
| DELETE | /api/art/:id | Yes | Yes | Yes | Delete single row |
| DELETE | /api/art | Yes | Yes | Yes | Delete all rows |
| GET | /thumbnails/* | No | No | No | Serve stored WebP thumbnails |

## Request: POST /api/art

Body:

```json
{
  "user_id": "alice",
  "name": "preset_name",
  "parameters": { "floatA": 0.42 },
  "thumbnail_base64": "<base64 PNG or WebP>"
}
```
Rules:

- Size limit raw: 512KB.
- PNG -> converted to WebP (quality 80) unless invalid (<40 bytes) or conversion fails.
- Accepts genuine WebP (RIFF/WEBP signature check) or PNG (signature + MIME).
- Unsupported => 415.

Response: `{ success, upserted_name, user_id }`.

## Listing

`GET /api/art?limit=50` -> `{ success, data: ArtDTO[] }`

`ArtDTO` shape:

```ts
interface ArtDTO {
  id: number;
  user_id: string;
  name: string;
  parameters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  thumbnail_url: string | null;
}
```
Limit defaults 100, max 500.

## Parameter Types (Storable Schema)

The `parameters` field currently accepts either:

1. Legacy inline object (original format) matching `parameterSchema`.
2. Versioned wrapper object: `{ "version": <number>, "data": { ...parameter fields... } }`.

When a versioned wrapper is submitted the backend stores only the unwrapped `data` portion in `parameters_json` for uniform persistence. The outer wrapper is not retained so reads always return the raw parameter object (legacy shape) to avoid breaking existing clients.

### Current Field Definitions

```ts
// parameterSchema (all fields optional, at least one must be present)
interface ParametersLegacyShape {
  floatA?: number;           // arbitrary numeric parameter
  floatB?: number;           // second numeric parameter
  vector2?: [number, number];
  vector3?: [number, number, number];
  vector4?: [number, number, number, number];
  color?: [number, number, number, number]; // RGBA each 0..1
}

// Versioned submission wrapper (write-only convenience)
interface VersionedParametersV1 {
  version: 1;                // positive integer version tag
  data: ParametersLegacyShape;
}
```

Validation rules:

- At least one field inside the parameter object (`floatA`, `floatB`, `vector2`, `vector3`, `vector4`, `color`) must be supplied.
- `color` components are clamped via validation to the inclusive range [0,1].
- Vectors must have the exact tuple arity shown above.
- Extra/unknown keys in `parameters` are currently allowed (stored verbatim) but may be restricted in a future stricter schema.
- If both legacy and versioned formats emerge simultaneously (e.g. a client mistakenly nests a legacy object inside another), only the recognized union branch will be parsed; malformed hybrids are rejected with a validation error.

### Example Submissions

Legacy:

```json
{ "parameters": { "floatA": 0.5, "vector2": [1, 2] } }
```

Versioned (preferred going forward for evolvability):

```json
{ "parameters": { "version": 1, "data": { "floatA": 0.5, "color": [1,0.5,0,1] } } }
```

### Future Versioning Strategy

Possible evolutions:

- Introduce `version: 2` adding new typed fields (e.g. `matrix3x3`, enumerations) while preserving backward compatibility by continuing to unwrap to a canonical stored object.
- Maintain a migration layer: if a future version changes semantics (e.g. renaming `floatA`), map to an internal normalized representation before storage.
- Add explicit `schema` or `profile` identifiers alongside `version` for supporting multiple model families concurrently.

### Rationale

Unwrapping keeps reads simple and prevents legacy clients from needing to handle multiple shapes. The trade‑off is that the original version number is not retained; if auditing of historical schema versions becomes required, we would persist an additional `parameters_version` column in a future migration.

## Session Store

Currently an in-memory `Map<string, SessionInfo>` (see `src/middleware/authRequired.ts`). Swap with Redis/DB by abstracting to a `SessionStore` interface (planned enhancement).

## Error Format

Either `{ success: false, message: string }` for handled validation / auth errors or `{ error: 'Internal Server Error' }` from global handler.

## Scripts

```bash
npm run ci    # lint -> tests -> e2e
npm test      # vitest
npm run e2e   # scripted login + post + fetch
npm run dummy # manual dummy submission (server must run on port 3000)
```

## Security Notes

- CSRF header required for state-changing requests.
- MIME + signature detection reduces spoofed images.
- Upsert keyed by `name` (unique) – enables possible multi-preset support later by relaxing uniqueness or adding composite key.

## Future Enhancements (Short List)

- Session store abstraction (Redis) + refresh token rotation.
- Pagination (cursor) beyond simple limit.
- Rate limiting & request logging.
- OpenAPI / Swagger spec generation.
- Richer `parameters` schema & versioning.
- Soft delete & restore.

---

## Historical TDD Note (Original Japanese Documentation)

## 開発用サーバー起動

```bash
npm run build
node ./dist/server.js
```

## テスト実行

```bash
npm run test
```

## TDD Cycle Note

最初に `tests/` 配下のテストは全て `expect(true).toBe(false)` で失敗する状態で作成し、
仕様(ログイン、アート投稿、バリデーション) 実装後に **グリーン** へ変更しました。
このコミット時点のグリーンテスト:

- ログイン統合テスト: 未知ユーザー401 / 既知ユーザー成功
- アート投稿統合テスト: パラメータ欠如400 / 正常投稿200
- モデル単体テスト: User / ArtCreation の基本構造

今後: サムネイル生成や拡張パラメータの追加時には再びレッド→グリーンのサイクルを繰り返します。

## (Legacy Section Below Kept For History)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/login | - | ログイン (users.json) トークン発行 |
| GET | /api/users/available/:id | - | 既存投稿有無によるユーザーID利用可否 |
| POST | /api/art | Bearer | パラメータ+サムネイル( PNG / WebP )投稿 (Upsert) |
| GET | /api/art | - | 一覧取得 `?limit=` (デフォルト100) |
| GET | /api/art/:user_id | - | 特定ユーザーの投稿取得 |
| GET | /thumbnails/... | - | webp サムネイル配信 |

 
### サムネイル仕様

提出可能: PNG (自動でWebP変換), 既にWebPのbase64。
最大サイズ: 512KB。PNGシグネチャ / WebP RIFFヘッダで簡易判定。

 
### Upsert 仕様

`user_id` でユニーク制約。POST /api/art は同一 user_id に対して parameters と (あれば) thumbnail を上書きし、`updated_at` を更新。

 
### 認証

`POST /api/login` で取得したトークンを `Authorization: Bearer <token>` ヘッダに付与。
簡易インメモリ保持のため再起動で無効化。永続化/JWT は将来対応箇所。

CI スクリプトは今も `npm run ci` で lint -> test -> e2e を直列実行します。
