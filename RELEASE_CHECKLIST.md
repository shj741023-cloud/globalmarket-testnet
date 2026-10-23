# Global Market Testnet 출시 준비 체크리스트

점검일: 2026-10-23

이 문서는 기존 Testnet 정책을 바꾸지 않고, 코드에서 확인된 항목과 외부 서비스에서 사람이 직접 확인해야 하는 항목을 구분한다. Mainnet 전환, 실제 Pi 지급, 실제 상품 거래는 현재 출시 범위가 아니다.

## 코드 및 로컬 검증 완료

- [x] `APP_NETWORK=testnet`, `PI_SANDBOX=true` 강제
- [x] Pi SDK 2.0 Sandbox 초기화와 `username`, `payments` 권한 요청
- [x] 서버의 Pi `/v2/me` 액세스토큰 검증
- [x] User-to-App 결제의 서버 승인·완료 및 Provider 응답 검증
- [x] 결제 ID·트랜잭션 ID 중복 방지와 완료 요청 멱등 처리
- [x] 미완료 결제의 서버 검증 후 복구
- [x] 실제 Provider 검증 실패 시 결제 성공 처리 금지
- [x] PostgreSQL 준비상태 검사와 저장 직렬화
- [x] 관리자 키의 소스·브라우저 저장소 비저장
- [x] CSP 차단, HSTS, MIME 스니핑 차단, Referrer Policy 적용
- [x] 운영 환경에서는 Render·PiNet 출처만 허용하고 로컬 출처는 개발 환경에서만 허용
- [x] 모바일 390×844 화면에서 초기 화면·상품 상세·약관·하단 메뉴 점검
- [x] 검색 필드 스크린리더 이름 확인
- [x] 직거래 조건 확인 후 판매자 지갑주소 등록, 당사자 전용 공개와 이후 주소변경 차단
- [x] 공식 Pi Wallet 바로가기(`https://wallet.pinet.com`)와 주소 복사 제공
- [x] 전체 자동 테스트 344개 통과

## 공개 Testnet 읽기 전용 확인

- [x] `https://globalmarket-testnet.onrender.com/api/v1/health` HTTP 200
- [x] 공개 서버가 `testnet`, `test-pi`, `postgres`를 보고함
- [x] 공개 설정이 `sandbox=true`, `piServerConnected=true`를 보고함
- [x] `https://globalmarket-testnet.onrender.com/validation-key.txt` HTTP 200
- [x] `https://globalmarket2678.pinet.com` HTTP 200
- [x] 최신 검증 소스 배포 후 공개 리비전 `0be5d33` 갱신 확인
- [x] 최신 배포에서 `Content-Security-Policy` 차단 헤더 확인

현재 공개 리비전은 `0be5d33`이다. CSP는 보고 전용이 아닌 실제 차단 헤더로 적용되며 HSTS, `nosniff`, `strict-origin-when-cross-origin`도 함께 확인했다.

## 배포 직전 운영자 확인

- [x] 중첩된 과거 `Global Market Testnet GitHub 업로드용` 사본은 보존하고 Git 업로드 대상에서 제외
- [x] GitHub에 최신 검증 파일을 커밋·푸시
- [x] Render에 최신 커밋 배포
- [x] Render 비밀 환경변수 `PI_API_KEY`, `TEST_ADMIN_KEY`, `DATABASE_URL` 설정 확인
- [x] `ALLOW_DEMO_AUTH=false` 확인
- [ ] `ALLOWED_ORIGINS`가 실제 Render 및 PiNet 주소만 포함하는지 확인
- [x] 배포 후 `/api/v1/health`, `/api/v1/ready`, `/api/v1/config` 재확인
- [x] 최근 배포 로그에 API 키·액세스토큰·세션토큰·개인 식별값이 남지 않는지 확인

`ALLOWED_ORIGINS`의 Render 환경변수는 별도로 설정되어 있지 않다. 로컬 수정본에서는 `NODE_ENV=production`일 때 Render와 PiNet 운영 주소만 허용하도록 보완했으며, 이 변경을 배포해 공개 환경에서 재확인하기 전까지 위 항목은 완료 처리하지 않는다.

## Pi Developer Portal 및 Pi Browser 수동 확인

- [ ] Portal 앱 네트워크가 Testnet인지 확인
- [ ] Development URL과 HTTPS Production URL 확인
- [ ] Portal의 도메인 소유권 검증 완료 여부 확인
- [ ] Pi Browser 실제 기기에서 로그인 및 닉네임·약관 동의 확인
- [ ] `0.01 Test-Pi 연동시험`으로 Portal Transaction 단계 확인
- [ ] 결제 승인 전 성공 처리되지 않는지 확인
- [ ] 결제 완료 후 배송대기 전환과 판매자 알림 확인
- [ ] 결제 도중 앱 종료 후 재로그인하여 미완료 결제 복구 확인
- [ ] 구매자·판매자 두 계정으로 채팅 숫자 알림과 거래 상태 변경 확인
- [ ] 직거래 양쪽 조건 확인 후 판매자 지갑주소 등록 흐름 확인
- [ ] 지갑주소 등록 후 당사자 주소 복사와 공식 Pi Wallet 열기 확인
- [ ] 직거래 조건 확인 후 판매자 지갑주소 변경 차단 확인

위 항목의 실제 Test-Pi 거래, Portal 제출, 배포 및 운영환경 변경은 사용자 승인 후 수행한다.

## 현재 출시 제한

- Mainnet은 코드에서 차단된다.
- 판매자 지급은 모의 정산 기록만 생성하며 실제 송금하지 않는다.
- 환불은 Testnet 모의 처리이며 실제 Pi 이동을 보장하지 않는다.
- 직거래는 당사자 간 개인 Pi 지갑 송금이며 플랫폼 안전거래가 아니다.
- 직거래의 Pi Wallet 바로가기는 지갑만 열며 판매자 주소·금액을 자동 입력하거나 송금 성공을 검증하지 않는다.
- 실제 운영 전 개인정보처리 책임자·문의처·보관기간 등 법적 문구는 운영 주체가 확정해야 한다. 기존 기획에 없는 값은 임의로 작성하지 않는다.
