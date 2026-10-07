# ヤニウォーズ

**お前には、もう奪わせない。**

吸いたいと思った。でも、吸わなかった。その1回から、お金も、時間も、そして命も。

既存の静的PWAを継続しています。吸った記録を追加しても過去の成果や景色は減りません。アカウント登録、外部AI、Push通知、サーバーへの利用記録送信はありません。広告は初期状態で無効です。

## ローカルで動かす

Node.js 24を使います。このREADMEのあるフォルダで `npm ci` → `npm run build` → `npm run dev`。ブラウザで http://localhost:4173 を開きます。ソース変更後は再buildしてください。開発用ビルドは環境変数 `YANI_ENV=development` を指定します。localhostではproductionビルドでも広告は読み込みません。

## Cloudflare Pagesへ公開する方法

1. GitHubの既存 `yani-wars` リポジトリを使います。mainにこのフォルダのファイル一式を置きます。node_modules、work、test-results、debug.logは含めません。
2. Cloudflareにログイン → Workers & Pages → Create application → **Pagesに続行**。Workersは作りません。
3. **既存Gitリポジトリをインポート** → GitHubを接続。許可するリポジトリはyani-warsだけにします。
4. プロジェクト名 `yaniwars`（利用可能な場合）、本番ブランチ `main`、Framework preset **None**。
5. Build command **npm run build**、Build output directory **dist**、Root directoryは空欄。Node.jsは `.node-version` の24を使用します。
6. Save and Deploy。成功した画面の `https://プロジェクト名.pages.dev` が公開URLです。Workers、Functions、Firebase、VPS、データベース設定は不要です。
7. 公開URLで初回設定→1回記録→再読み込み→オフラインで再起動を確認します。Safari/Chromeからホーム画面へ追加してください。
8. GitHub main更新でCloudflareが自動ビルドします。Deploymentsで同じコミットが成功したか確認できます。シェアURLは公開先から自動生成するため `public/config.json` の `publicUrl` は空欄のままで構いません。

Netlify設定・ライブラリは使いません。GitHub Pagesへのデプロイ処理はworkflowから外し、GitHubはソース保管とテスト・商品更新に使います。既存GitHub Pagesの古い公開物はCloudflareへの切り替えだけでは消えません。

参照：[Cloudflare静的HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) / [Git連携](https://developers.cloudflare.com/pages/get-started/git-integration/)

### 既存の記録を引き継ぐ

同じURLのアプリ更新では既存のIndexedDB・OPFSをそのまま使います。データ形式version 1とDB名は変更していません。

localhostや旧公開URLから別ドメインへ移るとブラウザの保存領域が異なります。旧URLの設定で「記録をファイルに保存」、新URLの初回画面または設定から「保存した記録を読み込む」を選びます。内容を検証して件数を確認後に統合し、同じIDは重複させません。現在の設定を優先し、記録時の価格・時間は維持します。サーバーへファイルを送りません。移行完了までは旧サイトのデータを消さないでください。

## GitHub Actionsについて

- `.github/workflows/pages.yml`：main更新・手動実行でPython解析テスト、JSテスト、build、iPhone/Android相当のブラウザテストを実行。完成したdistをartifactに保存します。名前は **Test static PWA for Cloudflare Pages**。
- `.github/workflows/products.yml`：毎日日本時間6:17（UTC21:17）に商品情報を確認。**Daily official product update** → Run workflowで手動実行できます。
- 変更がある場合のみ価格履歴を含む商品マスターをcommit。CloudflareのGit連携がそのmain更新を受信して再公開します。GitHubのGITHUB_TOKENによるcommitでは別のGitHub push workflowは起動しないため、商品更新workflow自身でもテストとbuildを実行します。Cloudflare側の受信結果は初回の商品変更commit時にDeploymentsで確認してください。
- 公式資料の解析エラー時は推測で価格を書き換えず処理を止めます。Actionsの赤い実行とartifact `official-catalog-report` を確認してください。
- GitHub都合で予約が遅れる場合や、公開リポジトリの長期無活動でscheduleが無効化される場合があります。毎日の操作は不要ですが失敗通知は確認してください。

### 商品の収録範囲

現在 **322商品**。財務省の認可一覧から遡ったPDF **280件**、抽出採用357行、曖昧な225行は保留しています。範囲は `public/data/catalog-coverage.json`。紙巻き・加熱式が対象で、大手3社以外の輸入銘柄も含みます。英字・カタカナ・ひらがな・全半角・部分一致で検索できます。別名辞書はDAVIDOFF／ダビドフ等にも対応しています。ただし、正式価格を確認できない紙巻き商品は未収録です。名前だけを理由に推測登録しません。

主ソースは財務省。JTは表の構造を解析し、PMI・BATは公式サイトの可用性・変更を監視します。PMI/BATの全商品・全終売情報を自動で構造化するものではありません。新規認可・適用日付き価格/入り数変更は財務省経由で追従します。資料から消えただけでは終売と判定しません。正式な終了情報が確認できた範囲だけ状態へ反映します。メーカー・輸入元・製造国・英名が資料にない場合は推測しません。

認可済みでも販売継続未確認の商品はその旨表示します。現行一覧から辿れない古い資料、曖昧な行、正式価格不明の商品は未収録です。手動登録へフォールバックしてください。価格は各記録時点で保存され、後の値上げで過去の成果を再計算しません。

## Google AdSenseを有効にする方法

初期状態は**広告なし**です。仮Publisher IDは本番登録しません。以下は運営者用です。AdSense審査・実広告配信は未確認で、審査通過を保証しません。

### 記録を広告コードから隔離する構成

Googleスクリプトをアプリと同じオリジンで動かすと、技術的にはそのオリジンの保存領域にアクセスできます。そのため、本実装は**広告専用の別Pagesプロジェクト**を使います。同じGitHubソース・build command、出力先だけ `ads-dist` を指定してください。アプリ本体は `dist`、広告だけは `ads-dist`。広告サイトには記録・アプリJS・商品マスターを置きません。広告のiframeにはreferrerを送らず、本数・銘柄・回復度・設定などをURLやメッセージで渡しません。

この隔離構成のAdSense審査・別ドメインiframe配信の可否は、実アカウントでGoogleの方針を確認する必要があります。未承認なら広告を無効のまま運用してください。動かすために隔離を解除しないでください。

### 手順と入力箇所

1. Google AdSenseアカウントを作成します。
2. ヤニウォーズの実際の公開URLを「サイト」に登録します。隔離する広告専用URLの扱いもGoogle側で確認します。
3. 公開した6つの説明ページ、運営者の連絡先、ポリシーを確認してサイト審査を申請します。連絡先は現在未設定です。個人メールを勝手に公開しないため、運営用窓口を決めて `scripts/information.mjs` のabout/privacyに記載してください。
4. Publisher ID（`ca-pub-`から始まるID）を取得します。アカウント発行のIDは審査申請前に取得できる場合もあります。
5. ディスプレイ広告ユニットを作成します。**自動広告は無効**にし、ホームや操作ボタンの近くへ自動挿入させないでください。
6. 記録用・説明用のSlot IDを取得します。
7. **`public/config.json` → `adsense`** に設定します。
   - `clientId`：Publisher ID（`ca-pub-`を含む）
   - `slotRecord`：記録ページ用の10桁のSlot ID
   - `slotInfo`：このアプリについて／寿命換算ページ用の10桁のSlot ID
   - `hostUrl`：別途作った広告専用PagesのHTTPS URL（末尾 `/`）
   - `enabled`：審査と同意設定完了後に `true`
   - `consentConfigured`：次のPrivacy & Messaging設定と実機検証が済んだ後に `true`
8. **`public/ads.txt`** のコメントをGoogle指定の販売者行へ置換します。形式は `google.com, pub-自分の数字ID, DIRECT, f08c47fec0942fa0`。`ca-`は外します。広告専用サイトのads.txtはbuild時に同じclientIdから生成します。
9. mainへ反映し、Cloudflareの本体と広告専用プロジェクトを再デプロイします。
10. `/ads.txt`、記録ページ末尾、説明ページ末尾を確認します。読み込み失敗や広告枠が空の場合は自動で畳まれ、記録機能には影響しません。広告の自己クリックはしないでください。
11. **広告を実際に有効化する前に** AdSense → **Privacy & messaging** で対象地域の同意メッセージを作成・公開します。EEA・英国・スイス向けにはGoogle認定CMPを使用します。Google CMPまたは認定CMPを使い、独自の地域推測・同意バナーは追加しません。別オリジンiframe内でCMPメッセージが適切に表示・操作できるかを実機で検証し、表示できなければ広告を有効化しないでください。

設定値は公開情報です。秘密鍵やAPIトークンは不要です。ID未設定、開発時、HTTP/localhost、オフライン、同意設定未完了なら広告を読み込みません。1画面最大1枠で、広告用scriptは同じフレームで重複追加しません。

参照：[Google Privacy & messaging](https://support.google.com/adsense/answer/10924669?hl=ja) / [認定CMPの要件](https://support.google.com/adsense/answer/13554020?hl=ja)

## 時間帯統計・風景・シェア

`src/patterns.js` は両種の記録を1時間ごとに集計します。今週は月曜から。3時間窓の合計・中心時間の記録数でピークを判定し、8件未満または累計/今週で3日未満なら断定しません。24本の棒はタップとキーボード操作に対応します。

`src/world.js` と `src/landscape.js` がホームとPNGに共通です。20本ではまだ黄ばみ、300〜500本まで大きく色が変わり、その後も透明感が増します。600本で若木、1800〜5400本では奥の森と両岸の花畑が成長します。医療上の回復測定ではありません。寿命換算は `public/config.json` の `lifeMinutesPerStick: 20`、初期自由時間は `defaultFreeMinutes: 5`。

PNGは1080×1350。今日・累計で数字を切り替え、風景はどちらも現在の累計を使います。銘柄や喫煙日時は含めません。Web Share API非対応時は保存・コピーに切り替わります。Xボタンは投稿画面を開くだけで自動投稿しません。InstagramのURLはストーリーズのリンクスタンプ等へ貼り付けます。

## 保存・PWA・テスト

IndexedDB主保存、対応端末ではOPFS3世代バックアップ。Cache APIはアプリ本体だけ。Persistent Storage非対応でも動作します。全削除は記録と設定・バックアップを消し、広告の静的設定やPWAファイルは維持します。

- `npm test`：計算・保存・商品解析・時間帯統計・移行・広告設定の単体テスト
- `npm run build`：Cloudflare用完全静的ファイルをdistへ生成
- `npx playwright install chromium`（初回のみ）→ `npm run test:e2e`
- Python 3.12以上：`python -m pip install -r scripts/requirements-catalog.txt` → `python -m unittest discover -s tests -p '*_test.py'`

ブラウザテストは隔離したテスト用データを使います。実ユーザーの記録は変更しません。iPhone/AndroidはChromiumでの画面・タッチ環境の模擬です。実機Safariのホーム画面追加や各SNSアプリでの共有、実際のGoogle広告・CMPは別途確認が必要です。

説明ページはJSなしでも読める静的HTMLです。`scripts/information.mjs` から `/about/`、`/guide/`、`/life/`、`/patterns/`、`/privacy/`、`/advertising/` を生成します。Service Workerはこれらもオフライン対応します。新バージョンは全タブを閉じた後に切り替わり、古い画面を途中で壊しません。
