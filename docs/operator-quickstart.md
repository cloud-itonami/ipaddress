# operator quickstart — ipaddress

**この文書に書いてある手順は、2026-08-13 に実際に走らせて出力を確認したものだけ
である。** 通らない手順は「通らない」と、観測したエラーそのままで書いてある。
動くはずの手順として書いていない。

想定読者は、この repo を初めて触って「テストを走らせたい / deploy したい」と
考える operator。**結論を先に言うと、今日はそのどちらもできない。** 何が塞いで
いるかを 10 分で把握するのがこの文書の役目。

計測環境: macOS 25.3.0 / node v26.3.0 / npm 11.16.0。

---

## 1. 取得する（通る）

```bash
git clone https://github.com/cloud-itonami/ipaddress.git
cd ipaddress
git log --oneline -1
# 87c2d23 DID シェル複製の撤去 (ipaddress-actor が正しい所有者)
```

west 管理下の checkout を使う場合、この repo の remote 名は `origin` ではなく
**`cloud-itonami`**（org 名）である。`git fetch origin` は
`fatal: 'origin' does not appear to be a git repository` になる。

```bash
git fetch cloud-itonami          # ✅
```

## 2. 実装の棚卸しをする（通る・唯一の実行可能な検査）

依存を 1 つも入れずに走り、**37 個の kotoba コマンドと 37 本の adapter ルートが
同じ集合であること**を確かめる。今日この repo に対して実行できる検査はこれだけ。

```bash
grep -hoE '^export (async )?function [a-zA-Z]+' kotoba/src/*.ts \
  | sed 's/.*function //' | grep -vE '^(asnDid|asnRkey)$' | sort > /tmp/cmds.txt
grep -oE '\$\{NSID_BASE\}\.[a-zA-Z]+' xrpc-adapter/src/index.ts \
  | sed 's/.*\.//' | sort > /tmp/routes.txt

echo "commands: $(wc -l < /tmp/cmds.txt)  routes: $(wc -l < /tmp/routes.txt)"
diff /tmp/cmds.txt /tmp/routes.txt && echo "OK: sets identical"
```

実測（clean な clone）:

```
commands:       37  routes:       37
OK: sets identical
```

`asnDid` / `asnRkey` を除くのは、この 2 つが XRPC コマンドではなく DID / rkey を
導出する helper だから（export は全部で 39 個）。

**この検査は落ちる。** `xrpc-adapter/src/index.ts` のルート名を 1 つだけ
`getAsn` → `getAsnTYPO` に書き換えて再実行すると、壊した箇所そのものを名指しして
exit 1 になる:

```
9c9
< getAsn
---
> getAsnTYPO
diff exit=1
```

無改変では exit 0。**両方向を確認済み**なので、この検査の緑には意味がある。

## 3. 詰まっている 3 点

### 3-1. `kotoba/` の依存が入らない（npm ≥ 11.16 の script guard）

```bash
cd kotoba && npm install
```

```
npm error git dep preparation failed
npm error npm error code EALLOWSCRIPTS
npm error npm error --allow-scripts is not allowed in project-scoped installs.
npm error npm error Add the entries to the "allowScripts" field in package.json, or to .npmrc, instead.
```

`--ignore-scripts` を付けても同じところで落ちる（失敗しているのは npm が git 依存を
用意するために内部で起こす**別の** npm プロセスで、そちらが `--force` 付きで走る）。

原因は迂回ではなく実体にある: `@etzhayyim/sdk` は
`"prepare": "tsc"` を持ち、`exports` が `./dist/*` を指す —— **install 時に
ビルドされないと import できない**。pin されている commit
`12314a0c` のメッセージ自体が `fix: build SDK when installed from git` である。

したがって `vitest run` も `tsc --noEmit` も今日は走らない。

**開ける方向**（どれも未検証。この文書は検証していない手順を「動く」とは書かない）:
`package.json` の `allowScripts` / `.npmrc` で当該 2 依存の script を明示許可する、
SDK をビルド済み成果物として配布する、または vendoring する。どれを採るかは
`docs/adr/0001-verified-state-and-blockers.md` の検討事項。

### 3-2. `xrpc-adapter/` は依存解決の手前で落ちる（workspace root が無い）

```bash
cd xrpc-adapter && npm install --dry-run
```

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

`xrpc-adapter/package.json` は `"@etzhayyim/ipaddress-kotoba": "workspace:*"` を
宣言しているが、**この repo には root の `package.json` が無く、`workspaces` を
宣言しているファイルも 1 つも無い**:

```bash
ls package.json                                        # No such file or directory
grep -rn '"workspaces"' --include=package.json .       # 出力なし
```

抽出前のモノレポには workspace root が在ったので、これは**抽出時に落ちた配線**で
あって、書き間違いではない。3-1 を直しても、こちらを直さないと adapter は
ビルドできない。

### 3-3. deploy 先の DNS が無い（= 未デプロイ）

```bash
dig ipaddress.etzhayyim.com +noall +comment | grep -o 'status: [A-Z]*'
# status: NXDOMAIN
```

zone 自体は在って、隣のサブドメインは解決する:

```bash
dig +short NS etzhayyim.com      # everton.ns.cloudflare.com. / vivienne.ns.cloudflare.com.
dig +short pds.etzhayyim.com     # 172.67.179.128 / 104.21.51.111
```

`xrpc-adapter/wrangler.jsonc` の route は
`ipaddress.etzhayyim.com/xrpc/*`（zone `etzhayyim.com`）だが、Cloudflare の
Worker route はホスト名の DNS レコードが要る。**NXDOMAIN は「route が一度も
有効化されていない」ことを意味する。** `xrpc-adapter/README.md` の
「Deploys to ipaddress.etzhayyim.com/xrpc/*」は意図であって現況ではない。

**デプロイしようとする前に**: この repo は `orgs/cloud-itonami/` 配下の west
project なので、superproject の deploy guard（`origin/main` 同期の強制）が
効く。加えて `wrangler.jsonc` の `account_id` と、PDS のセッション
（`PDS_ACCESS_JWT` / `PDS_REFRESH_JWT`）が要る —— **どちらもこの repo には
入っていない**。

## 4. 依存 3 本の実際の所在（リダイレクト頼み）

`package.json` が指す URL は 3 本とも**別 org へ移動済み**で、GitHub の
リダイレクトが生きているから解決している:

| package.json の URL | 実体 | pin した SHA |
|---|---|---|
| `etzhayyim/com-etzhayyim-sdk` | **`kotoba-lang/sdk`** | `12314a0c` 現存 |
| `etzhayyim/com-etzhayyim-sdk-mock` | **`kotoba-lang/sdk-mock`** | `c857ff9b` 現存 |
| `etzhayyim/com-etzhayyim-sdk-auth` | **`kotoba-lang/sdk-auth`** | `1b2d068c` 現存 |

確認のしかた（`full_name` がリダイレクト先を答える）:

```bash
gh api repos/etzhayyim/com-etzhayyim-sdk --jq .full_name     # kotoba-lang/sdk
```

⚠ **`git ls-remote https://github.com/etzhayyim/sdk.git` は
`Repository not found` を返す。** リダイレクトが張られているのは*旧名*
`com-etzhayyim-sdk` に対してであって、新名 `sdk` を旧 org に当てたパスでは
ない。「repo が消えた」と誤診しやすいので、判定は `gh api` の `full_name` で
行うこと（実際にこの誤診を 1 度している）。

## 5. 何を読むと設計が分かるか

- `kotoba/README.md` — Option B（PDS XRPC 書き込み）を採った理由、vendor の
  `createKyselyDb` からの翻訳表、authority chain の DID 形。
- `README.md` — `ipaddress-actor` との境界（**DID シェルの所有者は actor 側**）。
- 設計の正本 ADR-2605203000 / ADR-2605210000 は抽出元の `etzhayyim/root` にあり、
  **この repo には入っていない**。`kotoba/README.md` 中の
  `../../../90-docs/adr/...` 相対リンクはこの repo では解決しない。
