# ADR-0001 — 検証済みの現在地と、3 つのブロッカーの扱い

- **status**: accepted
- **date**: 2026-08-13
- **scope**: `cloud-itonami/ipaddress`

## 文脈

この repo は `etzhayyim/root` の `60-apps/etzhayyim-project-ipaddress` から抽出
された（`migration.edn`）。抽出後、**サブパッケージの README が説明する手順が
どれも通らない状態**が続いていた。誰もそれを記録していなかったので、touch する
たびに同じ 3 点を再発見することになる。

実際、superproject の成熟度 loop はこの repo を 4 周連続で「docs 軸を上げる」
対象に選び、4 周とも着地させずに終わっている。**沈黙は再発見のコストを毎回
満額で払わせる。**

## 実測（2026-08-13、node v26.3.0 / npm 11.16.0）

1. **実装の対応は取れている。** kotoba の export 39 個から helper 2 個
   （`asnDid` / `asnRkey`）を除いた **37 コマンド**と、`xrpc-adapter` の
   **37 ルート**は名前の集合が完全一致する（`diff` が空）。この検査は、ルート名を
   1 つ壊すと壊した名前を指して exit 1 になることも確認済み。
2. **`kotoba/` の依存が入らない。** npm 11.16 は git 依存の prepare script を
   既定で拒否する（`EALLOWSCRIPTS`）。`@etzhayyim/sdk` は `"prepare": "tsc"` を
   持ち `exports` が `./dist/*` を指すので、**script を走らせないと import
   できない**。よって `vitest run` / `tsc --noEmit` は走らない。
3. **`xrpc-adapter/` はその手前で落ちる。** `"@etzhayyim/ipaddress-kotoba":
   "workspace:*"` を宣言しているが、この repo に workspace root
   （root `package.json` / `workspaces` 宣言）が無い（`EUNSUPPORTEDPROTOCOL`）。
   抽出時に落ちた配線であって書き間違いではない。
4. **未デプロイ。** `ipaddress.etzhayyim.com` は **NXDOMAIN**。zone
   `etzhayyim.com` は Cloudflare 上に在り `pds.etzhayyim.com` は解決するので、
   「zone ごと消えた」のではなく **Worker route が一度も有効化されていない**。
5. **git 依存 3 本は別 org へ移動済み**（`etzhayyim/com-etzhayyim-sdk{,-mock,-auth}`
   → `kotoba-lang/sdk{,-mock,-auth}`）。GitHub のリダイレクトで解決しており、
   pin した SHA は 3 本とも移動先に現存する。

## 決定

1. **入口を root の `README.md` と `docs/operator-quickstart.md` に一本化する。**
   `kotoba/README.md` と `xrpc-adapter/README.md` は設計の説明としては有効だが、
   **手順の入口にしない** —— 後者の
   `cd 60-apps/etzhayyim-project-ipaddress/xrpc-adapter` は抽出前のパスで、この
   repo に `60-apps/` は無い。
2. **通らない手順を「通る手順」として書かない。** quickstart には、実際に走らせて
   出力を確認した手順だけを、観測したエラーそのままで載せる。3 つのブロッカーは
   「開ける方向」を候補として挙げるにとどめ、**検証していない回避策を手順として
   書かない**。
3. **今日この repo に対して実行できる検査は §2 の棚卸しだけ**であることを明示
   する。依存が入らない以上、テストが緑であることを誰も主張できない ——
   「テストが無い」のではなく「テストを走らせられない」。この 2 つを混同しない。
4. **DID シェルはここに置かない。** 所有者は `cloud-itonami/ipaddress-actor`。
   この境界は一度破られ（`802f08b` が 22 file を複製）、4 commit かけて撤去
   された。README に境界として明記する。

## 保留（この ADR では決めない）

- **3-1 の開け方**: `allowScripts` の明示許可 / SDK のビルド済み配布 / vendoring。
  いずれも実際に install が通ることを確認してから採ること。**この環境では
  依存の install script 実行自体が権限で塞がれており、検証できなかった。**
- **3-2 の開け方**: workspace root を足すか、`workspace:*` を相対 `file:` 参照に
  するか。3-1 を直しても 3-2 が残ると adapter はビルドできない。
- **deploy するか否か**: `account_id` と PDS セッションがこの repo に無く、
  そもそも `ipaddress-actor` との役割分担（誰が世に出るホスト名を持つか）が
  未決。**DNS を生やす前にその決定が要る。**

## 帰結

- 次に触る人は、3 点を再発見する代わりに quickstart を読んで 10 分で現在地を
  掴める。
- **緑に見える表示は 1 つも無い。** テストは走らず、deploy は無く、それらは
  「未検査」として見えている。動いていない CI より無い CI の方がよい、という
  superproject の判断（ADR-2607300900）と同じ形。
