# ipaddress

**`cloud-itonami/ipaddress` は、IP アドレス / ASN / プレフィックスの登録簿を
etzhayyim substrate（AT Protocol PDS）へ**書き込む**経路である。** 37 個の XRPC
コマンドを純粋な TypeScript 関数として持つ `kotoba/` と、それを Cloudflare Worker
の XRPC エンドポイントとして露出する `xrpc-adapter/` の 2 パッケージからなる。

名前が機能を示さないので冒頭で名乗る（AGENTS.md「名前が機能を示さない repo を
作ったら、README の冒頭で名乗る」）。`ipaddress` という bare 名は主題だけを言って
おり、「何をする repo か」——**書き込み経路である**こと——は名前から読めない。

## 最近接 repo との境界

| repo | 何を所有するか |
|---|---|
| **`cloud-itonami/ipaddress`**（ここ） | **PDS への書き込み経路**。`e.write()` / `e.read()` を呼ぶ 37 コマンドと、その XRPC Worker adapter。TypeScript |
| `cloud-itonami/ipaddress-actor` | **収集・分析・DID 階層**。RIR delegated-stats / RDAP / 逆引き DNS の実 ingest、kotoba Datom log、mesh app。`methods/*.cljc` |

**DID シェル（`did:web:ipaddress.etzhayyim.com:*` の実体）を所有するのは
`ipaddress-actor` であって、ここではない。** この境界は一度壊れており、この repo の
履歴に修復が残っている（`802f08b` で 22 file を複製 → `b91041f` / `9097a2b` /
`ae76107` / `87c2d23` で撤去。理由は commit message に「ipaddress-actor が正しい
所有者」と書かれている）。同じ形の複製を再び持ち込まないこと。

なお `kotoba/README.md` が説明する **authority chain（RIR → NIR → Provider → ASN →
Prefix → IP）は設計としてはここに書かれている**が、その DID を実際に発行・保持
するのは actor 側である。

## 構成

```
kotoba/          37 コマンドの純粋関数（Worker ではない）。vitest
  src/index.ts     barrel。12 tier ぶんを re-export
  test/
xrpc-adapter/    CF Worker。37 ルートを kotoba に委譲する単一ファイル
  src/index.ts
  wrangler.jsonc   route: ipaddress.etzhayyim.com/xrpc/*
appview/         kotodama.jsonld のみ
README.edn       機械可読の repo メタデータ（etzhayyim.repository/v1）
migration.edn    etzhayyim/root からの抽出元 revision / tree
```

`kotoba/` が採る **Option B**（vendor の `createKyselyDb` 直書き SQL ではなく、
PDS XRPC 経由で書く）の設計理由と、vendor パターンからの翻訳表は
`kotoba/README.md` にある。

## 検証済みの現在地（2026-08-13 実測）

**この節の各行は実際にコマンドを走らせて確かめたものだけを載せている。**
手順と実際の出力は [`docs/operator-quickstart.md`](docs/operator-quickstart.md)。

| 主張 | 実測 |
|---|---|
| kotoba のコマンド数 | **37**（export 39 − helper 2: `asnDid` / `asnRkey`） |
| adapter のルート数 | **37**。コマンド名の集合は kotoba 側と**完全一致**（`diff` が空） |
| `kotoba/` の `npm install` | **通らない**。npm 11.16 が git dep の prepare script を拒否（`EALLOWSCRIPTS`） |
| `xrpc-adapter/` の `npm install` | **通らない**。`workspace:*` を解決する workspace root がこの repo に無い（`EUNSUPPORTEDPROTOCOL`） |
| `ipaddress.etzhayyim.com` | **NXDOMAIN**。zone `etzhayyim.com` は在るがこのサブドメインは無く、Worker route は未有効 = **未デプロイ** |
| git 依存 3 本の URL | `github.com/etzhayyim/com-etzhayyim-sdk{,-mock,-auth}` は**別 org へ移動済み**。GitHub のリダイレクト経由でのみ解決する（実体は `kotoba-lang/sdk{,-mock,-auth}`）。pin した SHA は 3 本とも移動先に現存 |

**したがって、この repo は「書けば動く」状態ではない。** テストを走らせることも、
Worker を deploy することも、今日この checkout からはできない。何が塞いでいて、
何を直せば開くのかは quickstart の「詰まっている 3 点」を読むこと。

> ⚠ `xrpc-adapter/README.md` の Setup にある `cd 60-apps/etzhayyim-project-ipaddress/xrpc-adapter`
> は**抽出前のモノレポのパス**で、この repo には `60-apps/` が無い。同 README の
> 「Deploys to ipaddress.etzhayyim.com/xrpc/\*」も、上記のとおり現時点では意図で
> あって稼働中の surface ではない。サブパッケージの README を入口にしないこと。

## 出自

`etzhayyim/root` の `60-apps/etzhayyim-project-ipaddress` から抽出された
（`migration.edn`: revision `e5654f08`、tree `8fe357b6`、26 file / 113,805 bytes）。
設計の正本は抽出元の ADR-2605203000（write-target options）と ADR-2605210000
（XRPC adapter）で、**どちらもこの repo には入っていない**。

## 決定の記録

- [`docs/adr/0001-verified-state-and-blockers.md`](docs/adr/0001-verified-state-and-blockers.md)
  — 上表の 3 つのブロッカーをどう扱うか
