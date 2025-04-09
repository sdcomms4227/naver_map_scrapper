# 네이버 지도 검색 자동화

네이버 지도에서 키워드 기반 검색을 수행하고 결과를 JSON 파일로 저장하는 자동화 도구입니다.

## 기능

- 키워드 기반 장소 검색
- 필터 키워드로 결과 필터링
- 검색 결과 JSON 파일 저장
- 실시간 실행 로그 확인
- 스크립트 실행 중지
- 검색 결과 JSON 파일 다운로드

## 설치 방법

1. 저장소 클론:
```bash
git clone https://github.com/your-username/naver_map_scrapper.git
cd naver_map_scrapper
```

2. 의존성 설치:
```bash
npm install
```

## 사용 방법

1. 웹 서버 시작:
```bash
npm start
```

2. 웹 브라우저에서 접속:
```
http://localhost:3000
```

3. 검색 실행:
   - 검색어 입력
   - 필터 키워드 입력 (선택)
   - "실행" 버튼 클릭

4. 결과 확인:
   - 실행 로그에서 진행 상황 확인
   - JSON 다운로드 버튼으로 결과 파일 다운로드

## 프로젝트 구조

```
naver_map_scrapper/
├── src/
│   ├── scripts/
│   │   └── search.js
│   ├── server.js
│   └── utils.js
├── public/
│   ├── index.html
│   └── guide.html
├── results/
│   └── latest.json
├── .env
├── .gitignore
├── package.json
└── README.md
```

## 라이선스

MIT License

## 기여 방법

1. 이슈 생성
2. 브랜치 생성
3. 변경사항 커밋
4. 풀 리퀘스트 생성

## 문의

문제가 있거나 질문이 있으시면 이슈를 생성해주세요.