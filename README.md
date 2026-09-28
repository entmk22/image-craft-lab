# Image Craft Lab

재사용 가능한 이미지 생성 프롬프트와 실험 기록을 정리한 정적 웹 라이브러리입니다.

## 공개 사이트

GitHub Pages를 통해 배포됩니다.

## 로컬 미리보기

```bash
python3 -m http.server 4174 --directory dist
```

## 공개 빌드 갱신

상위 `image-generator` 작업 폴더에서 다음 명령을 실행합니다.

```bash
node public-site/build-public-assets.mjs
```

빌드 과정에서 로컬 `file:///` 출처 경로를 제거하고, 공개 대상으로 지정된 프롬프트와 실험 및 필요한 미리보기 이미지만 `dist/`에 복사합니다.
