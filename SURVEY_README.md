# PuzzleGen Dental 사용성 평가 (PGD)

POC 체험에 참여한 평가자 5명이 웹 주소로 접속해 설문에 답하고 저장하는 화면입니다.
관리자는 응답을 모아 보고서를 보고 Word · PDF로 내려받을 수 있습니다.

**운영 중: Cloudflare Worker `pgd`** — 서버 없이 Cloudflare에서 실행되고, 응답은 Cloudflare D1 데이터베이스에 저장됩니다.

| 화면 | 주소 | 설명 |
|---|---|---|
| 평가자 설문 | **https://pgd.kth95280.workers.dev/#/survey** | 접속하면 바로 조사 안내가 나옵니다. 응답은 입력한 **성명** 기준으로 쌓입니다 |
| 관리자 | **https://pgd.kth95280.workers.dev/#/admin** | 비밀번호를 입력해 응답 현황, 보고서, 원자료를 확인합니다 |
| 기존 PoC 데모 | https://pgd.kth95280.workers.dev/ | 오른쪽 위 **「사용성 평가 참여」** 버튼으로 설문 화면으로 이동합니다 |

나중에 Cloudflare에 도메인을 추가하면, 대시보드의 Workers → pgd → 설정 → **Domains & Routes**에서 `pgd.도메인`을 바로 연결할 수 있습니다.

---

## A. Cloudflare Worker (현재 운영 중)

| 항목 | 값 |
|---|---|
| Worker 이름 | `pgd` |
| 주소 | https://pgd.kth95280.workers.dev |
| 데이터베이스 | D1 `pgd-survey` (APAC 지역, ID는 `wrangler.jsonc`에 기록) |
| 관리자 비밀번호 | Worker 비밀값 `SURVEY_ADMIN_PIN` |

화면 파일(dist)은 배포할 때 `worker/assets.gen.js`로 Worker 코드 안에 포함됩니다. 따라서 Worker 하나로 화면과 저장 API가 함께 동작합니다.

### A-1. 코드 수정 후 다시 배포

```bash
npm ci
```

```bash
npx wrangler login
```

```bash
npm run cf:deploy
```

### A-2. 운영

| 작업 | 방법 |
|---|---|
| 관리자 비밀번호 변경 | 대시보드 → Workers → pgd → 설정 → 변수 및 비밀 → `SURVEY_ADMIN_PIN` 편집, 또는 `npx wrangler secret put SURVEY_ADMIN_PIN` |
| 원본 응답 보기 | 관리자 화면, 또는 대시보드 → 스토리지 및 데이터베이스 → D1 → pgd-survey (`survey_responses` 표: 성명별 최신본, `survey_history` 표: 저장 이력) |
| 실시간 로그 | 대시보드 → Workers → pgd → 로그, 또는 `npx wrangler tail pgd` |
| 백업 | `npx wrangler d1 export pgd-survey --remote --output=pgd-backup.sql` (관리자 화면의 「전체 원본 (JSON)」도 가능) |
| 파기 | 조사 종료 후 `npx wrangler d1 delete pgd-survey` |

- 무료 요금제 한도(하루 요청 10만 건, D1 쓰기 하루 10만 건) 안에서 충분히 운영됩니다.
- 로컬 시험: `.dev.vars` 파일에 `SURVEY_ADMIN_PIN=시험용비밀번호`를 적고 `npm run cf:dev`를 실행합니다.
- 다른 Cloudflare 계정에 새로 배포할 때는 먼저 `npx wrangler d1 create pgd-survey`를 실행합니다. 출력된 ID를 `wrangler.jsonc`의 `database_id`에 넣은 뒤 `npm run cf:deploy`를 실행하고, `npx wrangler secret put SURVEY_ADMIN_PIN`으로 비밀번호를 지정합니다. 표는 첫 접속 때 자동으로 만들어집니다.

---

## B. Node 서버로 배포 (대안 — 직접 운영하는 서버가 있을 때)

같은 화면과 저장 로직을 Node 서버로도 실행할 수 있습니다. 응답은 서버 디스크의 `data/` 폴더에 파일로 저장됩니다.
Cloudflare 계정에 **도메인이 등록되어 있다면**, 아래 Cloudflare Tunnel로 서버 포트를 열지 않고 `https://pgd.도메인`으로 연결할 수 있습니다.

### B-1. Cloudflare에서 터널 만들기 (처음 한 번 · 도메인 필요)

1. Cloudflare 대시보드에 로그인한 뒤 **Zero Trust**로 들어갑니다. 메뉴에서 **Networks → Tunnels**를 고릅니다.
2. **Create a tunnel** → 유형 **Cloudflared**를 고르고, 터널 이름을 `pgd`로 정합니다.
3. 설치 안내 화면에 `cloudflared ... --token eyJ...` 형태의 명령이 나옵니다. 여기서 **`eyJ`로 시작하는 토큰만** 복사해 둡니다. 명령 자체는 실행하지 않아도 됩니다.
4. **Public hostname** 탭에서 아래처럼 입력하고 저장합니다.

| 항목 | 값 |
|---|---|
| Subdomain | `pgd` |
| Domain | Cloudflare에 등록한 도메인 |
| Path | (비움) |
| Service Type | `HTTP` |
| URL | `survey:8080` ※ Docker 방식. PM2 방식이면 `localhost:8080` |

DNS 레코드(`pgd` CNAME)는 Cloudflare가 자동으로 만듭니다.

### B-2. 서버에서 실행하기

#### Docker (권장)

```bash
git clone -b claude/funny-cori-rljacc https://github.com/taezzixo/puzzle-gen-dental.git
```

```bash
cd puzzle-gen-dental && cp .env.example .env
```

`.env` 파일을 열어 두 값을 채웁니다.

```
SURVEY_ADMIN_PIN=관리자_비밀번호
CLOUDFLARE_TUNNEL_TOKEN=eyJ...(B-1에서 복사한 토큰)
```

```bash
docker compose up -d --build
```

1~2분 뒤 Cloudflare 터널 목록에서 `pgd`가 **HEALTHY**로 바뀌면 `https://pgd.도메인/#/survey`로 접속됩니다.

#### Docker 없이 (PM2 + cloudflared 직접 설치)

Node 18 이상이 필요합니다. B-1의 Service URL은 `localhost:8080`으로 입력합니다.

```bash
cd puzzle-gen-dental && npm ci && npm run build
```

```bash
cp .env.example .env
```

`.env`에 `SURVEY_ADMIN_PIN`을 적고 서버를 실행합니다. 이 방식에서는 `CLOUDFLARE_TUNNEL_TOKEN`을 쓰지 않습니다.

```bash
npm install -g pm2
```

```bash
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

이어서 [Cloudflare 안내](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)에 따라 서버에 cloudflared를 설치하고, 토큰으로 서비스를 등록합니다.

```bash
sudo cloudflared service install eyJ...(토큰)
```

#### 환경변수 (.env)

| 이름 | 필수 | 설명 |
|---|---|---|
| `SURVEY_ADMIN_PIN` | ✔ | 관리자 비밀번호. 없거나 `1234`이면 서버가 시작되지 않습니다 |
| `CLOUDFLARE_TUNNEL_TOKEN` | ✔ (Docker) | B-1에서 받은 터널 토큰 |
| `PORT` | | 서버 내부 포트 (기본 8080) |
| `SURVEY_DATA_DIR` | | 응답 저장 폴더 (기본 `./data`) |

#### Cloudflare 권장 설정 (선택)

아래는 기본값 그대로 두면 됩니다. 특별히 바꿀 것은 없습니다.

- **SSL/TLS**: 터널 방식은 자동으로 HTTPS가 적용됩니다. 서버에 인증서를 따로 둘 필요가 없습니다.
- **Speed → Rocket Loader**: 끈 상태(기본값)로 두세요. 켜면 화면 스크립트 실행 순서가 바뀔 수 있습니다.
- **캐시**: 서버가 화면 파일은 오래 캐시하고, 응답 저장 API는 캐시하지 않도록 헤더를 보냅니다.

---

### B-3. Node 서버 운영

| 작업 | Docker | PM2 |
|---|---|---|
| 상태 확인 | `docker compose ps` | `pm2 status` / `systemctl status cloudflared` |
| 로그 보기 | `docker compose logs -f` | `pm2 logs puzzlegen-survey` |
| 재시작 | `docker compose restart` | `pm2 restart puzzlegen-survey` |
| 코드 업데이트 | `git pull && docker compose up -d --build` | `git pull && npm ci && npm run build && pm2 restart puzzlegen-survey` |

- **동작 확인**: 서버에서 `curl http://127.0.0.1:8080/healthz`가 `ok`를 반환하면 정상입니다. 외부 접속이 안 되면 Cloudflare 터널 목록에서 `pgd`가 HEALTHY인지 확인하세요.
- **백업**: `data/` 폴더를 통째로 복사하면 됩니다. 관리자 화면의 「전체 원본 (JSON)」 버튼으로도 받을 수 있습니다.
  - `data/responses/<성명>.json`: 성명별 최신 응답 (파일 이름은 성명을 인코딩한 값)
  - `data/history/`: 저장할 때마다 남는 이력
- **파기**: 조사가 끝나면 개인정보 동의서의 보유 기간에 맞춰 `data/` 폴더를 삭제합니다.
- 응답을 파일로 저장하므로 서버 프로세스는 **반드시 1개만** 실행합니다. PM2 설정에서 `instances: 1`로 고정해 두었습니다.

---

## 평가자 화면

- 블랙 앤 화이트의 간결한 디자인입니다. **누르는 곳**은 테두리 버튼이고, 선택하면 검정으로 채워집니다. **설명 · 점수 기준**은 회색 작은 글씨로 표시합니다.
- 한 화면에 한 주제씩, 모두 16단계입니다. 아래에 **[← 이전] [저장] [다음 →]** 버튼이 항상 보입니다.
- 평가자 선택 없이 **조사 안내**부터 시작합니다. 응답은 2단계(개인정보 동의)에서 입력한 **성명** 기준으로 저장됩니다. 공백은 무시하므로 「홍 길동」과 「홍길동」은 같은 사람으로 봅니다.
- [저장]을 누르거나 [다음]·[이전]으로 넘어가면 저장됩니다. 성명을 입력하기 전에는 이 기기에만 보관됩니다.
- **이어서 작성**
  - 같은 브라우저로 다시 접속하면 자동으로 이어집니다. 상단에 「○○○ 님의 응답을 이어서 작성 중 · 본인이 아니면 새로 작성」이 표시됩니다.
  - 다른 기기에서는 같은 성명을 입력하면 「이전 응답이 있습니다 · 이어서 작성」을 묻습니다.
  - 동명이인은 성명을 구분해 입력하도록 안내합니다(예: 홍길동A).
- 제출하면 이 기기의 작성 화면이 비워지므로, 한 PC를 여러 분이 차례로 써도 섞이지 않습니다.
- 동의 단계에서 성명을 고치면, 이미 저장된 응답이 새 성명으로 옮겨집니다.
- AHP 쌍대비교는 「어느 쪽이 더 중요?」를 먼저 고르고 「얼마나 더?」를 고르는 두 단계로 묻습니다. 기록되는 값은 원래 설문지의 9·7·5·3·1 척도와 같습니다.
  - 중분류 항목의 정의는 비교 카드 아래에 `* 항목명 : 정의` 형태의 주석으로 표시합니다.
- 절대평가 L-1~L-8은 1~5점 중 고르기만 합니다. 측정값 입력칸과 비고란은 없습니다.
  - L-3은 「평소 기록 작성 시간이 얼마나 줄어들 것 같습니까?」로 묻습니다. 점수 구간은 5% 미만 1점 · 5~15% 2점 · 15~30% 3점 · 30~50% 4점 · 50% 이상 5점입니다.
- 「AGENT 기능 기대 수준」 화면에서는 무연동 AI Agent가 무엇인지 먼저 설명한 뒤 질문합니다.
- 마지막 화면에서 빠진 문항을 확인하고 [설문 제출하기]를 누릅니다. 제출한 뒤에도 수정할 수 있습니다.

## 관리자 화면

- 응답자를 **성명별**로 보여 줍니다(처음 작성한 순서). 상태(작성 중 / 제출 완료), 진행률, 마지막 저장 시각, 그리고 목표 인원(5명) 대비 응답 수를 함께 표시합니다.
- 잘못 입력된 성명이나 시험용 응답은 **삭제** 버튼으로 목록과 보고서에서 뺄 수 있습니다. 저장 이력은 남습니다.
- 평가자마다 원본 응답을 확인할 수 있습니다.
  - **응답 보기**: 화면에서 문항별 응답 확인
  - **응답지 Word**: 개인별 응답지(.docx)
  - **JSON**: 저장된 원본 데이터
- 전체 응답은 **전체 원자료(엑셀 CSV)** 또는 **전체 원본(JSON)**으로 내려받습니다.
- **[사용성평가 보고서]**: 「PuzzleGEN_260618 사용성 평가 분석보고서」와 같은 구성입니다. **⬇ Word 보고서**, **⬇ PDF 보고서** 버튼으로 내려받습니다.
  - 기본으로는 제출 완료된 응답만 반영합니다. 「작성 중 응답도 포함」을 체크하면 중간 결과도 볼 수 있습니다.
  - 「3장 시사점」은 통계로 자동 작성한 초안입니다. Word로 받아 문구를 다듬어 주세요.
- 관리자 비밀번호를 15분 안에 10번 틀리면, 해당 접속 위치는 15분 동안 차단됩니다.

## 설정 변경

`src/survey/config.js`에서 다음 값을 바꿀 수 있습니다.

- 평가자 수
- 보고서 표지의 기관명과 날짜
- 시험 시나리오 건수

설문 문항은 `src/survey/questions.js`에 모여 있습니다. 수정한 뒤에는 다시 빌드하고 재시작해 주세요.

## 개발 · 로컬 시험

```bash
npm install && npm run dev
```

`npm run dev`에서도 저장 API가 동작합니다. 개발 모드의 관리자 비밀번호는 `1234`입니다.

## 보안 참고

- 평가자는 별도 로그인 없이 성명으로 응답을 구분합니다. 같은 성명을 입력하면 기존 응답을 불러올 수 있으니, 접속 주소는 평가자에게만 전달해 주세요.
