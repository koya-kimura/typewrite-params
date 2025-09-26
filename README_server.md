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
parameters_version INTEGER NULL
parameters_profile TEXT NULL
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
| POST | /api/art | Yes | Yes | No | Create with server-assigned name (parameters + optional thumbnail) |
| GET | /api/art | No | No | No | List recent (limit clamp 500) |
| GET | /api/art/:identifier | No | No | No | Lookup by user (latest) else by name |
| GET | /api/art/id/:id | No | No | No | Fetch single entry by numeric id |
| DELETE | /api/art/:id | Yes | Yes | Yes | Delete single row |
| DELETE | /api/art | Yes | Yes | Yes | Delete all rows |
| GET | /thumbnails/* | No | No | No | Serve stored WebP thumbnails |

## Request: POST /api/art

Body:

```json
{
  "parameters": { "version": 1, "data": { "floatA": 0.42, "flag": true }, "profile": "p5-v1" },
  "thumbnail_base64": "<base64 PNG or WebP>"
}
```
Rules:

- Size limit raw: 512KB.
- PNG -> converted to WebP (quality 80) unless invalid (<40 bytes) or conversion fails.
- Accepts genuine WebP (RIFF/WEBP signature check) or PNG (signature + MIME).
- Unsupported => 415.

Server assigns:

- `user_id` from the login session (or `"anonymous"` where applicable)
- `name` as a UUID string (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)

Response: `{ success, id, upserted_name, user_id }`.

### Fetch by ID

`GET /api/art/id/123` ->

```json
{
  "success": true,
  "data": {
    "id": 123,
    "user_id": "alice",
    "name": "550e8400-e29b-41d4-a716-446655440000",
    "parameters": { "floatA": 0.42 },
    "created_at": "2025-09-25 10:11:12",
    "updated_at": "2025-09-25 10:11:12",
    "thumbnail_url": "/thumbnails/abc.webp"
  }
}
```

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

The `parameters` field is a required versioned wrapper:

```ts
interface VersionedParametersSubmission {
  version: number;            // integer >= 1
  data: Record<string, unknown>; // non-empty arbitrary JSON object
  profile?: string;           // optional profile/model tag
}
```

Validation rules:

- `version >= 1`
- `data` must be a non-empty object
- Unknown keys inside `data` are accepted and stored verbatim

Backend behavior:

- Stores unwrapped `data` in `parameters_json`
- Persists `parameters_version` and `parameters_profile` columns as metadata
- Reads (list/detail) return unwrapped `parameters` only (version/profile not yet exposed)

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
- Create is keyed by a server-assigned `name` (UUID). A unique index exists on `name`.

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
